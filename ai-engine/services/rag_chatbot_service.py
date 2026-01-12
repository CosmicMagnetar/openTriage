"""
RAG Chatbot Service for OpenTriage.
AI assistant trained on repo docs and closed issues to answer contributor questions.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from config.settings import settings

logger = logging.getLogger(__name__)


class RAGAnswer(BaseModel):
    """Response from the RAG chatbot."""
    question: str
    answer: str
    sources: List[Dict[str, Any]] = []  # List of source documents used
    confidence: float = 0.0
    related_issues: List[Dict[str, Any]] = []
    repo_name: Optional[str] = None
    generated_at: datetime = None


class RAGChatbotService:
    """
    RAG-powered Q&A chatbot service.
    
    Uses vector similarity search on indexed documents
    (issues, PRs, docs) to provide context-aware answers.
    
    Note: For production, integrate with ChromaDB or Pinecone.
    This implementation uses in-memory search as fallback.
    """
    
    def __init__(self):
        self.use_vector_db = False  # Set True when ChromaDB is available
        self._embeddings_cache = {}
    
    async def answer_question(
        self,
        question: str,
        repo_name: Optional[str] = None,
        top_k: int = 5
    ) -> RAGAnswer:
        """
        Answer a question using RAG.
        
        Args:
            question: The question to answer
            repo_name: Optional repo context
            top_k: Number of documents to retrieve
            
        Returns:
            RAGAnswer with the response and sources
        """
        # Search for relevant documents
        relevant_docs = await self.search_documents(question, repo_name, top_k)
        
        # Build context from documents
        context = self._build_context(relevant_docs)
        
        # Generate answer using AI
        answer, confidence = await self._generate_answer(question, context, repo_name)
        
        # Find related issues
        related_issues = await self._find_related_issues(question, repo_name)
        
        return RAGAnswer(
            question=question,
            answer=answer,
            sources=[{
                "id": doc.get("id", ""),
                "title": doc.get("title", ""),
                "type": doc.get("type", ""),
                "relevance": doc.get("relevance", 0)
            } for doc in relevant_docs],
            confidence=confidence,
            related_issues=related_issues,
            repo_name=repo_name,
            generated_at=datetime.now(timezone.utc)
        )
    
    async def search_documents(
        self,
        query: str,
        repo_name: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for relevant documents.
        
        Uses vector search if available, falls back to keyword search.
        """
        from config.database import db
        
        results = []
        
        # First, try to find RAG chunks
        chunk_query = {}
        if repo_name:
            chunk_query["sourceRepo"] = repo_name
            
        # First, search specifically for README content if repo_name is provided
        if repo_name:
            readme_query = {
                "sourceRepo": repo_name,
                "documentType": "readme"
            }
            cursor = db.rag_chunks.find(readme_query, {"_id": 0}).sort("chunkIndex", 1).limit(3)
            readme_chunks = await cursor.to_list(length=3)
            
            for chunk in readme_chunks:
                results.append({
                    "id": chunk.get("chunkId", ""),
                    "title": "Project README",
                    "content": chunk.get("content", ""),
                    "type": "readme",
                    "relevance": 1.0  # High relevance for README context
                })
        
        # Simple text search as fallback
        if query:
            chunk_query["$or"] = [
                {"content": {"$regex": query, "$options": "i"}},
                {"metadata.title": {"$regex": query, "$options": "i"}}
            ]
        
        cursor = db.rag_chunks.find(chunk_query, {"_id": 0}).limit(top_k * 2)
        chunks = await cursor.to_list(length=top_k * 2)
        
        for chunk in chunks:
            results.append({
                "id": chunk.get("chunkId", ""),
                "title": chunk.get("metadata", {}).get("title", "Document"),
                "content": chunk.get("content", ""),
                "type": chunk.get("documentType", ""),
                "relevance": self._calculate_relevance(query, chunk.get("content", ""))
            })
        
        # Also search closed issues for answers
        issue_query = {"state": "closed"}
        if repo_name:
            issue_query["repoName"] = repo_name
        if query:
            issue_query["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},
                {"body": {"$regex": query, "$options": "i"}}
            ]
        
        cursor = db.issues.find(issue_query, {"_id": 0}).limit(top_k)
        issues = await cursor.to_list(length=top_k)
        
        for issue in issues:
            results.append({
                "id": issue.get("id", ""),
                "title": issue.get("title", ""),
                "content": issue.get("body", ""),
                "type": "closed_issue",
                "relevance": self._calculate_relevance(query, f"{issue.get('title', '')} {issue.get('body', '')}")
            })
        
        # Sort by relevance and return top_k
        results.sort(key=lambda x: x.get("relevance", 0), reverse=True)
        return results[:top_k]
    
    def _calculate_relevance(self, query: str, content: str) -> float:
        """Calculate simple relevance score based on keyword matching."""
        if not query or not content:
            return 0.0
        
        query_terms = set(query.lower().split())
        content_lower = content.lower()
        
        matches = sum(1 for term in query_terms if term in content_lower)
        
        if len(query_terms) == 0:
            return 0.0
        
        return matches / len(query_terms)
    
    def _build_context(self, documents: List[Dict[str, Any]]) -> str:
        """Build context string from documents."""
        if not documents:
            return ""
        
        context_parts = []
        
        for i, doc in enumerate(documents[:5]):
            title = doc.get("title", "Document")
            content = doc.get("content", "")[:500]  # Limit content
            doc_type = doc.get("type", "document")
            
            context_parts.append(f"[{doc_type.upper()}] {title}:\n{content}\n")
        
        return "\n---\n".join(context_parts)
    
    async def _generate_answer(
        self,
        question: str,
        context: str,
        repo_name: Optional[str]
    ) -> tuple[str, float]:
        """Generate answer using AI with context."""
        from openai import OpenAI
        
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.OPENROUTER_API_KEY
        )
        
        system_prompt = f"""You are a knowledgeable guide for contributors to{f' the {repo_name} project' if repo_name else ' this open source project'}, acting much like a senior developer who has worked on the codebase for years and genuinely enjoys helping newcomers find their footing.

When answering questions, draw from the provided documentation and issue history, but present your responses as if you're having a helpful conversation rather than reciting from a manual. If the context provides solid information, weave it naturally into your explanation. When the context is limited, acknowledge what you don't know while offering whatever general guidance might still be useful.

Think of yourself as sitting next to the contributor, looking at their screen together. If they need code examples, provide them with clear markdown formatting. When referencing specific issues or documentation sections, mention them naturally so they can explore further.

Your goal is to help contributors not just solve their immediate problem, but to build their confidence and understanding of how to navigate open source projects effectively."""

        user_prompt = f"""Context from project documents:
{context}

---
Question: {question}

Please provide a helpful answer based on the context above."""

        try:
            response = client.chat.completions.create(
                model="google/gemini-2.0-flash-001",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            answer = response.choices[0].message.content.strip()
            
            # Calculate confidence based on context availability
            confidence = 0.9 if context else 0.5
            
            return answer, confidence
            
        except Exception as e:
            logger.error(f"AI answer generation failed: {e}")
            return (
                "I'm sorry, I couldn't generate an answer at this time. "
                "Please check the documentation or ask in the project's discussion forum.",
                0.0
            )
    
    async def _find_related_issues(
        self,
        question: str,
        repo_name: Optional[str],
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """Find issues related to the question."""
        from config.database import db
        
        query = {}
        if repo_name:
            query["repoName"] = repo_name
        if question:
            query["$or"] = [
                {"title": {"$regex": question.split()[0] if question.split() else "", "$options": "i"}},
            ]
        
        cursor = db.issues.find(query, {"_id": 0}).limit(limit)
        issues = await cursor.to_list(length=limit)
        
        return [{
            "id": issue.get("id"),
            "number": issue.get("number"),
            "title": issue.get("title"),
            "state": issue.get("state"),
            "url": issue.get("htmlUrl", "")
        } for issue in issues]
    
    async def index_repository(self, repo_name: str, github_access_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Index a repository's content for RAG.
        Uses the existing rag_data_prep service.
        """
        try:
            from services.rag_data_prep import rag_data_prep
            
            result = await rag_data_prep.prepare_and_store(
                doc_types=["issue", "pr", "comment", "readme"],
                repo_names=[repo_name],
                collection_name="rag_chunks",
                github_access_token=github_access_token
            )
            
            return {
                "status": "success",
                "repo_name": repo_name,
                "documents_indexed": result.get("documents_processed", 0),
                "chunks_created": result.get("chunks_created", 0)
            }
            
        except Exception as e:
            logger.error(f"Indexing failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def get_suggested_questions(
        self,
        repo_name: Optional[str] = None
    ) -> List[str]:
        """Get suggested questions based on common topics."""
        from config.database import db
        
        suggestions = [
            "How do I get started contributing?",
            "What is the development setup?",
            "How do I run the tests?",
            "What coding style should I follow?",
            "How do I submit a pull request?"
        ]
        
        # Add repo-specific suggestions based on common issues
        if repo_name:
            cursor = db.issues.find(
                {"repoName": repo_name, "state": "closed"},
                {"_id": 0, "title": 1}
            ).limit(5)
            issues = await cursor.to_list(length=5)
            
            for issue in issues:
                title = issue.get("title", "")
                if "?" in title:
                    suggestions.append(title)
        
        return suggestions[:8]


# Singleton instance
rag_chatbot_service = RAGChatbotService()
