"""
Gamification Engine for OpenTriage.
Uses Spark to calculate contribution streaks and Impact Calendar data.
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from pyspark.sql import SparkSession, DataFrame, Window
from pyspark.sql.functions import (
    col, count, sum as spark_sum, avg, min as spark_min, max as spark_max,
    datediff, when, lit, current_timestamp, to_date, date_format,
    row_number, dense_rank, lag, lead, first, last,
    collect_list, size, array_distinct, explode, struct,
    dayofweek, weekofyear, month, year, dayofyear,
    coalesce, greatest
)
from pyspark.sql.types import (
    StructType, StructField, StringType, TimestampType, 
    IntegerType, FloatType, DateType, ArrayType
)

from spark_manager import get_or_create_spark_session

logger = logging.getLogger(__name__)


class ContributionStreak(BaseModel):
    """Model for contribution streak data."""
    user_id: str
    username: str
    current_streak: int = 0
    longest_streak: int = 0
    streak_start_date: Optional[str] = None
    last_contribution_date: Optional[str] = None
    is_active: bool = False
    total_contribution_days: int = 0


class ImpactCalendarDay(BaseModel):
    """Model for a single day in the Impact Calendar."""
    date: str
    issues: int = 0
    prs: int = 0
    comments: int = 0
    reviews: int = 0
    total: int = 0
    level: int = 0  # 0-4 for heatmap intensity


class GamificationEngine:
    """
    Engine for calculating gamification metrics using Spark.
    
    Features:
    - Contribution streaks (consecutive days of activity)
    - Impact Calendar (heatmap-ready contribution data)
    - Achievement badges based on activity patterns
    """
    
    def __init__(self):
        self.activity_types = ["issue", "pr", "comment", "review"]
    
    async def fetch_user_activities(
        self, 
        username: str = None,
        days: int = 365
    ) -> List[Dict[str, Any]]:
        """
        Fetch user activity data from MongoDB.
        
        Args:
            username: Optional specific user to fetch
            days: Number of days to look back
            
        Returns:
            List of activity records
        """
        from config.database import db
        
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        activities = []
        
        # Fetch issues created
        issue_query = {"isPR": False}
        if username:
            issue_query["authorName"] = username
        
        cursor = db.issues.find(issue_query, {"_id": 0})
        issues = await cursor.to_list(length=None)
        
        for issue in issues:
            created_at = issue.get("createdAt")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            
            activities.append({
                "user_id": issue.get("authorName"),
                "activity_type": "issue",
                "activity_date": created_at.date() if created_at else None,
                "activity_timestamp": created_at,
                "repo_name": issue.get("repoName", ""),
                "item_id": issue.get("id", ""),
                "item_number": issue.get("number", 0)
            })
        
        # Fetch PRs created
        pr_query = {"isPR": True}
        if username:
            pr_query["authorName"] = username
        
        cursor = db.issues.find(pr_query, {"_id": 0})
        prs = await cursor.to_list(length=None)
        
        for pr in prs:
            created_at = pr.get("createdAt")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            
            activities.append({
                "user_id": pr.get("authorName"),
                "activity_type": "pr",
                "activity_date": created_at.date() if created_at else None,
                "activity_timestamp": created_at,
                "repo_name": pr.get("repoName", ""),
                "item_id": pr.get("id", ""),
                "item_number": pr.get("number", 0)
            })
        
        # Fetch comments
        comment_query = {}
        if username:
            comment_query["author"] = username
        
        cursor = db.comments.find(comment_query, {"_id": 0})
        comments = await cursor.to_list(length=None)
        
        for comment in comments:
            created_at = comment.get("createdAt")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                except:
                    created_at = None
            
            activities.append({
                "user_id": comment.get("author"),
                "activity_type": "comment",
                "activity_date": created_at.date() if created_at else None,
                "activity_timestamp": created_at,
                "repo_name": comment.get("repoName", ""),
                "item_id": comment.get("issueId", ""),
                "item_number": 0
            })
        
        # Filter by date
        activities = [
            a for a in activities 
            if a.get("activity_date") and a["activity_date"] >= cutoff.date()
        ]
        
        return activities
    
    def calculate_streaks(self, activities: List[Dict[str, Any]]) -> DataFrame:
        """
        Calculate contribution streaks using Spark window functions.
        
        Args:
            activities: List of activity records
            
        Returns:
            DataFrame with streak data per user
        """
        if not activities:
            return None
        
        try:
            spark = get_or_create_spark_session()
        except Exception:
            spark = None
            
        if spark:
            # Spark Logic
            
            # Create DataFrame
            df = spark.createDataFrame(activities)
            
            # Get unique activity dates per user
            daily_df = df.filter(
                col("activity_date").isNotNull()
            ).groupBy(
                "user_id", "activity_date"
            ).agg(
                count("*").alias("activity_count")
            )
            
            # Order by date for streak calculation
            window_spec = Window.partitionBy("user_id").orderBy("activity_date")
            
            # Calculate date differences to find consecutive days
            streak_df = daily_df.withColumn(
                "prev_date",
                lag("activity_date", 1).over(window_spec)
            ).withColumn(
                "days_gap",
                datediff(col("activity_date"), col("prev_date"))
            ).withColumn(
                "is_consecutive",
                when(col("days_gap") == 1, lit(True)).otherwise(lit(False))
            ).withColumn(
                "streak_break",
                when(~col("is_consecutive"), lit(1)).otherwise(lit(0))
            )
            
            # Assign streak IDs using cumulative sum of breaks
            streak_df = streak_df.withColumn(
                "streak_id",
                spark_sum("streak_break").over(window_spec)
            )
            
            # Calculate streak lengths
            streaks = streak_df.groupBy("user_id", "streak_id").agg(
                count("*").alias("streak_length"),
                spark_min("activity_date").alias("streak_start"),
                spark_max("activity_date").alias("streak_end")
            )
            
            # Find current and longest streaks
            today = datetime.now(timezone.utc).date()
            yesterday = today - timedelta(days=1)
            
            user_streaks = streaks.groupBy("user_id").agg(
                spark_max("streak_length").alias("longest_streak"),
                spark_max("streak_end").alias("last_activity_date"),
                count("*").alias("total_contribution_days")
            )
            
            # Get current streak (streak ending today or yesterday)
            current_streaks = streaks.filter(
                (col("streak_end") == lit(today)) | 
                (col("streak_end") == lit(yesterday))
            ).groupBy("user_id").agg(
                spark_max("streak_length").alias("current_streak"),
                first("streak_start").alias("streak_start_date")
            )
            
            # Join for final result
            result = user_streaks.join(
                current_streaks,
                "user_id",
                "left"
            ).withColumn(
                "current_streak",
                coalesce(col("current_streak"), lit(0))
            ).withColumn(
                "is_active",
                col("current_streak") > 0
            )
            
            return result
        else:
            # Python Logic
            # Group activities by user and date
            user_activities = {}
            for a in activities:
                uid = a.get("user_id")
                date = a.get("activity_date")
                if not uid or not date: continue
                
                if uid not in user_activities:
                    user_activities[uid] = set()
                user_activities[uid].add(date)
            
            results = []
            today = datetime.now(timezone.utc).date()
            yesterday = today - timedelta(days=1)
            
            for uid, dates in user_activities.items():
                sorted_dates = sorted(list(dates))
                if not sorted_dates: continue
                
                # Identify streaks
                streaks = []
                current_streak_len = 0
                current_streak_start = None
                
                prev_date = None
                
                for d in sorted_dates:
                    if prev_date is None:
                        current_streak_len = 1
                        current_streak_start = d
                    elif (d - prev_date).days == 1:
                        current_streak_len += 1
                    else:
                        # Streak broke
                        streaks.append((current_streak_len, current_streak_start, prev_date))
                        current_streak_len = 1
                        current_streak_start = d
                    prev_date = d
                
                # Append last streak
                if current_streak_len > 0:
                    streaks.append((current_streak_len, current_streak_start, prev_date))
                
                # Analyze streaks
                longest = max([s[0] for s in streaks]) if streaks else 0
                last_active = sorted_dates[-1]
                
                # Check current streak
                current_streak = 0
                streak_start = None
                
                last_streak_len, last_streak_start, last_streak_end = streaks[-1]
                if last_streak_end == today or last_streak_end == yesterday:
                    current_streak = last_streak_len
                    streak_start = last_streak_start
                
                results.append({
                    "user_id": uid,
                    "longest_streak": longest,
                    "last_activity_date": last_active,
                    "total_contribution_days": len(dates),
                    "current_streak": current_streak,
                    "streak_start_date": streak_start,
                    "is_active": current_streak > 0
                })
            
            return results
    
    def calculate_impact_calendar(
        self, 
        activities: List[Dict[str, Any]],
        username: str = None
    ) -> DataFrame:
        """
        Calculate Impact Calendar data (GitHub-style contribution heatmap).
        
        Args:
            activities: List of activity records
            username: Optional filter for specific user
            
        Returns:
            DataFrame with daily contribution data
        """
        if not activities:
            return None
        
        try:
            spark = get_or_create_spark_session()
        except Exception:
            spark = None
            
        if spark:
            # Spark Logic
            df = spark.createDataFrame(activities)
            
            # Aggregate by date and activity type
            daily_df = df.filter(
                col("activity_date").isNotNull()
            ).groupBy(
                "user_id", "activity_date"
            ).agg(
                spark_sum(when(col("activity_type") == "issue", 1).otherwise(0)).alias("issues"),
                spark_sum(when(col("activity_type") == "pr", 1).otherwise(0)).alias("prs"),
                spark_sum(when(col("activity_type") == "comment", 1).otherwise(0)).alias("comments"),
                spark_sum(when(col("activity_type") == "review", 1).otherwise(0)).alias("reviews"),
                count("*").alias("total")
            )
            
            # Calculate contribution level (0-4) for heatmap
            daily_df = daily_df.withColumn(
                "level",
                when(col("total") == 0, lit(0))
                .when(col("total") <= 2, lit(1))
                .when(col("total") <= 5, lit(2))
                .when(col("total") <= 10, lit(3))
                .otherwise(lit(4))
            )
            
            # Add date formatting for calendar display
            daily_df = daily_df.withColumn(
                "date_str",
                date_format(col("activity_date"), "yyyy-MM-dd")
            ).withColumn(
                "day_of_week",
                dayofweek(col("activity_date"))
            ).withColumn(
                "week_of_year",
                weekofyear(col("activity_date"))
            )
            
            return daily_df
        else:
            # Python Logic
            # Filter by user if specified
            if username:
                activities = [a for a in activities if a["user_id"] == username]
            
            if not activities:
                return []
                
            # Aggregate by date
            daily_stats = {}
            for a in activities:
                date = a.get("activity_date")
                if not date: continue
                
                if date not in daily_stats:
                    daily_stats[date] = {
                        "user_id": a.get("user_id"),
                        "activity_date": date,
                        "issues": 0, "prs": 0, "comments": 0, "reviews": 0, "total": 0
                    }
                
                atype = a.get("activity_type")
                daily_stats[date]["total"] += 1
                if atype == "issue": daily_stats[date]["issues"] += 1
                elif atype == "pr": daily_stats[date]["prs"] += 1
                elif atype == "comment": daily_stats[date]["comments"] += 1
                elif atype == "review": daily_stats[date]["reviews"] += 1
                
            # Calculate levels
            results = []
            for date, stats in daily_stats.items():
                total = stats["total"]
                if total == 0: level = 0
                elif total <= 2: level = 1
                elif total <= 5: level = 2
                elif total <= 10: level = 3
                else: level = 4
                
                stats["level"] = level
                results.append(stats)
                
            return results
    
    async def get_user_streak(self, username: str, days: int = 365) -> ContributionStreak:
        """
        Get streak data for a specific user.
        
        Args:
            username: User to get streak for
            days: Days to look back
            
        Returns:
            ContributionStreak object
        """
        activities = await self.fetch_user_activities(username=username, days=days)
        
        if not activities:
            return ContributionStreak(user_id=username, username=username)
        
        df = self.calculate_streaks(activities)
        
        if isinstance(df, list):
             # Python List
             user_row = None
             for r in df:
                 if r["user_id"] == username:
                     user_row = r
                     break
             
             if user_row is None:
                return ContributionStreak(user_id=username, username=username)

             return ContributionStreak(
                user_id=username,
                username=username,
                current_streak=user_row.get("current_streak", 0),
                longest_streak=user_row.get("longest_streak", 0),
                streak_start_date=str(user_row.get("streak_start_date")) if user_row.get("streak_start_date") else None,
                last_contribution_date=str(user_row.get("last_activity_date")) if user_row.get("last_activity_date") else None,
                is_active=user_row.get("is_active", False),
                total_contribution_days=user_row.get("total_contribution_days", 0)
            )
        
        if df is None:
            return ContributionStreak(user_id=username, username=username)
        
        user_row = df.filter(col("user_id") == username).first()
        
        if user_row is None:
            return ContributionStreak(user_id=username, username=username)
        
        return ContributionStreak(
            user_id=username,
            username=username,
            current_streak=user_row.current_streak or 0,
            longest_streak=user_row.longest_streak or 0,
            streak_start_date=str(user_row.streak_start_date) if user_row.streak_start_date else None,
            last_contribution_date=str(user_row.last_activity_date) if user_row.last_activity_date else None,
            is_active=user_row.is_active or False,
            total_contribution_days=user_row.total_contribution_days or 0
        )
    
    async def get_user_impact_calendar(
        self, 
        username: str, 
        days: int = 365
    ) -> List[ImpactCalendarDay]:
        """
        Get Impact Calendar data for a user.
        
        Args:
            username: User to get calendar for
            days: Days to include
            
        Returns:
            List of ImpactCalendarDay objects
        """
        activities = await self.fetch_user_activities(username=username, days=days)
        
        if not activities:
            return []
        
        df = self.calculate_impact_calendar(activities, username=username)
        
        if isinstance(df, list):
            # Python List
            rows = sorted(df, key=lambda x: x["activity_date"])
            return [
                ImpactCalendarDay(
                    date=str(row["activity_date"]),
                    issues=row["issues"],
                    prs=row["prs"],
                    comments=row["comments"],
                    reviews=row["reviews"],
                    total=row["total"],
                    level=row["level"]
                )
                for row in rows
            ]
            
        if df is None:
            return []
        
        rows = df.orderBy("activity_date").collect()
        
        return [
            ImpactCalendarDay(
                date=str(row.activity_date),
                issues=row.issues or 0,
                prs=row.prs or 0,
                comments=row.comments or 0,
                reviews=row.reviews or 0,
                total=row.total or 0,
                level=row.level or 0
            )
            for row in rows
        ]
    
    async def get_leaderboard(
        self, 
        days: int = 30,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get contribution leaderboard.
        
        Args:
            days: Days to consider
            limit: Number of top users to return
            
        Returns:
            List of leaderboard entries
        """
        activities = await self.fetch_user_activities(days=days)
        
        if not activities:
            return []
        
        try:
            spark = get_or_create_spark_session()
        except Exception:
            spark = None
            
        if spark:
            # Spark Logic
            df = spark.createDataFrame(activities)
            
            # Calculate scores
            leaderboard = df.filter(
                col("user_id").isNotNull() & (col("user_id") != "")
            ).groupBy("user_id").agg(
                count("*").alias("total_contributions"),
                spark_sum(when(col("activity_type") == "issue", 1).otherwise(0)).alias("issues"),
                spark_sum(when(col("activity_type") == "pr", 2).otherwise(0)).alias("prs"),  # PRs worth more
                spark_sum(when(col("activity_type") == "comment", 1).otherwise(0)).alias("comments"),
                spark_sum(when(col("activity_type") == "review", 2).otherwise(0)).alias("reviews")
            ).withColumn(
                "score",
                col("issues") + (col("prs") * 2) + col("comments") + (col("reviews") * 2)
            ).orderBy(
                col("score").desc()
            ).limit(limit)
            
            rows = leaderboard.collect()
            
            return [
                {
                    "rank": i + 1,
                    "user_id": row.user_id,
                    "score": row.score,
                    "total_contributions": row.total_contributions,
                    "issues": row.issues,
                    "prs": row.prs // 2,  # Adjust back from weighted
                    "comments": row.comments,
                    "reviews": row.reviews // 2
                }
                for i, row in enumerate(rows)
            ]
        else:
            # Python Logic
            if not activities:
                 return []
                 
            user_stats = {}
            for a in activities:
                uid = a.get("user_id")
                if not uid: continue
                
                if uid not in user_stats:
                    user_stats[uid] = {
                        "user_id": uid, 
                        "total_contributions": 0,
                        "issues": 0, "prs": 0, "comments": 0, "reviews": 0
                    }
                
                atype = a.get("activity_type")
                user_stats[uid]["total_contributions"] += 1
                
                if atype == "issue": user_stats[uid]["issues"] += 1
                elif atype == "pr": user_stats[uid]["prs"] += 1
                elif atype == "comment": user_stats[uid]["comments"] += 1
                elif atype == "review": user_stats[uid]["reviews"] += 1
            
            # Calculate scores
            leaderboard = []
            for stats in user_stats.values():
                score = (stats["issues"] * 1) + (stats["prs"] * 2) + (stats["comments"] * 1) + (stats["reviews"] * 2)
                stats["score"] = score
                leaderboard.append(stats)
            
            # Sort and limit
            leaderboard.sort(key=lambda x: x["score"], reverse=True)
            leaderboard = leaderboard[:limit]
            
            # Add rank
            for i, entry in enumerate(leaderboard):
                entry["rank"] = i + 1
            
            return leaderboard
    
    async def get_user_gamification_data(self, username: str) -> Dict[str, Any]:
        """
        Get complete gamification data for a user.
        
        Args:
            username: User to get data for
            
        Returns:
            Complete gamification data including streaks, calendar, and rank
        """
        streak = await self.get_user_streak(username)
        calendar = await self.get_user_impact_calendar(username)
        leaderboard = await self.get_leaderboard(days=30, limit=100)
        
        # Find user's rank
        user_rank = None
        for entry in leaderboard:
            if entry["user_id"] == username:
                user_rank = entry
                break
        
        return {
            "username": username,
            "streak": streak.model_dump(),
            "impact_calendar": [day.model_dump() for day in calendar],
            "leaderboard_rank": user_rank,
            "stats": {
                "total_contribution_days": streak.total_contribution_days,
                "current_streak": streak.current_streak,
                "longest_streak": streak.longest_streak,
                "is_on_fire": streak.current_streak >= 7
            }
        }


# Singleton instance
gamification_engine = GamificationEngine()
