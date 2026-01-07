"""
Trophy/Badge Service for OpenTriage.
Handles achievement checking, trophy awarding, and SVG generation.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from models.trophy import Trophy, TrophyType, TROPHY_METADATA, UserTrophyStats

logger = logging.getLogger(__name__)


class TrophyService:
    """
    Service for managing digital trophies and achievements.
    
    Features:
    - Automatic achievement checking
    - SVG badge generation
    - Shareable trophy URLs
    """
    
    def __init__(self):
        self.achievement_thresholds = {
            TrophyType.FIRST_PR: {"prs_merged": 1},
            TrophyType.PR_MASTER: {"prs_merged": 10},
            TrophyType.PR_LEGEND: {"prs_merged": 50},
            TrophyType.BUG_HUNTER: {"bugs_found": 5},
            TrophyType.BUG_SLAYER: {"bugs_found": 25},
            TrophyType.FIRST_MENTOR: {"mentees_helped": 1},
            TrophyType.MASTER_MENTOR: {"mentees_helped": 10},
            TrophyType.STREAK_STARTER: {"streak_days": 7},
            TrophyType.STREAK_WARRIOR: {"streak_days": 30},
            TrophyType.STREAK_LEGEND: {"streak_days": 100},
            TrophyType.TRIAGE_HELPER: {"issues_triaged": 10},
            TrophyType.TRIAGE_HERO: {"issues_triaged": 50},
            TrophyType.FIRST_REVIEW: {"reviews_given": 1},
            TrophyType.REVIEW_GURU: {"reviews_given": 25},
            TrophyType.WELCOME_COMMITTEE: {"newcomers_welcomed": 5},
        }
    
    async def get_user_trophies(self, user_id: str) -> List[Trophy]:
        """Get all trophies earned by a user."""
        from config.database import db
        
        cursor = db.trophies.find({"user_id": user_id}, {"_id": 0})
        trophies = await cursor.to_list(length=None)
        
        return [Trophy(**t) for t in trophies]
    
    async def get_user_trophy_stats(self, user_id: str, username: str) -> UserTrophyStats:
        """Get trophy statistics for a user."""
        trophies = await self.get_user_trophies(user_id)
        
        stats = UserTrophyStats(
            user_id=user_id,
            username=username,
            total_trophies=len(trophies),
            trophy_ids=[t.id for t in trophies]
        )
        
        for trophy in trophies:
            if trophy.rarity == "common":
                stats.common_count += 1
            elif trophy.rarity == "uncommon":
                stats.uncommon_count += 1
            elif trophy.rarity == "rare":
                stats.rare_count += 1
            elif trophy.rarity == "legendary":
                stats.legendary_count += 1
        
        if trophies:
            stats.recent_trophy = max(trophies, key=lambda t: t.awarded_at)
        
        return stats
    
    async def has_trophy(self, user_id: str, trophy_type: TrophyType) -> bool:
        """Check if user already has a specific trophy."""
        from config.database import db
        
        existing = await db.trophies.find_one({
            "user_id": user_id,
            "trophy_type": trophy_type.value
        })
        
        return existing is not None
    
    async def award_trophy(
        self,
        user_id: str,
        username: str,
        trophy_type: TrophyType,
        earned_for: Optional[str] = None,
        milestone_value: Optional[int] = None
    ) -> Optional[Trophy]:
        """
        Award a trophy to a user.
        
        Args:
            user_id: User's ID
            username: User's username
            trophy_type: Type of trophy to award
            earned_for: Context (e.g., repo name)
            milestone_value: Value that triggered the award
            
        Returns:
            Trophy if awarded, None if already has it
        """
        from config.database import db
        
        # Check if already has this trophy
        if await self.has_trophy(user_id, trophy_type):
            logger.debug(f"User {username} already has trophy {trophy_type}")
            return None
        
        # Get trophy metadata
        metadata = TROPHY_METADATA.get(trophy_type, {})
        
        # Create trophy
        trophy = Trophy(
            user_id=user_id,
            username=username,
            trophy_type=trophy_type,
            name=metadata.get("name", trophy_type.value),
            description=metadata.get("description", ""),
            icon=metadata.get("icon", "🏆"),
            color=metadata.get("color", "#FFD700"),
            rarity=metadata.get("rarity", "common"),
            earned_for=earned_for,
            milestone_value=milestone_value
        )
        
        # Generate SVG
        trophy.svg_data = self.generate_trophy_svg(trophy)
        trophy.share_url = f"/api/trophy/{trophy.id}/svg"
        
        # Save to database
        trophy_dict = trophy.model_dump()
        trophy_dict['awarded_at'] = trophy_dict['awarded_at'].isoformat()
        trophy_dict['trophy_type'] = trophy_type.value
        
        await db.trophies.insert_one(trophy_dict)
        
        logger.info(f"Awarded trophy {trophy_type.value} to {username}")
        return trophy
    
    def generate_trophy_svg(self, trophy: Trophy) -> str:
        """
        Generate SVG badge for a trophy.
        
        Returns:
            SVG string
        """
        # Rarity-based gradients
        rarity_gradients = {
            "common": ("#C0C0C0", "#A0A0A0"),
            "uncommon": ("#4CAF50", "#2E7D32"),
            "rare": ("#2196F3", "#1565C0"),
            "legendary": ("#FFD700", "#FFA000")
        }
        
        colors = rarity_gradients.get(trophy.rarity, ("#C0C0C0", "#A0A0A0"))
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{colors[0]};stop-opacity:1" />
      <stop offset="100%" style="stop-color:{colors[1]};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Badge background -->
  <circle cx="100" cy="100" r="90" fill="url(#badgeGradient)" filter="url(#shadow)"/>
  <circle cx="100" cy="100" r="80" fill="none" stroke="white" stroke-width="3" opacity="0.5"/>
  
  <!-- Icon -->
  <text x="100" y="90" font-size="50" text-anchor="middle" dominant-baseline="middle">
    {trophy.icon}
  </text>
  
  <!-- Trophy name -->
  <text x="100" y="140" font-family="Arial, sans-serif" font-size="14" font-weight="bold" 
        fill="white" text-anchor="middle">{trophy.name}</text>
  
  <!-- Rarity indicator -->
  <text x="100" y="160" font-family="Arial, sans-serif" font-size="10" 
        fill="white" text-anchor="middle" opacity="0.8">{trophy.rarity.upper()}</text>
  
  <!-- Username -->
  <text x="100" y="180" font-family="Arial, sans-serif" font-size="10" 
        fill="white" text-anchor="middle" opacity="0.7">@{trophy.username}</text>
</svg>'''
        
        return svg
    
    async def get_user_stats(self, user_id: str, username: str) -> Dict[str, int]:
        """
        Get user statistics for trophy checking.
        """
        from config.database import db
        
        stats = {
            "prs_merged": 0,
            "bugs_found": 0,
            "mentees_helped": 0,
            "streak_days": 0,
            "issues_triaged": 0,
            "reviews_given": 0,
            "newcomers_welcomed": 0
        }
        
        # Count PRs
        stats["prs_merged"] = await db.issues.count_documents({
            "authorName": username,
            "isPR": True,
            "state": {"$in": ["merged", "closed"]}
        })
        
        # Count bug reports (issues with bug-related classification)
        stats["bugs_found"] = await db.triage_data.count_documents({
            "issueId": {"$in": await self._get_user_issue_ids(db, username)},
            "classification": {"$in": ["BUG", "CRITICAL_BUG"]}
        })
        
        # Get streak from gamification engine
        try:
            from services.gamification_engine import gamification_engine
            streak = await gamification_engine.get_user_streak(username)
            stats["streak_days"] = streak.current_streak
        except Exception:
            pass
        
        # Count reviews (comments on others' PRs)
        stats["reviews_given"] = await db.comments.count_documents({
            "author": username
        })
        
        return stats
    
    async def _get_user_issue_ids(self, db, username: str) -> List[str]:
        """Get issue IDs for a user."""
        cursor = db.issues.find(
            {"authorName": username, "isPR": False},
            {"_id": 0, "id": 1}
        )
        issues = await cursor.to_list(length=1000)
        return [i["id"] for i in issues]
    
    async def check_and_award_trophies(
        self,
        user_id: str,
        username: str
    ) -> List[Trophy]:
        """
        Check all achievements and award any earned trophies.
        
        Args:
            user_id: User's ID
            username: User's username
            
        Returns:
            List of newly awarded trophies
        """
        stats = await self.get_user_stats(user_id, username)
        awarded = []
        
        for trophy_type, thresholds in self.achievement_thresholds.items():
            # Check if already has trophy
            if await self.has_trophy(user_id, trophy_type):
                continue
            
            # Check if meets threshold
            meets_threshold = True
            milestone_value = None
            
            for stat_name, required_value in thresholds.items():
                current_value = stats.get(stat_name, 0)
                if current_value < required_value:
                    meets_threshold = False
                    break
                milestone_value = current_value
            
            if meets_threshold:
                trophy = await self.award_trophy(
                    user_id=user_id,
                    username=username,
                    trophy_type=trophy_type,
                    milestone_value=milestone_value
                )
                if trophy:
                    awarded.append(trophy)
        
        if awarded:
            logger.info(f"Awarded {len(awarded)} trophies to {username}")
        
        return awarded
    
    async def get_trophy_svg(self, trophy_id: str) -> Optional[str]:
        """Get SVG data for a trophy."""
        from config.database import db
        
        trophy_data = await db.trophies.find_one(
            {"id": trophy_id},
            {"_id": 0}
        )
        
        if trophy_data:
            return trophy_data.get("svg_data")
        return None
    
    async def get_leaderboard(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get trophy leaderboard."""
        from config.database import db
        
        pipeline = [
            {"$group": {
                "_id": "$user_id",
                "username": {"$first": "$username"},
                "total_trophies": {"$sum": 1},
                "legendary_count": {
                    "$sum": {"$cond": [{"$eq": ["$rarity", "legendary"]}, 1, 0]}
                },
                "rare_count": {
                    "$sum": {"$cond": [{"$eq": ["$rarity", "rare"]}, 1, 0]}
                }
            }},
            {"$sort": {
                "legendary_count": -1,
                "rare_count": -1,
                "total_trophies": -1
            }},
            {"$limit": limit}
        ]
        
        results = await db.trophies.aggregate(pipeline).to_list(length=limit)
        
        return [
            {
                "rank": i + 1,
                "user_id": r["_id"],
                "username": r["username"],
                "total_trophies": r["total_trophies"],
                "legendary_count": r["legendary_count"],
                "rare_count": r["rare_count"]
            }
            for i, r in enumerate(results)
        ]


# Singleton instance
trophy_service = TrophyService()
