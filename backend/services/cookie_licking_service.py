"""
Cookie-Licking Service for OpenTriage.
Uses Spark to monitor claimed issues and automatically release them if no progress is detected.
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from threading import Thread
import asyncio

from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    col, current_timestamp, lit, when, datediff, 
    unix_timestamp, from_unixtime, hour, minute
)
from pyspark.sql.types import (
    StructType, StructField, StringType, TimestampType, 
    BooleanType, IntegerType
)

from spark_manager import get_or_create_spark_session

logger = logging.getLogger(__name__)


# Schema for claimed issues
CLAIMED_ISSUE_SCHEMA = StructType([
    StructField("issue_id", StringType(), False),
    StructField("github_issue_id", IntegerType(), False),
    StructField("repo_name", StringType(), False),
    StructField("issue_number", IntegerType(), False),
    StructField("title", StringType(), True),
    StructField("claimed_by", StringType(), False),
    StructField("claimed_at", TimestampType(), False),
    StructField("last_activity_at", TimestampType(), True),
    StructField("has_linked_pr", BooleanType(), True),
    StructField("has_recent_commits", BooleanType(), True),
    StructField("comment_count", IntegerType(), True)
])


class CookieLickingService:
    """
    Service for monitoring and auto-releasing claimed issues.
    
    "Cookie-licking" refers to the practice of claiming an issue without
    making progress, effectively blocking others from working on it.
    This service detects stale claims and releases them automatically.
    """
    
    def __init__(self, 
                 expiry_hours: int = 48,
                 activity_window_hours: int = 24,
                 scan_interval_minutes: int = 15):
        """
        Initialize the cookie-licking service.
        
        Args:
            expiry_hours: Hours before a claim expires without any progress
            activity_window_hours: Hours to look back for activity detection
            scan_interval_minutes: How often to run the background scan
        """
        self.expiry_hours = expiry_hours
        self.activity_window_hours = activity_window_hours
        self.scan_interval_minutes = scan_interval_minutes
        self._background_thread: Optional[Thread] = None
        self._is_running: bool = False
        self._on_release_callback = None
    
    def set_release_callback(self, callback):
        """
        Set callback function called when issues are auto-released.
        
        Args:
            callback: Async function(issue_ids: list) to handle releases
        """
        self._on_release_callback = callback
    
    async def get_claimed_issues(self, repo_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch all currently claimed issues from MongoDB.
        
        Args:
            repo_name: Optional filter by repository name
            
        Returns:
            List of claimed issue records
        """
        from config.database import db
        
        # Query for claimed issues
        cursor = db.claimed_issues.find({}, {"_id": 0})
        claimed = await cursor.to_list(length=None)
        
        # Enrich with activity data
        enriched = []
        for claim in claimed:
            issue_id = claim.get("issueId") or claim.get("issue_id")
            
            # Get issue details
            issue = await db.issues.find_one(
                {"id": issue_id},
                {"_id": 0}
            )
            
            if not issue:
                continue
            
            issue_repo = issue.get("repoName", "")
            
            # Apply repo filter if specified
            if repo_name and issue_repo != repo_name:
                continue
            
            # Check for linked PRs
            has_linked_pr = await self._check_linked_pr(
                db, 
                issue_repo,
                issue.get("number", 0)
            )
            
            # Check recent comments by claimant
            comment_count = await self._count_recent_comments(
                db,
                issue_id,
                claim.get("claimedBy") or claim.get("claimed_by", ""),
                self.activity_window_hours
            )
            
            enriched.append({
                "issue_id": issue_id,
                "github_issue_id": issue.get("githubIssueId", 0),
                "repo_name": issue_repo,
                "issue_number": issue.get("number", 0),
                "title": issue.get("title", ""),
                "claimed_by": claim.get("claimedBy") or claim.get("claimed_by", ""),
                "claimed_at": claim.get("claimedAt") or claim.get("claimed_at"),
                "last_activity_at": claim.get("lastActivityAt") or claim.get("last_activity_at"),
                "has_linked_pr": has_linked_pr,
                "has_recent_commits": False,  # Would need GitHub API check
                "comment_count": comment_count
            })
        
        return enriched
    
    async def _check_linked_pr(self, db, repo_name: str, issue_number: int) -> bool:
        """Check if there's a PR linked to this issue."""
        # Look for PRs that reference this issue
        pr = await db.issues.find_one({
            "repoName": repo_name,
            "isPR": True,
            "$or": [
                {"body": {"$regex": f"#{issue_number}"}},
                {"body": {"$regex": f"fixes #{issue_number}", "$options": "i"}},
                {"body": {"$regex": f"closes #{issue_number}", "$options": "i"}}
            ]
        })
        return pr is not None
    
    async def _count_recent_comments(
        self, db, issue_id: str, author: str, hours: int
    ) -> int:
        """Count comments by author on issue in recent hours."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        count = await db.comments.count_documents({
            "issueId": issue_id,
            "author": author,
            "createdAt": {"$gte": cutoff.isoformat()}
        })
        return count
    
    def analyze_claims_with_spark(self, claimed_issues: List[Dict[str, Any]]) -> Any:
        """
        Analyze claimed issues using Spark SQL or Python fallback.
        
        Args:
            claimed_issues: List of claimed issue records
            
        Returns:
            DataFrame (if Spark) or List[Dict] (if Python) with expiry analysis
        """
        if not claimed_issues:
            return None
        
        # Convert timestamps to proper format
        for issue in claimed_issues:
            if isinstance(issue.get("claimed_at"), str):
                issue["claimed_at"] = datetime.fromisoformat(
                    issue["claimed_at"].replace("Z", "+00:00")
                )
            if isinstance(issue.get("last_activity_at"), str):
                issue["last_activity_at"] = datetime.fromisoformat(
                    issue["last_activity_at"].replace("Z", "+00:00")
                )
            elif issue.get("last_activity_at") is None:
                issue["last_activity_at"] = issue.get("claimed_at")

        try:
            spark = get_or_create_spark_session()
            if spark:
                 return self._analyze_with_spark(spark, claimed_issues)
        except Exception as e:
            logger.warning(f"Spark not available, using Python fallback: {e}")
            
        return self._analyze_with_python(claimed_issues)

    def _analyze_with_spark(self, spark, claimed_issues):
        """Internal Spark analysis logic"""
        # Create DataFrame
        df = spark.createDataFrame(claimed_issues, schema=CLAIMED_ISSUE_SCHEMA)
        
        # Register as temp view for SQL
        df.createOrReplaceTempView("claimed_issues")
        
        # Analyze with Spark SQL
        analysis_query = f"""
        SELECT 
            issue_id,
            github_issue_id,
            repo_name,
            issue_number,
            title,
            claimed_by,
            claimed_at,
            last_activity_at,
            has_linked_pr,
            has_recent_commits,
            comment_count,
            
            -- Calculate expiry time
            TIMESTAMPADD(HOUR, {self.expiry_hours}, claimed_at) as expiry_time,
            
            -- Calculate hours since claim
            TIMESTAMPDIFF(HOUR, claimed_at, current_timestamp()) as hours_since_claim,
            
            -- Calculate hours since last activity
            TIMESTAMPDIFF(HOUR, last_activity_at, current_timestamp()) as hours_since_activity,
            
            -- Determine progress indicators
            CASE
                WHEN has_linked_pr = TRUE THEN 'pr_linked'
                WHEN has_recent_commits = TRUE THEN 'commits_detected'
                WHEN comment_count > 0 THEN 'comments_made'
                ELSE 'no_progress'
            END as progress_status,
            
            -- Determine expiry status
            CASE 
                WHEN has_linked_pr = TRUE THEN 'active_with_pr'
                WHEN comment_count >= 3 THEN 'active_engaged'
                WHEN current_timestamp() > TIMESTAMPADD(HOUR, {self.expiry_hours}, claimed_at) 
                     AND comment_count = 0 
                THEN 'expired_no_activity'
                WHEN current_timestamp() > TIMESTAMPADD(HOUR, {self.expiry_hours}, claimed_at) 
                THEN 'expired'
                WHEN TIMESTAMPDIFF(HOUR, last_activity_at, current_timestamp()) > {self.activity_window_hours}
                THEN 'at_risk'
                ELSE 'active'
            END as claim_status
        FROM claimed_issues
        ORDER BY 
            CASE 
                WHEN has_linked_pr = TRUE THEN 4
                WHEN comment_count >= 3 THEN 3
                WHEN current_timestamp() > TIMESTAMPADD(HOUR, {self.expiry_hours}, claimed_at) THEN 0
                WHEN TIMESTAMPDIFF(HOUR, last_activity_at, current_timestamp()) > {self.activity_window_hours} THEN 1
                ELSE 2
            END,
            claimed_at ASC
        """
        
        result_df = spark.sql(analysis_query)
        # logger.info(f"Analyzed {result_df.count()} claimed issues")
        return result_df

    def _analyze_with_python(self, claimed_issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Python fallback analysis logic"""
        now = datetime.now(timezone.utc)
        results = []
        
        for issue in claimed_issues:
            # Calculate metrics
            claimed_at = issue['claimed_at']
            # Ensure timezone awareness
            if claimed_at.tzinfo is None:
                claimed_at = claimed_at.replace(tzinfo=timezone.utc)
                
            last_activity_at = issue['last_activity_at']
            if last_activity_at.tzinfo is None:
                last_activity_at = last_activity_at.replace(tzinfo=timezone.utc)
                
            expiry_time = claimed_at + timedelta(hours=self.expiry_hours)
            hours_since_claim = (now - claimed_at).total_seconds() / 3600
            hours_since_activity = (now - last_activity_at).total_seconds() / 3600
            
            # Determine status
            claim_status = 'active'
            progress_status = 'no_progress'
            
            if issue.get('has_linked_pr'):
                progress_status = 'pr_linked'
                claim_status = 'active_with_pr'
            elif issue.get('has_recent_commits'):
                progress_status = 'commits_detected'
            elif issue.get('comment_count', 0) > 0:
                progress_status = 'comments_made'
                
            if claim_status == 'active':
                if issue.get('comment_count', 0) >= 3:
                     claim_status = 'active_engaged'
                elif now > expiry_time:
                    if issue.get('comment_count', 0) == 0:
                        claim_status = 'expired_no_activity'
                    else:
                        claim_status = 'expired'
                elif hours_since_activity > self.activity_window_hours:
                    claim_status = 'at_risk'
            
            # Enrich dict
            enriched = issue.copy()
            enriched.update({
                'expiry_time': expiry_time,
                'hours_since_claim': hours_since_claim,
                'hours_since_activity': hours_since_activity,
                'progress_status': progress_status,
                'claim_status': claim_status,
                # Add sorting weight for consistency with SQL
                '_sort_weight': 4 if issue.get('has_linked_pr') else (
                    3 if issue.get('comment_count', 0) >= 3 else (
                        0 if now > expiry_time else (
                            1 if hours_since_activity > self.activity_window_hours else 2
                        )
                    )
                )
            })
            results.append(enriched)
            
        # Sort
        results.sort(key=lambda x: (x['_sort_weight'], x['claimed_at']))
        return results
    
    async def get_expired_claims(self) -> List[Dict[str, Any]]:
        """
        Get list of expired claims that should be auto-released.
        
        Returns:
            List of expired claim records
        """
        claimed_issues = await self.get_claimed_issues()
        
        if not claimed_issues:
            return []
        
        result = self.analyze_claims_with_spark(claimed_issues)
        
        if result is None:
            return []
            
        expired = []
        # Check if result is Spark DataFrame (has 'filter' method)
        if hasattr(result, 'filter'):
             # Filter for expired claims
            expired_df = result.filter(
                (col("claim_status") == "expired_no_activity") |
                (col("claim_status") == "expired")
            )
            # Convert to list
            expired = [row.asDict() for row in expired_df.collect()]
        else:
             # Python list of dicts
             expired = [
                 item for item in result 
                 if item.get("claim_status") in ["expired_no_activity", "expired"]
             ]
        
        return expired
    
    async def release_expired_claims(self) -> Dict[str, Any]:
        """
        Find and release all expired claims.
        
        Returns:
            Summary of released claims
        """
        from config.database import db
        
        expired = await self.get_expired_claims()
        
        if not expired:
            return {"released": 0, "issues": []}
        
        released_ids = []
        
        for claim in expired:
            issue_id = claim["issue_id"]
            
            # Remove claim from database
            result = await db.claimed_issues.delete_one({
                "$or": [
                    {"issueId": issue_id},
                    {"issue_id": issue_id}
                ]
            })
            
            if result.deleted_count > 0:
                released_ids.append(issue_id)
                logger.info(
                    f"Auto-released claim on issue #{claim['issue_number']} "
                    f"in {claim['repo_name']} (claimed by {claim['claimed_by']})"
                )
        
        # Call release callback if set
        if self._on_release_callback and released_ids:
            await self._on_release_callback(released_ids)
        
        return {
            "released": len(released_ids),
            "issues": released_ids,
            "details": expired
        }
    
    async def get_at_risk_claims(self, repo_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get claims that are at risk of expiring soon.
        
        Args:
            repo_name: Optional filter by repository name
            
        Returns:
            List of at-risk claim records
        """
        claimed_issues = await self.get_claimed_issues(repo_name=repo_name)
        
        if not claimed_issues:
            return []
        
        result = self.analyze_claims_with_spark(claimed_issues)
        
        if result is None:
            return []
        
        if hasattr(result, 'filter'):
            at_risk_df = result.filter(col("claim_status") == "at_risk")
            return [row.asDict() for row in at_risk_df.collect()]
        else:
            return [
                item for item in result 
                if item.get("claim_status") == "at_risk"
            ]
    
    async def get_claim_statistics(self, repo_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get overall claim statistics.
        
        Args:
            repo_name: Optional filter by repository name
            
        Returns:
            Statistics about all current claims
        """
        claimed_issues = await self.get_claimed_issues(repo_name=repo_name)
        
        if not claimed_issues:
            return {
                "total_claims": 0,
                "active": 0,
                "at_risk": 0,
                "expired": 0,
                "with_pr": 0
            }
        
        result = self.analyze_claims_with_spark(claimed_issues)
        
        if result is None:
            return {"total_claims": 0}
            
        stats = {}
        total_count = 0
        
        if hasattr(result, 'filter'):
            # Aggregate stats with Spark
            stats_df = result.groupBy("claim_status").count()
            stats = {row["claim_status"]: row["count"] for row in stats_df.collect()}
            total_count = result.count()
        else:
            # Aggregate stats with Python
            total_count = len(result)
            for item in result:
                status = item.get("claim_status", "unknown")
                stats[status] = stats.get(status, 0) + 1
        
        return {
            "total_claims": total_count,
            "active": stats.get("active", 0) + stats.get("active_with_pr", 0) + stats.get("active_engaged", 0),
            "at_risk": stats.get("at_risk", 0),
            "expired": stats.get("expired", 0) + stats.get("expired_no_activity", 0),
            "with_pr": stats.get("active_with_pr", 0),
            "breakdown": stats
        }
    
    def start_background_scan(self):
        """Start background scanning for expired claims."""
        if self._is_running:
            logger.warning("Background scan already running")
            return
        
        self._is_running = True
        self._background_thread = Thread(target=self._run_background_scan, daemon=True)
        self._background_thread.start()
        logger.info(f"Started cookie-licking background scan (every {self.scan_interval_minutes} minutes)")
    
    def stop_background_scan(self):
        """Stop background scanning."""
        self._is_running = False
        if self._background_thread:
            self._background_thread.join(timeout=5.0)
        logger.info("Stopped cookie-licking background scan")
    
    def _run_background_scan(self):
        """Background scan loop."""
        import time
        
        while self._is_running:
            try:
                # Run release check
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                result = loop.run_until_complete(self.release_expired_claims())
                
                if result["released"] > 0:
                    logger.info(f"Background scan released {result['released']} expired claims")
                
            except Exception as e:
                logger.error(f"Error in background scan: {e}")
            
            # Sleep until next scan
            time.sleep(self.scan_interval_minutes * 60)


# Singleton instance with default settings
cookie_licking_service = CookieLickingService(
    expiry_hours=48,
    activity_window_hours=24,
    scan_interval_minutes=15
)
