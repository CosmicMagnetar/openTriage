"""
Spark Sentiment Pipeline for OpenTriage.
Parallelizes AI sentiment analysis using Spark and Pandas UDFs.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import asyncio

from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    col, pandas_udf, udf, when, lit, count, avg,
    current_timestamp, to_date
)
from pyspark.sql.types import (
    StructType, StructField, StringType, FloatType, 
    ArrayType, MapType
)
import pandas as pd

from spark_manager import get_or_create_spark_session
from config.settings import settings

logger = logging.getLogger(__name__)


# Sentiment result schema
SENTIMENT_SCHEMA = StructType([
    StructField("sentiment", StringType(), True),
    StructField("confidence", FloatType(), True),
    StructField("emotions", MapType(StringType(), FloatType()), True)
])


class SparkSentimentPipeline:
    """
    Parallelized sentiment analysis pipeline using Spark.
    
    Uses Pandas UDFs for efficient batch API calls instead of row-by-row processing.
    """
    
    def __init__(self, batch_size: int = 10, max_concurrent_batches: int = 4):
        """
        Initialize the sentiment pipeline.
        
        Args:
            batch_size: Number of texts to process per API call
            max_concurrent_batches: Max parallel API batches
        """
        self.batch_size = batch_size
        self.max_concurrent_batches = max_concurrent_batches
        self._api_key = settings.OPENROUTER_API_KEY
    
    def _analyze_sentiment_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze sentiment for a batch of texts using AI.
        
        Args:
            texts: List of text strings to analyze
            
        Returns:
            List of sentiment results
        """
        from openai import OpenAI
        
        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self._api_key
        )
        
        results = []
        
        for text in texts:
            if not text or len(text.strip()) < 5:
                results.append({
                    "sentiment": "NEUTRAL",
                    "confidence": 0.5,
                    "emotions": {}
                })
                continue
            
            try:
                response = client.chat.completions.create(
                    model="google/gemini-2.0-flash-001",
                    messages=[
                        {
                            "role": "system",
                            "content": """Analyze the sentiment of the given text. 
                            Respond with ONLY a JSON object in this exact format:
                            {"sentiment": "POSITIVE|NEGATIVE|NEUTRAL|FRUSTRATED", "confidence": 0.0-1.0, "emotions": {"joy": 0.0, "anger": 0.0, "frustration": 0.0, "gratitude": 0.0}}"""
                        },
                        {
                            "role": "user",
                            "content": text[:1000]  # Truncate long texts
                        }
                    ],
                    max_tokens=150,
                    temperature=0.1
                )
                
                content = response.choices[0].message.content.strip()
                
                # Parse JSON response
                import json
                try:
                    # Handle markdown code blocks
                    if content.startswith("```"):
                        content = content.split("```")[1]
                        if content.startswith("json"):
                            content = content[4:]
                    
                    result = json.loads(content)
                    results.append({
                        "sentiment": result.get("sentiment", "NEUTRAL"),
                        "confidence": float(result.get("confidence", 0.5)),
                        "emotions": result.get("emotions", {})
                    })
                except json.JSONDecodeError:
                    # Fallback parsing
                    sentiment = "NEUTRAL"
                    if "POSITIVE" in content.upper():
                        sentiment = "POSITIVE"
                    elif "NEGATIVE" in content.upper():
                        sentiment = "NEGATIVE"
                    elif "FRUSTRATED" in content.upper():
                        sentiment = "FRUSTRATED"
                    
                    results.append({
                        "sentiment": sentiment,
                        "confidence": 0.6,
                        "emotions": {}
                    })
                    
            except Exception as e:
                logger.error(f"Sentiment API error: {e}")
                results.append({
                    "sentiment": "NEUTRAL",
                    "confidence": 0.0,
                    "emotions": {"error": 1.0}
                })
        
        return results
    
    def create_sentiment_udf(self):
        """
        Create a Pandas UDF for batch sentiment analysis.
        """
        batch_size = self.batch_size
        analyzer = self._analyze_sentiment_batch
        
        @pandas_udf(StringType())
        def sentiment_udf(texts: pd.Series) -> pd.Series:
            """Pandas UDF for batch sentiment analysis."""
            import json
            
            text_list = texts.tolist()
            results = []
            
            # Process in batches
            for i in range(0, len(text_list), batch_size):
                batch = text_list[i:i + batch_size]
                batch_results = analyzer(batch)
                results.extend(batch_results)
            
            # Convert to JSON strings
            return pd.Series([json.dumps(r) for r in results])
        
        return sentiment_udf
    
    async def analyze_comments(
        self, 
        comments: List[Dict[str, Any]] = None,
        use_cache: bool = True
    ) -> DataFrame:
        """
        Analyze sentiment for a collection of comments.
        
        Args:
            comments: List of comment dicts, or None to fetch from DB
            use_cache: Whether to skip already-analyzed comments
            
        Returns:
            DataFrame with sentiment analysis results
        """
        from config.database import db
        
        # Fetch comments if not provided
        if comments is None:
            if use_cache:
                # Only get comments without sentiment
                cursor = db.comments.find(
                    {"sentiment": {"$exists": False}},
                    {"_id": 0}
                )
            else:
                cursor = db.comments.find({}, {"_id": 0})
            
            comments = await cursor.to_list(length=None)
        
        if not comments:
            logger.info("No comments to analyze")
            return None
        
        logger.info(f"Analyzing sentiment for {len(comments)} comments")
        
        try:
            spark = get_or_create_spark_session()
        except Exception:
            spark = None
            
        if spark:
            # Spark Logic
            # Create Spark DataFrame
            
            # Prepare data
            comment_data = [{
                "comment_id": c.get("id", ""),
                "issue_id": c.get("issueId", ""),
                "author": c.get("author", ""),
                "body": c.get("body", ""),
                "created_at": c.get("createdAt", ""),
                "repo_name": c.get("repoName", "")
            } for c in comments]
            
            df = spark.createDataFrame(comment_data)
            
            # Apply sentiment UDF
            sentiment_udf = self.create_sentiment_udf()
            
            result_df = df.withColumn(
                "sentiment_json",
                sentiment_udf(col("body"))
            )
            
            # Parse JSON results
            from pyspark.sql.functions import from_json, get_json_object
            
            result_df = result_df.withColumn(
                "sentiment",
                get_json_object(col("sentiment_json"), "$.sentiment")
            ).withColumn(
                "confidence",
                get_json_object(col("sentiment_json"), "$.confidence").cast(FloatType())
            )
            
            # Cache results
            result_df.cache()
            
            analyzed_count = result_df.count()
            logger.info(f"Completed Spark sentiment analysis for {analyzed_count} comments")
            
            return result_df
        else:
            # Python Logic
            logger.info("Spark not available, using Python fallback for sentiment analysis")
            results = []
            bodies = [c.get("body", "") for c in comments]
            
            # Process in batches
            for i in range(0, len(bodies), self.batch_size):
                batch_bodies = bodies[i:i + self.batch_size]
                batch_results = self._analyze_sentiment_batch(batch_bodies)
                
                # Merge with original comment data
                for j, res in enumerate(batch_results):
                    idx = i + j
                    if idx < len(comments):
                        comment = comments[idx]
                        results.append({
                            "comment_id": comment.get("id", ""),
                            "issue_id": comment.get("issueId", ""),
                            "sentiment": res["sentiment"],
                            "confidence": res["confidence"],
                            "repo_name": comment.get("repoName", "")
                        })
            
            logger.info(f"Completed Python sentiment analysis for {len(results)} comments")
            return results
    
    async def store_results(self, df: DataFrame) -> int:
        """
        Store sentiment analysis results back to MongoDB.
        
        Args:
            df: DataFrame with sentiment results
            
        Returns:
            Number of records updated
        """
        from config.database import db
        
        if df is None:
            return 0
        
        results = []
        if hasattr(df, 'collect'):
            # Spark DataFrame
            rows = df.select(
                "comment_id", "issue_id", "sentiment", "confidence"
            ).collect()
            results = [
                {
                    "comment_id": row.comment_id, 
                    "issue_id": row.issue_id, 
                    "sentiment": row.sentiment, 
                    "confidence": row.confidence
                } for row in rows
            ]
        else:
            # Python List
            results = df
            
        updated = 0
        for row in results:
            comment_id = row.get("comment_id")
            if comment_id:
                await db.comments.update_one(
                    {"id": comment_id},
                    {
                        "$set": {
                            "sentiment": row.get("sentiment"),
                            "sentimentConfidence": row.get("confidence"),
                            "analyzedAt": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                updated += 1
        
        logger.info(f"Stored sentiment results for {updated} comments")
        return updated
    
    async def run_pipeline(self, use_cache: bool = True) -> Dict[str, Any]:
        """
        Run the full sentiment analysis pipeline.
        
        Args:
            use_cache: Whether to skip already-analyzed comments
            
        Returns:
            Pipeline execution summary
        """
        start_time = datetime.now(timezone.utc)
        
        # Analyze comments
        df = await self.analyze_comments(use_cache=use_cache)
        
        if df is None:
            return {
                "status": "no_data",
                "analyzed": 0,
                "stored": 0,
                "duration_seconds": 0
            }
        
        # Get sentiment distribution
        sentiment_dist = df.groupBy("sentiment").count().collect()
        distribution = {row.sentiment: row["count"] for row in sentiment_dist}
        
        # Store results
        stored = await self.store_results(df)
        
        # Cleanup
        if hasattr(df, 'unpersist'):
            df.unpersist()
        
        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()
        
        # Get actual results for frontend
        results = []
        if hasattr(df, 'collect'):
            rows = df.select("comment_id", "issue_id", "sentiment", "confidence").limit(50).collect()
            results = [{
                "id": row.comment_id,
                "sentiment": row.sentiment,
                "confidence": row.confidence,
                "source": "comment"
            } for row in rows]
        else:
            results = [{
                "id": item.get("comment_id"),
                "sentiment": item.get("sentiment"),
                "confidence": item.get("confidence"),
                "source": "comment"
            } for item in df[:50]]
        
        return {
            "status": "completed",
            "analyzed": len(df) if isinstance(df, list) else (df.count() if df else 0),
            "stored": stored,
            "duration_seconds": duration,
            "distribution": distribution,
            "results": results,
            "stats": {
                "positive": distribution.get("POSITIVE", 0),
                "negative": distribution.get("NEGATIVE", 0),
                "neutral": distribution.get("NEUTRAL", 0),
                "toxic": distribution.get("FRUSTRATED", 0) + distribution.get("TOXIC", 0)
            }
        }

    
    def get_sentiment_stats(self, df: DataFrame) -> Dict[str, Any]:
        """
        Get sentiment statistics from analyzed DataFrame.
        """
        if df is None:
            return {}
        
        stats = {
            "total": 0,
            "by_sentiment": {},
            "avg_confidence": 0.0
        }
        
        if hasattr(df, 'collect'):
            # Spark DataFrame
            stats["total"] = df.count()
            distribution = df.groupBy("sentiment").count().collect()
            for row in distribution:
                stats["by_sentiment"][row.sentiment or "UNKNOWN"] = row["count"]
            
            avg_conf = df.agg(avg("confidence")).first()[0]
            stats["avg_confidence"] = float(avg_conf) if avg_conf else 0.0
        else:
            # Python List
            stats["total"] = len(df)
            total_conf = 0
            
            for item in df:
                sentiment = item.get("sentiment", "UNKNOWN")
                stats["by_sentiment"][sentiment] = stats["by_sentiment"].get(sentiment, 0) + 1
                total_conf += item.get("confidence", 0)
                
            if stats["total"] > 0:
                stats["avg_confidence"] = total_conf / stats["total"]
        
        return stats
    
    async def analyze_repo_sentiment(self, repo_name: str) -> Dict[str, Any]:
        """
        Analyze sentiment for all comments in a repository.
        
        Args:
            repo_name: Full repository name (owner/repo)
            
        Returns:
            Sentiment analysis summary for the repo
        """
        from config.database import db
        
        # Fetch repo comments
        cursor = db.comments.find(
            {"repoName": repo_name},
            {"_id": 0}
        )
        comments = await cursor.to_list(length=None)
        
        if not comments:
            return {
                "repo_name": repo_name,
                "total_comments": 0,
                "sentiment": "N/A"
            }
        
        # Analyze
        df = await self.analyze_comments(comments=comments, use_cache=False)
        stats = self.get_sentiment_stats(df)
        
        # Determine overall sentiment
        if stats.get("by_sentiment"):
            overall = max(stats["by_sentiment"], key=stats["by_sentiment"].get)
        else:
            overall = "NEUTRAL"
        
        # Get results for frontend
        results = []
        if hasattr(df, 'collect'):
            rows = df.select("comment_id", "issue_id", "sentiment", "confidence").limit(50).collect()
            results = [{
                "id": row.comment_id,
                "author": None,
                "content": None,
                "sentiment": row.sentiment,
                "confidence": row.confidence,
                "source": "comment"
            } for row in rows]
        elif df:
            results = [{
                "id": item.get("comment_id"),
                "author": item.get("author"),
                "content": item.get("body", "")[:100] if item.get("body") else None,
                "sentiment": item.get("sentiment"),
                "confidence": item.get("confidence"),
                "source": "comment"
            } for item in df[:50]]
        
        # Build distribution for stats
        dist = stats.get("by_sentiment", {})
        
        return {
            "repo_name": repo_name,
            "total_comments": stats.get("total", 0),
            "overall_sentiment": overall,
            "distribution": dist,
            "avg_confidence": stats.get("avg_confidence", 0.0),
            "results": results,
            "stats": {
                "positive": dist.get("POSITIVE", 0),
                "negative": dist.get("NEGATIVE", 0),
                "neutral": dist.get("NEUTRAL", 0),
                "toxic": dist.get("FRUSTRATED", 0) + dist.get("TOXIC", 0)
            }
        }


# Singleton instance
spark_sentiment_pipeline = SparkSentimentPipeline(
    batch_size=10,
    max_concurrent_batches=4
)
