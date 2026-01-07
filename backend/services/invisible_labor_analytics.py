"""
Invisible Labor Analytics Service for OpenTriage.
Uses Spark to aggregate "invisible labor" metrics across repository history.
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field

from pyspark.sql import SparkSession, DataFrame, Window
from pyspark.sql.functions import (
    col, count, sum as spark_sum, avg, min as spark_min, max as spark_max,
    datediff, when, lit, current_timestamp, to_date, hour,
    row_number, dense_rank, lag, lead, first, last,
    collect_list, size, array_distinct, explode
)
from pyspark.sql.types import (
    StructType, StructField, StringType, TimestampType, 
    IntegerType, FloatType, ArrayType
)

from spark_manager import get_or_create_spark_session

logger = logging.getLogger(__name__)


class InvisibleLaborMetrics(BaseModel):
    """Model for invisible labor metrics output."""
    user_id: str
    username: str
    
    # Review metrics
    review_count: int = 0
    review_depth_score: float = 0.0
    avg_review_turnaround_hours: float = 0.0
    
    # Mentorship metrics
    mentorship_comments: int = 0
    newcomer_welcomes: int = 0
    helpful_responses: int = 0
    
    # Triage metrics
    issues_triaged: int = 0
    labels_applied: int = 0
    avg_triage_time_hours: float = 0.0
    
    # Response metrics
    first_responses: int = 0
    avg_first_response_hours: float = 0.0
    
    # Overall scores
    total_invisible_labor_score: float = 0.0
    period_start: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    period_end: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def impact_score(self) -> float:
        """Alias for total_invisible_labor_score for frontend compatibility."""
        return self.total_invisible_labor_score
    
    def model_dump(self, **kwargs):
        """Override to include impact_score in serialization."""
        data = super().model_dump(**kwargs)
        data["impact_score"] = self.total_invisible_labor_score
        return data



class InvisibleLaborAnalytics:
    """
    Service for computing "invisible labor" metrics using Spark.
    
    Invisible labor includes:
    - Code reviews (depth and thoroughness)
    - Mentorship comments (helping newcomers)
    - Triage work (labeling, categorizing issues)
    - First responses (reducing wait times)
    """
    
    def __init__(self):
        self.mentorship_keywords = [
            "welcome", "first contribution", "good first",
            "happy to help", "let me explain", "here's how",
            "try this", "suggestion", "consider", "might want to",
            "great start", "good job", "well done", "thank you for"
        ]
        self.negative_keywords = [
            "wrong", "incorrect", "bad", "terrible", "awful",
            "stupid", "dumb", "waste of time"
        ]
    
    async def fetch_review_data(self, repo_names: List[str] = None, days: int = 90) -> List[Dict]:
        """Fetch PR review data from MongoDB."""
        from config.database import db
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        query = {"isPR": True}
        if repo_names:
            query["repoName"] = {"$in": repo_names}
        
        cursor = db.issues.find(query, {"_id": 0})
        prs = await cursor.to_list(length=None)
        
        # Fetch associated comments as "reviews"
        reviews = []
        for pr in prs:
            comments_cursor = db.comments.find(
                {"issueId": pr.get("id")},
                {"_id": 0}
            )
            comments = await comments_cursor.to_list(length=None)
            
            for comment in comments:
                reviews.append({
                    "pr_id": pr.get("id"),
                    "pr_number": pr.get("number"),
                    "repo_name": pr.get("repoName"),
                    "pr_author": pr.get("authorName"),
                    "pr_created_at": pr.get("createdAt"),
                    "reviewer": comment.get("author"),
                    "review_body": comment.get("body", ""),
                    "review_created_at": comment.get("createdAt"),
                    "word_count": len((comment.get("body") or "").split())
                })
        
        return reviews
    
    async def fetch_triage_data(self, repo_names: List[str] = None, days: int = 90) -> List[Dict]:
        """Fetch issue triage data from MongoDB."""
        from config.database import db
        
        query = {"isPR": False}
        if repo_names:
            query["repoName"] = {"$in": repo_names}
        
        cursor = db.issues.find(query, {"_id": 0})
        issues = await cursor.to_list(length=None)
        
        # Fetch triage data
        triage_records = []
        for issue in issues:
            triage = await db.triage_data.find_one(
                {"issueId": issue.get("id")},
                {"_id": 0}
            )
            
            if triage:
                triage_records.append({
                    "issue_id": issue.get("id"),
                    "issue_number": issue.get("number"),
                    "repo_name": issue.get("repoName"),
                    "issue_author": issue.get("authorName"),
                    "issue_created_at": issue.get("createdAt"),
                    "classification": triage.get("classification"),
                    "suggested_label": triage.get("suggestedLabel"),
                    "analyzed_at": triage.get("analyzedAt"),
                    "triaged_by": "ai_system"  # Could track human triagers
                })
        
        return triage_records
    
    async def fetch_comment_data(self, repo_names: List[str] = None, days: int = 90) -> List[Dict]:
        """Fetch comment data for mentorship analysis."""
        from config.database import db
        
        cursor = db.comments.find({}, {"_id": 0})
        comments = await cursor.to_list(length=None)
        
        return [{
            "comment_id": c.get("id", ""),
            "issue_id": c.get("issueId"),
            "repo_name": c.get("repoName", ""),
            "author": c.get("author"),
            "body": c.get("body", ""),
            "created_at": c.get("createdAt"),
            "word_count": len((c.get("body") or "").split()),
            "sentiment": c.get("sentiment")
        } for c in comments]
    
    def compute_review_metrics(self, reviews: List[Dict]) -> DataFrame:
        """
        Compute review depth and thoroughness metrics using Spark.
        """
        if not reviews:
            return None
        
        try:
            spark = get_or_create_spark_session()
        except Exception:
            spark = None
            
        if spark:
            # Spark Logic
            df = spark.createDataFrame(reviews)
            
            # Register for SQL
            df.createOrReplaceTempView("reviews")
            
            # Compute per-reviewer metrics
            metrics_query = """
            SELECT 
                reviewer,
                COUNT(*) as review_count,
                
                -- Review depth: based on word count
                AVG(word_count) as avg_words_per_review,
                SUM(word_count) as total_words,
                
                -- Depth score: weighted by thoroughness
                SUM(
                    CASE 
                        WHEN word_count >= 100 THEN 3.0
                        WHEN word_count >= 50 THEN 2.0
                        WHEN word_count >= 20 THEN 1.0
                        ELSE 0.5
                    END
                ) as review_depth_score,
                
                -- Unique PRs reviewed
                COUNT(DISTINCT pr_id) as unique_prs_reviewed,
                
                -- Cross-repo reviews (helps more projects)
                COUNT(DISTINCT repo_name) as repos_reviewed
                
            FROM reviews
            WHERE reviewer IS NOT NULL AND reviewer != ''
            GROUP BY reviewer
            ORDER BY review_depth_score DESC
            """
            
            return spark.sql(metrics_query)
        else:
            # Python Logic
            results = {}
            for r in reviews:
                reviewer = r.get("reviewer")
                if not reviewer:
                    continue
                
                if reviewer not in results:
                    results[reviewer] = {
                        "reviewer": reviewer,
                        "review_count": 0,
                        "total_words": 0,
                        "review_depth_score": 0.0,
                        "pr_ids": set(),
                        "repos": set()
                    }
                
                word_count = r.get("word_count", 0)
                score = 0.5
                if word_count >= 100: score = 3.0
                elif word_count >= 50: score = 2.0
                elif word_count >= 20: score = 1.0
                
                results[reviewer]["review_count"] += 1
                results[reviewer]["total_words"] += word_count
                results[reviewer]["review_depth_score"] += score
                results[reviewer]["pr_ids"].add(r.get("pr_id"))
                results[reviewer]["repos"].add(r.get("repo_name"))
                
            # Convert to list and calculate averages
            final_results = []
            for data in results.values():
                data["unique_prs_reviewed"] = len(data["pr_ids"])
                data["repos_reviewed"] = len(data["repos"])
                data["avg_words_per_review"] = data["total_words"] / data["review_count"] if data["review_count"] else 0
                del data["pr_ids"]
                del data["repos"]
                final_results.append(data)
                
            return final_results
    
    def compute_mentorship_metrics(self, comments: List[Dict]) -> DataFrame:
        """
        Compute mentorship metrics based on comment analysis.
        """
        if not comments:
            return None
        
        try:
            spark = get_or_create_spark_session()
        except Exception:
            spark = None

        if spark:
            # Spark Logic
            df = spark.createDataFrame(comments)
            
            # Add mentorship indicators
            mentorship_pattern = "|".join(self.mentorship_keywords)
            
            df = df.withColumn(
                "is_mentorship",
                col("body").rlike(f"(?i)({mentorship_pattern})")
            ).withColumn(
                "is_substantial",
                col("word_count") >= 30
            )
            
            df.createOrReplaceTempView("comments")
            
            metrics_query = """
            SELECT
                author,
                COUNT(*) as total_comments,
                
                -- Mentorship comments
                SUM(CASE WHEN is_mentorship THEN 1 ELSE 0 END) as mentorship_comments,
                
                -- Helpful responses (substantial + positive tone)
                SUM(CASE WHEN is_substantial AND is_mentorship THEN 1 ELSE 0 END) as helpful_responses,
                
                -- Engagement score
                AVG(word_count) as avg_comment_length,
                
                -- Mentorship ratio
                CAST(SUM(CASE WHEN is_mentorship THEN 1 ELSE 0 END) AS FLOAT) / 
                    NULLIF(COUNT(*), 0) as mentorship_ratio
                
            FROM comments
            WHERE author IS NOT NULL AND author != ''
            GROUP BY author
            HAVING COUNT(*) >= 3
            ORDER BY mentorship_comments DESC
            """
            
            return spark.sql(metrics_query)
        else:
            # Python Logic
            import re
            
            results = {}
            pattern = re.compile(f"({'|'.join(map(re.escape, self.mentorship_keywords))})", re.IGNORECASE)
            
            for c in comments:
                author = c.get("author")
                if not author:
                    continue
                    
                if author not in results:
                    results[author] = {
                        "author": author,
                        "total_comments": 0,
                        "mentorship_comments": 0,
                        "helpful_responses": 0,
                        "total_words": 0
                    }
                
                body = c.get("body", "")
                word_count = c.get("word_count", 0)
                is_mentorship = bool(pattern.search(body))
                is_substantial = word_count >= 30
                
                results[author]["total_comments"] += 1
                results[author]["total_words"] += word_count
                
                if is_mentorship:
                    results[author]["mentorship_comments"] += 1
                    if is_substantial:
                        results[author]["helpful_responses"] += 1
            
            # Filter and finalize
            final_results = []
            for data in results.values():
                if data["total_comments"] >= 3:
                    data["avg_comment_length"] = data["total_words"] / data["total_comments"]
                    data["mentorship_ratio"] = data["mentorship_comments"] / data["total_comments"]
                    final_results.append(data)
            
            return final_results
    
    def compute_response_metrics(self, comments: List[Dict], issues: List[Dict]) -> DataFrame:
        """
        Compute first-response metrics using Spark.
        """
        if not comments or not issues:
            return None
        
        try:
            spark = get_or_create_spark_session()
        except Exception:
            spark = None
            
        if spark:
            # Spark Logic
            comments_df = spark.createDataFrame(comments)
            issues_df = spark.createDataFrame([{
                "issue_id": i.get("id"),
                "issue_author": i.get("authorName"),
                "issue_created_at": i.get("createdAt")
            } for i in issues])
            
            # Find first response to each issue
            window_spec = Window.partitionBy("issue_id").orderBy("created_at")
            
            first_responses = comments_df.withColumn(
                "response_rank",
                row_number().over(window_spec)
            ).filter(
                col("response_rank") == 1
            ).filter(
                col("author") != col("issue_author") if "issue_author" in comments_df.columns else lit(True)
            )
            
            # Aggregate by responder
            metrics = first_responses.groupBy("author").agg(
                count("*").alias("first_responses"),
                avg("word_count").alias("avg_first_response_length")
            )
            
            return metrics
        else:
            # Python Logic
            # Map issues to authors
            issue_authors = {i.get("id"): i.get("authorName") for i in issues}
            
            # Group comments by issue and sort by date
            comments_by_issue = {}
            for c in comments:
                issue_id = c.get("issue_id")
                if not issue_id: continue
                
                if issue_id not in comments_by_issue:
                    comments_by_issue[issue_id] = []
                comments_by_issue[issue_id].append(c)
            
            results = {}
            
            for issue_id, issue_comments in comments_by_issue.items():
                # Sort by created_at
                issue_comments.sort(key=lambda x: x.get("created_at", ""))
                
                if not issue_comments: continue
                
                first_comment = issue_comments[0]
                responder = first_comment.get("author")
                
                # Skip if responder is issue author
                if responder == issue_authors.get(issue_id):
                    continue
                    
                if not responder: continue
                
                if responder not in results:
                    results[responder] = {
                        "author": responder,
                        "first_responses": 0,
                        "total_words": 0
                    }
                
                results[responder]["first_responses"] += 1
                results[responder]["total_words"] += first_comment.get("word_count", 0)
            
            # Finalize
            final_results = []
            for data in results.values():
                data["avg_first_response_length"] = data["total_words"] / data["first_responses"]
                final_results.append(data)
                
            return final_results
    
    async def compute_all_metrics(
        self, 
        repo_names: List[str] = None,
        days: int = 90
    ) -> List[InvisibleLaborMetrics]:
        """
        Compute all invisible labor metrics for users.
        
        Args:
            repo_names: Optional list of repositories to analyze
            days: Number of days to look back
            
        Returns:
            List of InvisibleLaborMetrics for each user
        """
        # Fetch data
        reviews = await self.fetch_review_data(repo_names, days)
        comments = await self.fetch_comment_data(repo_names, days)
        triage = await self.fetch_triage_data(repo_names, days)
        
        # Compute individual metrics
        review_metrics = self.compute_review_metrics(reviews)
        mentorship_metrics = self.compute_mentorship_metrics(comments)
        
        # Combine metrics
        spark = get_or_create_spark_session()
        
        # Start with unique users
        all_users = set()
        if review_metrics:
            all_users.update([r.reviewer for r in review_metrics.select("reviewer").collect()])
        if mentorship_metrics:
            all_users.update([r.author for r in mentorship_metrics.select("author").collect()])
        
        period_start = datetime.now(timezone.utc) - timedelta(days=days)
        period_end = datetime.now(timezone.utc)
        
        results = []
        for username in all_users:
            if not username:
                continue
            
            metrics = InvisibleLaborMetrics(
                user_id=username,
                username=username,
                period_start=period_start,
                period_end=period_end
            )
            
            
            # Extract review metrics - Handle Spark Row or Python Dict
            if review_metrics:
                if isinstance(review_metrics, list):
                     for r in review_metrics:
                         if r.get("reviewer") == username:
                             metrics.review_count = r.get("review_count", 0)
                             metrics.review_depth_score = float(r.get("review_depth_score", 0))
                             break
                else:
                    user_review = review_metrics.filter(col("reviewer") == username).first()
                    if user_review:
                        metrics.review_count = user_review.review_count or 0
                        metrics.review_depth_score = float(user_review.review_depth_score or 0)
            
            # Extract mentorship metrics - Handle Spark Row or Python Dict
            if mentorship_metrics:
                if isinstance(mentorship_metrics, list):
                    for m in mentorship_metrics:
                        if m.get("author") == username:
                            metrics.mentorship_comments = m.get("mentorship_comments", 0)
                            metrics.helpful_responses = m.get("helpful_responses", 0)
                            break
                else:
                    user_mentorship = mentorship_metrics.filter(col("author") == username).first()
                    if user_mentorship:
                        metrics.mentorship_comments = user_mentorship.mentorship_comments or 0
                        metrics.helpful_responses = user_mentorship.helpful_responses or 0

            # Calculate total score
            metrics.total_invisible_labor_score = (
                (metrics.review_depth_score * 2) +
                (metrics.mentorship_comments * 3) +
                (metrics.helpful_responses * 2) +
                (metrics.first_responses * 1.5) +
                (metrics.issues_triaged * 1)
            )
            
            results.append(metrics)
        
        # Sort by total score
        results.sort(key=lambda x: x.total_invisible_labor_score, reverse=True)
        
        logger.info(f"Computed invisible labor metrics for {len(results)} users")
        return results
    
    async def get_top_contributors(
        self,
        repo_names: List[str] = None,
        days: int = 90,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get top invisible labor contributors.
        
        Returns:
            List of top contributors with their metrics
        """
        metrics = await self.compute_all_metrics(repo_names, days)
        
        return [m.model_dump() for m in metrics[:limit]]
    
    async def get_user_metrics(self, username: str, days: int = 90) -> Optional[InvisibleLaborMetrics]:
        """
        Get invisible labor metrics for a specific user.
        """
        all_metrics = await self.compute_all_metrics(days=days)
        
        for m in all_metrics:
            if m.username == username:
                return m
        
        return None
    
    async def get_repo_summary(
        self,
        repo_name: str,
        days: int = 90
    ) -> Dict[str, Any]:
        """
        Get invisible labor summary for a repository.
        """
        metrics = await self.compute_all_metrics([repo_name], days)
        
        if not metrics:
            return {
                "repo_name": repo_name,
                "period_days": days,
                "total_contributors": 0,
                "total_invisible_labor_score": 0
            }
        
        return {
            "repo_name": repo_name,
            "period_days": days,
            "total_contributors": len(metrics),
            "total_invisible_labor_score": sum(m.total_invisible_labor_score for m in metrics),
            "top_contributors": [m.model_dump() for m in metrics[:5]],
            "avg_score_per_contributor": sum(m.total_invisible_labor_score for m in metrics) / len(metrics)
        }


# Singleton instance
invisible_labor_analytics = InvisibleLaborAnalytics()
