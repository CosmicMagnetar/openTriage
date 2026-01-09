"""
Spark Analytics Module for OpenTriage.
Provides advanced analytics using Spark transformations, window functions,
aggregations, and caching for performance optimization.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import (
    col, count, avg, sum as spark_sum, max as spark_max, min as spark_min,
    datediff, current_date, when, lit, row_number, lag, lead,
    to_date, date_trunc, coalesce, explode, split, lower, trim,
    collect_list, first, last, desc, asc, percentile_approx
)
from pyspark.sql.window import Window
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, 
    TimestampType, FloatType, BooleanType, ArrayType
)

from spark_manager import get_or_create_spark_session

logger = logging.getLogger(__name__)


class SparkAnalytics:
    """
    Advanced analytics engine using Apache Spark.
    
    Features:
    - Window functions for trend analysis
    - Aggregations with caching
    - Broadcast joins for lookups
    - Time-series analysis
    """
    
    def __init__(self):
        self.spark: Optional[SparkSession] = None
        self._cache: Dict[str, DataFrame] = {}
    
    def _get_spark(self) -> SparkSession:
        """Get or create Spark session."""
        if self.spark is None:
            self.spark = get_or_create_spark_session()
        return self.spark
    
    def analyze_contribution_trends(
        self, 
        contributions: List[Dict[str, Any]],
        window_days: int = 7
    ) -> Dict[str, Any]:
        """
        Analyze contribution trends using window functions.
        
        Args:
            contributions: List of contribution records
            window_days: Rolling window size in days
            
        Returns:
            Analytics summary with trends
        """
        spark = self._get_spark()
        
        if not contributions:
            return {"error": "No contributions to analyze"}
        
        # Create DataFrame
        df = spark.createDataFrame(contributions)
        
        # Cache for repeated operations
        df.cache()
        
        # Window specs for trend analysis
        window_by_date = Window.orderBy("date").rowsBetween(-window_days + 1, 0)
        window_by_user = Window.partitionBy("authorName").orderBy("date")
        
        # Calculate rolling metrics
        trends_df = df.withColumn(
            "rolling_count",
            count("*").over(window_by_date)
        ).withColumn(
            "rolling_avg_per_day",
            avg(lit(1)).over(window_by_date)
        ).withColumn(
            "contribution_rank",
            row_number().over(window_by_user)
        ).withColumn(
            "days_since_last",
            datediff(
                col("date"),
                lag("date", 1).over(window_by_user)
            )
        )
        
        # Aggregate results
        result = {
            "total_contributions": df.count(),
            "unique_contributors": df.select("authorName").distinct().count(),
            "avg_contributions_per_user": df.groupBy("authorName").count().agg(
                avg("count")
            ).collect()[0][0],
            "trends": trends_df.select(
                "date", "rolling_count", "rolling_avg_per_day"
            ).distinct().orderBy(desc("date")).limit(30).collect()
        }
        
        # Unpersist cached data
        df.unpersist()
        
        return result
    
    def calculate_repository_health(
        self,
        issues: List[Dict[str, Any]],
        prs: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculate repository health score using multiple metrics.
        
        Metrics include:
        - Issue resolution time
        - PR merge rate
        - Activity frequency
        - Sentiment distribution
        """
        spark = self._get_spark()
        
        if not issues and not prs:
            return {"health_score": 0, "metrics": {}}
        
        # Create DataFrames
        issues_df = spark.createDataFrame(issues) if issues else None
        prs_df = spark.createDataFrame(prs) if prs else None
        
        metrics = {}
        
        if issues_df:
            issues_df.cache()
            
            # Issue resolution metrics
            open_issues = issues_df.filter(col("state") == "open").count()
            closed_issues = issues_df.filter(col("state") == "closed").count()
            total_issues = open_issues + closed_issues
            
            metrics["issue_close_rate"] = (
                closed_issues / total_issues if total_issues > 0 else 0
            )
            metrics["open_issues"] = open_issues
            metrics["closed_issues"] = closed_issues
            
            issues_df.unpersist()
        
        if prs_df:
            prs_df.cache()
            
            # PR metrics
            merged_prs = prs_df.filter(col("state") == "closed").count()
            open_prs = prs_df.filter(col("state") == "open").count()
            total_prs = merged_prs + open_prs
            
            metrics["pr_merge_rate"] = (
                merged_prs / total_prs if total_prs > 0 else 0
            )
            metrics["open_prs"] = open_prs
            metrics["merged_prs"] = merged_prs
            
            prs_df.unpersist()
        
        # Calculate composite health score (0-100)
        health_score = 0
        weights = {"issue_close_rate": 30, "pr_merge_rate": 40}
        
        for metric, weight in weights.items():
            if metric in metrics:
                health_score += metrics[metric] * weight
        
        # Activity bonus (up to 30 points)
        total_activity = (
            metrics.get("open_issues", 0) + 
            metrics.get("closed_issues", 0) +
            metrics.get("open_prs", 0) +
            metrics.get("merged_prs", 0)
        )
        activity_score = min(30, total_activity / 10 * 30)
        health_score += activity_score
        
        return {
            "health_score": round(health_score, 1),
            "metrics": metrics,
            "activity_level": (
                "high" if total_activity > 50 
                else "medium" if total_activity > 20 
                else "low"
            )
        }
    
    def analyze_contributor_activity(
        self,
        contributions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze contributor activity patterns with clustering.
        
        Uses window functions to identify:
        - Most active contributors
        - Contribution streaks
        - Peak activity times
        """
        spark = self._get_spark()
        
        if not contributions:
            return {"contributors": [], "patterns": {}}
        
        df = spark.createDataFrame(contributions)
        df.cache()
        
        # Window for user-level analysis
        user_window = Window.partitionBy("authorName").orderBy("createdAt")
        
        # Calculate per-user metrics
        user_metrics = df.groupBy("authorName").agg(
            count("*").alias("total_contributions"),
            spark_min("createdAt").alias("first_contribution"),
            spark_max("createdAt").alias("last_contribution"),
            count(when(col("isPR") == True, 1)).alias("pr_count"),
            count(when(col("isPR") == False, 1)).alias("issue_count")
        ).withColumn(
            "contribution_rate",
            col("total_contributions") / when(
                datediff(col("last_contribution"), col("first_contribution")) > 0,
                datediff(col("last_contribution"), col("first_contribution"))
            ).otherwise(1)
        )
        
        # Rank contributors
        ranked = user_metrics.withColumn(
            "rank",
            row_number().over(Window.orderBy(desc("total_contributions")))
        )
        
        # Get top contributors
        top_contributors = ranked.filter(col("rank") <= 10).collect()
        
        # Activity patterns
        patterns = {
            "total_contributions": df.count(),
            "total_contributors": df.select("authorName").distinct().count(),
            "pr_ratio": df.filter(col("isPR") == True).count() / df.count() if df.count() > 0 else 0,
            "avg_per_contributor": df.count() / df.select("authorName").distinct().count() if df.select("authorName").distinct().count() > 0 else 0
        }
        
        df.unpersist()
        
        return {
            "top_contributors": [
                {
                    "username": row["authorName"],
                    "contributions": row["total_contributions"],
                    "prs": row["pr_count"],
                    "issues": row["issue_count"],
                    "rate": round(row["contribution_rate"], 2)
                }
                for row in top_contributors
            ],
            "patterns": patterns
        }
    
    def generate_weekly_report(
        self,
        issues: List[Dict[str, Any]],
        prs: List[Dict[str, Any]],
        sentiments: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive weekly analytics report.
        
        Combines multiple analyses into a single report using
        Spark aggregations and window functions.
        """
        spark = self._get_spark()
        
        report = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": "weekly",
            "summary": {},
            "trends": [],
            "highlights": []
        }
        
        all_items = issues + prs
        if not all_items:
            report["summary"] = {"message": "No data for this period"}
            return report
        
        df = spark.createDataFrame(all_items)
        df.cache()
        
        # Summary statistics
        report["summary"] = {
            "total_items": df.count(),
            "new_issues": df.filter(
                (col("isPR") == False) & (col("state") == "open")
            ).count(),
            "new_prs": df.filter(
                (col("isPR") == True) & (col("state") == "open")
            ).count(),
            "closed_items": df.filter(col("state") == "closed").count(),
            "unique_repos": df.select("repoName").distinct().count(),
            "unique_authors": df.select("authorName").distinct().count()
        }
        
        # Daily trends using window
        daily_window = Window.orderBy("day")
        daily_df = df.withColumn(
            "day",
            to_date(col("createdAt"))
        ).groupBy("day").agg(
            count("*").alias("count"),
            count(when(col("isPR") == True, 1)).alias("prs"),
            count(when(col("isPR") == False, 1)).alias("issues")
        ).withColumn(
            "cumulative",
            spark_sum("count").over(daily_window)
        ).orderBy("day")
        
        report["trends"] = [
            {
                "date": str(row["day"]),
                "count": row["count"],
                "prs": row["prs"],
                "issues": row["issues"],
                "cumulative": row["cumulative"]
            }
            for row in daily_df.collect()
        ]
        
        # Highlights
        most_active_repo = df.groupBy("repoName").count().orderBy(
            desc("count")
        ).first()
        if most_active_repo:
            report["highlights"].append({
                "type": "most_active_repo",
                "repo": most_active_repo["repoName"],
                "activity_count": most_active_repo["count"]
            })
        
        most_active_author = df.groupBy("authorName").count().orderBy(
            desc("count")
        ).first()
        if most_active_author:
            report["highlights"].append({
                "type": "most_active_contributor",
                "username": most_active_author["authorName"],
                "contribution_count": most_active_author["count"]
            })
        
        df.unpersist()
        
        return report


# Singleton instance
spark_analytics = SparkAnalytics()
