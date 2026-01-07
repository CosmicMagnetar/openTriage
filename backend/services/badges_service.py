"""
Badges Service for OpenTriage.
Defines earnable badges and auto-awards them based on user activity.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from enum import Enum

logger = logging.getLogger(__name__)


class BadgeRarity(str, Enum):
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    LEGENDARY = "legendary"


class Badge(BaseModel):
    """Badge definition."""
    id: str
    name: str
    description: str
    icon: str
    image_url: Optional[str] = None  # URL to AI-generated badge image
    rarity: BadgeRarity
    criteria_type: str  # prs_merged, issues_closed, streak, reviews, etc.
    criteria_value: int  # threshold value to earn
    category: str = "general"  # general, streak, review, community


class UserBadge(BaseModel):
    """A badge earned by a user."""
    badge_id: str
    badge: Badge
    earned_at: datetime
    progress: int  # current progress value when earned


# Define all available badges with AI-generated images
BADGE_DEFINITIONS = [
    # PR Badges
    Badge(
        id="first_pr",
        name="First PR",
        description="Merged your first pull request",
        icon="🎉",
        image_url="/badges/badge_first_pr.png",
        rarity=BadgeRarity.COMMON,
        criteria_type="prs_merged",
        criteria_value=1,
        category="general"
    ),
    Badge(
        id="pr_veteran",
        name="PR Veteran",
        description="Merged 10 pull requests",
        icon="🚀",
        image_url="/badges/badge_pr_veteran.png",
        rarity=BadgeRarity.UNCOMMON,
        criteria_type="prs_merged",
        criteria_value=10,
        category="general"
    ),
    Badge(
        id="pr_champion",
        name="PR Champion",
        description="Merged 50 pull requests",
        icon="🏆",
        image_url="/badges/badge_pr_champion.png",
        rarity=BadgeRarity.RARE,
        criteria_type="prs_merged",
        criteria_value=50,
        category="general"
    ),
    Badge(
        id="pr_legend",
        name="PR Legend",
        description="Merged 100 pull requests",
        icon="👑",
        image_url="/badges/badge_pr_legend.png",
        rarity=BadgeRarity.LEGENDARY,
        criteria_type="prs_merged",
        criteria_value=100,
        category="general"
    ),
    
    # Streak Badges
    Badge(
        id="streak_starter",
        name="Streak Starter",
        description="Maintained a 7-day contribution streak",
        icon="🔥",
        image_url="/badges/badge_streak_starter.png",
        rarity=BadgeRarity.COMMON,
        criteria_type="streak_days",
        criteria_value=7,
        category="streak"
    ),
    Badge(
        id="streak_warrior",
        name="Streak Warrior",
        description="Maintained a 30-day contribution streak",
        icon="⚡",
        image_url="/badges/badge_streak_warrior.png",
        rarity=BadgeRarity.RARE,
        criteria_type="streak_days",
        criteria_value=30,
        category="streak"
    ),
    Badge(
        id="streak_master",
        name="Streak Master",
        description="Maintained a 100-day contribution streak",
        icon="💎",
        image_url="/badges/badge_streak_master.png",
        rarity=BadgeRarity.LEGENDARY,
        criteria_type="streak_days",
        criteria_value=100,
        category="streak"
    ),
    
    # Review Badges
    Badge(
        id="first_review",
        name="First Review",
        description="Reviewed your first pull request",
        icon="👀",
        image_url="/badges/badge_first_review.png",
        rarity=BadgeRarity.COMMON,
        criteria_type="reviews_given",
        criteria_value=1,
        category="review"
    ),
    Badge(
        id="code_reviewer",
        name="Code Reviewer",
        description="Reviewed 10 pull requests",
        icon="🔍",
        image_url="/badges/badge_code_reviewer.png",
        rarity=BadgeRarity.UNCOMMON,
        criteria_type="reviews_given",
        criteria_value=10,
        category="review"
    ),
    Badge(
        id="review_champion",
        name="Review Champion",
        description="Reviewed 50 pull requests",
        icon="🏅",
        image_url="/badges/badge_review_champion.png",
        rarity=BadgeRarity.RARE,
        criteria_type="reviews_given",
        criteria_value=50,
        category="review"
    ),
    
    # Community Badges
    Badge(
        id="helpful_contributor",
        name="Helpful Contributor",
        description="Had 5 comments marked as helpful",
        icon="💡",
        image_url="/badges/badge_helpful_contributor.png",
        rarity=BadgeRarity.UNCOMMON,
        criteria_type="helpful_comments",
        criteria_value=5,
        category="community"
    ),
    Badge(
        id="mentor",
        name="Mentor",
        description="Helped 3 newcomers with their first PR",
        icon="🌟",
        image_url="/badges/badge_mentor.png",
        rarity=BadgeRarity.RARE,
        criteria_type="mentees_helped",
        criteria_value=3,
        category="community"
    ),
    
    # Issue Badges
    Badge(
        id="bug_hunter",
        name="Bug Hunter",
        description="Reported 5 bugs that were fixed",
        icon="🐛",
        image_url="/badges/badge_bug_hunter.png",
        rarity=BadgeRarity.UNCOMMON,
        criteria_type="bugs_reported",
        criteria_value=5,
        category="general"
    ),
]


class BadgesService:
    """Service for managing badges."""
    
    def __init__(self):
        self.badges = {b.id: b for b in BADGE_DEFINITIONS}
    
    def get_all_badges(self) -> List[Badge]:
        """Get all defined badges."""
        return BADGE_DEFINITIONS
    
    def get_badge(self, badge_id: str) -> Optional[Badge]:
        """Get a badge by ID."""
        return self.badges.get(badge_id)
    
    def get_badges_by_category(self, category: str) -> List[Badge]:
        """Get badges by category."""
        return [b for b in BADGE_DEFINITIONS if b.category == category]
    
    async def get_user_badges(self, user_id: str, username: str) -> Dict[str, Any]:
        """Get badges earned by a user."""
        from config.database import db
        
        # Fetch user's earned badges
        earned = await db.user_badges.find({
            "$or": [
                {"user_id": user_id},
                {"username": username}
            ]
        }).to_list(length=None)
        
        earned_ids = {e.get("badge_id") for e in earned}
        
        earned_badges = []
        for e in earned:
            badge = self.badges.get(e.get("badge_id"))
            if badge:
                earned_badges.append({
                    "badge": badge.model_dump(),
                    "earned_at": e.get("earned_at"),
                    "progress": e.get("progress", badge.criteria_value)
                })
        
        # Get all badges with progress
        all_badges_with_progress = []
        user_stats = await self._get_user_stats(username)
        
        for badge in BADGE_DEFINITIONS:
            progress = self._get_progress_for_badge(badge, user_stats)
            all_badges_with_progress.append({
                "badge": badge.model_dump(),
                "earned": badge.id in earned_ids,
                "progress": progress,
                "progress_percent": min(100, int((progress / badge.criteria_value) * 100))
            })
        
        # Stats
        stats = {
            "total_earned": len(earned_badges),
            "common": len([e for e in earned if self.badges.get(e.get("badge_id"), Badge(id="", name="", description="", icon="", rarity=BadgeRarity.COMMON, criteria_type="", criteria_value=0)).rarity == BadgeRarity.COMMON]),
            "uncommon": len([e for e in earned if self.badges.get(e.get("badge_id")).rarity == BadgeRarity.UNCOMMON if self.badges.get(e.get("badge_id"))]),
            "rare": len([e for e in earned if self.badges.get(e.get("badge_id")).rarity == BadgeRarity.RARE if self.badges.get(e.get("badge_id"))]),
            "legendary": len([e for e in earned if self.badges.get(e.get("badge_id")).rarity == BadgeRarity.LEGENDARY if self.badges.get(e.get("badge_id"))]),
        }
        
        return {
            "earned_badges": earned_badges,
            "all_badges": all_badges_with_progress,
            "stats": stats
        }
    
    async def check_and_award_badges(self, user_id: str, username: str) -> List[Badge]:
        """Check user's stats and award any newly earned badges."""
        from config.database import db
        
        # Get user stats
        stats = await self._get_user_stats(username)
        
        # Get user email
        user_email = None
        user_doc = await db.users.find_one({"_id": user_id}) # Try ID first
        if not user_doc:
             user_doc = await db.users.find_one({"username": username})
        
        if user_doc:
             user_email = user_doc.get("email")

        # Get already earned badges
        earned = await db.user_badges.find({
            "$or": [
                {"user_id": user_id},
                {"username": username}
            ]
        }).to_list(length=None)
        earned_ids = {e.get("badge_id") for e in earned}
        
        # Check each badge
        new_badges = []
        for badge in BADGE_DEFINITIONS:
            if badge.id in earned_ids:
                continue
            
            progress = self._get_progress_for_badge(badge, stats)
            if progress >= badge.criteria_value:
                # Award badge
                await db.user_badges.insert_one({
                    "user_id": user_id,
                    "username": username,
                    "badge_id": badge.id,
                    "earned_at": datetime.now(timezone.utc),
                    "progress": progress
                })
                new_badges.append(badge)
                logger.info(f"Awarded badge '{badge.name}' to {username}")
                
                # Send email notification
                if user_email:
                    from services.email_service import email_service
                    await email_service.send_badge_email(
                        user_email, username, badge.name, badge.description
                    )
        
        return new_badges
    
    def _get_progress_for_badge(self, badge: Badge, stats: Dict[str, int]) -> int:
        """Get current progress for a badge based on user stats."""
        mapping = {
            "prs_merged": "prs_merged",
            "streak_days": "longest_streak",
            "reviews_given": "reviews_given",
            "helpful_comments": "helpful_comments",
            "mentees_helped": "mentees_helped",
            "bugs_reported": "bugs_reported"
        }
        stat_key = mapping.get(badge.criteria_type, badge.criteria_type)
        return stats.get(stat_key, 0)
    
    async def _get_user_stats(self, username: str) -> Dict[str, int]:
        """Get user statistics for badge calculation."""
        from config.database import db
        
        stats = {
            "prs_merged": 0,
            "longest_streak": 0,
            "reviews_given": 0,
            "helpful_comments": 0,
            "mentees_helped": 0,
            "bugs_reported": 0
        }
        
        try:
            # Count merged PRs
            stats["prs_merged"] = await db.issues.count_documents({
                "authorName": username,
                "isPR": True,
                "state": "closed"  # Assuming closed PR = merged
            })
            
            # Get streak
            try:
                from services.gamification_engine import gamification_engine
                streak = await gamification_engine.get_user_streak(username)
                stats["longest_streak"] = streak.longest_streak
            except Exception:
                pass
            
            # Count reviews
            stats["reviews_given"] = await db.reviews.count_documents({
                "reviewerName": username
            })
            
            # Helpful comments (from sentiment or explicit marking)
            stats["helpful_comments"] = await db.comments.count_documents({
                "authorName": username,
                "is_helpful": True
            })
            
        except Exception as e:
            logger.error(f"Error getting user stats: {e}")
        
        return stats


# Singleton instance
badges_service = BadgesService()
