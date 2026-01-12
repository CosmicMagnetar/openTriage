"""
RAG Data Preparation Service for OpenTriage.
Uses Spark for high-speed chunking and cleaning of documents for Vector DB.
"""
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    col, udf, explode, posexplode, lit, concat, concat_ws,
    length, size, array, struct, row_number, monotonically_increasing_id,
    regexp_replace, trim, lower, split
)
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, 
    ArrayType, MapType
)

from spark_manager import get_or_create_spark_session

logger = logging.getLogger(__name__)


class DocumentChunk(BaseModel):
    """Model for a document chunk ready for embedding."""
    chunk_id: str
    document_id: str
    document_type: str  # issue, pr, doc, comment
    source_repo: str
    chunk_index: int
    total_chunks: int
    content: str
    metadata: Dict[str, Any] = {}
    token_count: int = 0


class RAGDataPrep:
    """
    Service for preparing documents for Vector Database ingestion.
    
    Uses Spark for parallel processing of:
    - Text cleaning (remove markdown artifacts, code blocks)
    - Chunking with overlap
    - Metadata enrichment
    """
    
    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        min_chunk_size: int = 50
    ):
        """
        Initialize RAG data prep service.
        
        Args:
            chunk_size: Target tokens per chunk
            chunk_overlap: Token overlap between chunks
            min_chunk_size: Minimum tokens for a valid chunk
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
    
    def _clean_text(self, text: str) -> str:
        """
        Clean text by removing markdown artifacts and code blocks.
        """
        if not text:
            return ""
        
        # Remove code blocks
        text = re.sub(r'```[\s\S]*?```', ' [CODE_BLOCK] ', text)
        text = re.sub(r'`[^`]+`', ' [CODE] ', text)
        
        # Remove markdown links but keep text
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
        
        # Remove markdown images
        text = re.sub(r'!\[[^\]]*\]\([^\)]+\)', ' [IMAGE] ', text)
        
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special markdown characters
        text = re.sub(r'[#*_~>|]', '', text)
        
        return text.strip()
    
    def _simple_tokenize(self, text: str) -> List[str]:
        """
        Simple word-based tokenization.
        For production, use tiktoken or similar.
        """
        if not text:
            return []
        
        # Split on whitespace and punctuation
        tokens = re.findall(r'\b\w+\b', text.lower())
        return tokens
    
    def _chunk_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Chunk text into overlapping segments.
        
        Returns:
            List of chunk dicts with content and metadata
        """
        if not text:
            return []
        
        tokens = self._simple_tokenize(text)
        
        if len(tokens) < self.min_chunk_size:
            return [{
                "content": text,
                "token_count": len(tokens),
                "chunk_index": 0
            }]
        
        chunks = []
        step = self.chunk_size - self.chunk_overlap
        
        for i in range(0, len(tokens), step):
            chunk_tokens = tokens[i:i + self.chunk_size]
            
            if len(chunk_tokens) < self.min_chunk_size:
                # Skip tiny trailing chunks
                if chunks:
                    continue
            
            chunk_text = " ".join(chunk_tokens)
            chunks.append({
                "content": chunk_text,
                "token_count": len(chunk_tokens),
                "chunk_index": len(chunks)
            })
        
        return chunks
    
    def create_chunking_udf(self):
        """
        Create a UDF for text chunking.
        """
        chunk_size = self.chunk_size
        chunk_overlap = self.chunk_overlap
        min_chunk_size = self.min_chunk_size
        
        def chunk_text_udf(text: str) -> List[Dict[str, Any]]:
            if not text:
                return []
            
            # Simple tokenization
            tokens = re.findall(r'\b\w+\b', text.lower())
            
            if len(tokens) < min_chunk_size:
                return [{"content": text, "token_count": len(tokens), "chunk_index": 0}]
            
            chunks = []
            step = chunk_size - chunk_overlap
            
            for i in range(0, len(tokens), step):
                chunk_tokens = tokens[i:i + chunk_size]
                
                if len(chunk_tokens) < min_chunk_size and chunks:
                    continue
                
                chunks.append({
                    "content": " ".join(chunk_tokens),
                    "token_count": len(chunk_tokens),
                    "chunk_index": len(chunks)
                })
            
            return chunks
        
        return udf(chunk_text_udf, ArrayType(
            StructType([
                StructField("content", StringType()),
                StructField("token_count", IntegerType()),
                StructField("chunk_index", IntegerType())
            ])
        ))
    
    def create_cleaning_udf(self):
        """
        Create a UDF for text cleaning.
        """
        def clean_text_udf(text: str) -> str:
            if not text:
                return ""
            
            # Remove code blocks
            text = re.sub(r'```[\s\S]*?```', ' [CODE_BLOCK] ', text)
            text = re.sub(r'`[^`]+`', ' [CODE] ', text)
            
            # Remove markdown links
            text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
            
            # Remove images
            text = re.sub(r'!\[[^\]]*\]\([^\)]+\)', ' [IMAGE] ', text)
            
            # Remove HTML
            text = re.sub(r'<[^>]+>', ' ', text)
            
            # Clean whitespace
            text = re.sub(r'\s+', ' ', text)
            
            return text.strip()
        
        return udf(clean_text_udf, StringType())
    
    async def fetch_documents(
        self,
        doc_types: List[str] = None,
        repo_names: List[str] = None,
        github_access_token: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch documents from MongoDB for RAG preparation.
        
        Args:
            doc_types: Types to fetch (issue, pr, comment)
            repo_names: Optional filter by repository
            
        Returns:
            List of document records
        """
        from config.database import db
        
        doc_types = doc_types or ["issue", "pr", "comment", "readme"]
        documents = []
        
        if "readme" in doc_types and repo_names:
            from services.github_service import github_service
            
            for repo in repo_names:
                try:
                    content = await github_service.fetch_repository_readme(repo, github_access_token)
                    if content:
                        documents.append({
                            "document_id": f"{repo}_readme",
                            "document_type": "readme",
                            "source_repo": repo,
                            "title": "Project README",
                            "body": content,
                            "author": "System",
                            "number": 0,
                            "state": "active",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                except Exception as e:
                    logger.error(f"Failed to fetch README for {repo}: {e}")
        
        if "issue" in doc_types or "pr" in doc_types:
            query = {}
            if repo_names:
                query["repoName"] = {"$in": repo_names}
            
            cursor = db.issues.find(query, {"_id": 0})
            items = await cursor.to_list(length=None)
            
            for item in items:
                doc_type = "pr" if item.get("isPR") else "issue"
                if doc_type not in doc_types:
                    continue
                
                documents.append({
                    "document_id": item.get("id", ""),
                    "document_type": doc_type,
                    "source_repo": item.get("repoName", ""),
                    "title": item.get("title", ""),
                    "body": item.get("body", ""),
                    "author": item.get("authorName", ""),
                    "number": item.get("number", 0),
                    "state": item.get("state", ""),
                    "created_at": item.get("createdAt", "")
                })
        
        if "comment" in doc_types:
            query = {}
            if repo_names:
                query["repoName"] = {"$in": repo_names}
            
            cursor = db.comments.find(query, {"_id": 0})
            comments = await cursor.to_list(length=None)
            
            for comment in comments:
                documents.append({
                    "document_id": comment.get("id", ""),
                    "document_type": "comment",
                    "source_repo": comment.get("repoName", ""),
                    "title": "",
                    "body": comment.get("body", ""),
                    "author": comment.get("author", ""),
                    "number": 0,
                    "state": "",
                    "created_at": comment.get("createdAt", "")
                })
        
        return documents
    
    def prepare_documents(self, documents: List[Dict[str, Any]]) -> DataFrame:
        """
        Prepare documents for Vector DB using Spark.
        
        Args:
            documents: List of document records
            
        Returns:
            DataFrame with chunked and cleaned documents
        """
        if not documents:
            return None
        
        spark = get_or_create_spark_session()
        
        # Create DataFrame
        df = spark.createDataFrame(documents)
        
        # Combine title and body
        df = df.withColumn(
            "full_text",
            concat_ws(" ", col("title"), col("body"))
        )
        
        # Clean text using UDF
        cleaning_udf = self.create_cleaning_udf()
        df = df.withColumn("cleaned_text", cleaning_udf(col("full_text")))
        
        # Chunk text using UDF
        chunking_udf = self.create_chunking_udf()
        df = df.withColumn("chunks", chunking_udf(col("cleaned_text")))
        
        # Explode chunks into separate rows
        df = df.withColumn("chunk_data", explode(col("chunks")))
        
        # Extract chunk fields
        df = df.withColumn("chunk_content", col("chunk_data.content"))
        df = df.withColumn("token_count", col("chunk_data.token_count"))
        df = df.withColumn("chunk_index", col("chunk_data.chunk_index"))
        
        # Calculate total chunks per document
        from pyspark.sql import Window
        window_spec = Window.partitionBy("document_id")
        df = df.withColumn("total_chunks", size(col("chunks")))
        
        # Generate chunk IDs
        df = df.withColumn(
            "chunk_id",
            concat(col("document_id"), lit("_chunk_"), col("chunk_index"))
        )
        
        # Select final columns
        result_df = df.select(
            "chunk_id",
            "document_id",
            "document_type",
            "source_repo",
            "chunk_index",
            "total_chunks",
            "chunk_content",
            "token_count",
            "author",
            "number",
            "state",
            "created_at"
        )
        
        return result_df
    
    async def prepare_and_store(
        self,
        doc_types: List[str] = None,
        repo_names: List[str] = None,
        collection_name: str = "rag_chunks",
        github_access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Prepare documents and store chunks in MongoDB.
        
        Args:
            doc_types: Document types to process
            repo_names: Optional repository filter
            collection_name: Target collection for chunks
            
        Returns:
            Preparation summary
        """
        from config.database import db
        
        start_time = datetime.now(timezone.utc)
        
        # Fetch documents
        documents = await self.fetch_documents(doc_types, repo_names, github_access_token)
        
        if not documents:
            return {
                "status": "no_documents",
                "documents_processed": 0,
                "chunks_created": 0
            }
        
        logger.info(f"Preparing {len(documents)} documents for RAG")
        
        # Prepare with Spark
        df = self.prepare_documents(documents)
        
        if df is None:
            return {
                "status": "preparation_failed",
                "documents_processed": len(documents),
                "chunks_created": 0
            }
        
        # Cache for counting
        df.cache()
        chunk_count = df.count()
        
        # Convert to list and store
        chunks = df.collect()
        
        # Clear existing chunks for these repos
        if repo_names:
            await db[collection_name].delete_many({"sourceRepo": {"$in": repo_names}})
        else:
            # Fallback if no repo names provided (shouldn't happen in single-repo index)
            await db[collection_name].delete_many({})
        
        # Store chunks
        chunk_docs = []
        for row in chunks:
            chunk_docs.append({
                "chunkId": row.chunk_id,
                "documentId": row.document_id,
                "documentType": row.document_type,
                "sourceRepo": row.source_repo,
                "chunkIndex": row.chunk_index,
                "totalChunks": row.total_chunks,
                "content": row.chunk_content,
                "tokenCount": row.token_count,
                "metadata": {
                    "author": row.author,
                    "number": row.number,
                    "state": row.state,
                    "createdAt": row.created_at
                },
                "preparedAt": datetime.now(timezone.utc).isoformat()
            })
        
        if chunk_docs:
            await db[collection_name].insert_many(chunk_docs)
        
        # Cleanup
        df.unpersist()
        
        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()
        
        logger.info(f"RAG preparation complete: {chunk_count} chunks from {len(documents)} documents")
        
        return {
            "status": "completed",
            "documents_processed": len(documents),
            "chunks_created": chunk_count,
            "collection": collection_name,
            "duration_seconds": duration,
            "avg_chunks_per_doc": chunk_count / len(documents) if documents else 0
        }
    
    async def get_chunks_for_embedding(
        self,
        batch_size: int = 100,
        skip_embedded: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get chunks ready for embedding.
        
        Args:
            batch_size: Number of chunks to return
            skip_embedded: Skip chunks that already have embeddings
            
        Returns:
            List of chunks for embedding
        """
        from config.database import db
        
        query = {}
        if skip_embedded:
            query["embedding"] = {"$exists": False}
        
        cursor = db.rag_chunks.find(query, {"_id": 0}).limit(batch_size)
        chunks = await cursor.to_list(length=batch_size)
        
        return chunks
    
    async def store_embeddings(
        self,
        chunk_id: str,
        embedding: List[float]
    ) -> bool:
        """
        Store embedding for a chunk.
        
        Args:
            chunk_id: Chunk identifier
            embedding: Vector embedding
            
        Returns:
            Success status
        """
        from config.database import db
        
        result = await db.rag_chunks.update_one(
            {"chunkId": chunk_id},
            {
                "$set": {
                    "embedding": embedding,
                    "embeddedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return result.modified_count > 0
    
    def get_stats(self, df: DataFrame) -> Dict[str, Any]:
        """
        Get statistics about prepared chunks.
        """
        if df is None:
            return {}
        
        return {
            "total_chunks": df.count(),
            "by_type": {
                row.document_type: row["count"]
                for row in df.groupBy("document_type").count().collect()
            },
            "avg_token_count": df.agg({"token_count": "avg"}).first()[0],
            "total_documents": df.select("document_id").distinct().count()
        }


# Singleton instance
rag_data_prep = RAGDataPrep(
    chunk_size=512,
    chunk_overlap=64,
    min_chunk_size=50
)
