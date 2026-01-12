"""
Trophy/Badge Models for OpenTriage.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


class TrophyType(str, Enum):
    # Contribution milestones
    FIRST_PR = "first_pr"
    PR_MASTER = "pr_master"           # 10 PRs merged
    PR_LEGEND = "pr_legend"           # 50 PRs merged
    
    # Bug hunting
    BUG_HUNTER = "bug_hunter"         # Found 5 bugs
    BUG_SLAYER = "bug_slayer"         # Found 25 bugs
    
    # Mentorship
    FIRST_MENTOR = "first_mentor"     # First mentee helped
    MASTER_MENTOR = "master_mentor"   # Mentored 10 contributors
    
    # Streaks
    STREAK_STARTER = "streak_starter" # 7-day streak
    STREAK_WARRIOR = "streak_warrior" # 30-day streak
    STREAK_LEGEND = "streak_legend"   # 100-day streak
    
    # Triage
    TRIAGE_HELPER = "triage_helper"   # Triaged 10 issues
    TRIAGE_HERO = "triage_hero"       # Triaged 50 issues
    
    # Reviews
    FIRST_REVIEW = "first_review"     # First review given
    REVIEW_GURU = "review_guru"       # 25 reviews given
    
    # Community
    WELCOME_COMMITTEE = "welcome_committee"  # Welcomed 5 newcomers
    DOCUMENTATION_HERO = "documentation_hero"  # Improved docs
    
    # Special
    EARLY_ADOPTER = "early_adopter"   # Early platform user
    TOP_CONTRIBUTOR = "top_contributor"  # Monthly top contributor


TROPHY_METADATA: Dict[str, Dict[str, Any]] = {
    TrophyType.FIRST_PR: {
        "name": "First PR",
        "description": "Merged your first pull request!",
        "icon": "🎉",
        "color": "#4CAF50",
        "rarity": "common"
    },
    TrophyType.PR_MASTER: {
        "name": "PR Master",
        "description": "Merged 10 pull requests",
        "icon": "⭐",
        "color": "#2196F3",
        "rarity": "uncommon"
    },
    TrophyType.PR_LEGEND: {
        "name": "PR Legend",
        "description": "Merged 50 pull requests",
        "icon": "🏆",
        "color": "#9C27B0",
        "rarity": "legendary"
    },
    TrophyType.BUG_HUNTER: {
        "name": "Bug Hunter",
        "description": "Found and reported 5 bugs",
        "icon": "🐛",
        "color": "#FF5722",
        "rarity": "common"
    },
    TrophyType.BUG_SLAYER: {
        "name": "Bug Slayer",
        "description": "Squashed 25 bugs",
        "icon": "⚔️",
        "color": "#E91E63",
        "rarity": "rare"
    },
    TrophyType.FIRST_MENTOR: {
        "name": "First Mentor",
        "description": "Helped your first mentee",
        "icon": "🤝",
        "color": "#00BCD4",
        "rarity": "uncommon"
    },
    TrophyType.MASTER_MENTOR: {
        "name": "Master Mentor",
        "description": "Mentored 10 contributors",
        "icon": "🎓",
        "color": "#673AB7",
        "rarity": "rare"
    },
    TrophyType.STREAK_STARTER: {
        "name": "Streak Starter",
        "description": "7-day contribution streak",
        "icon": "🔥",
        "color": "#FF9800",
        "rarity": "common"
    },
    TrophyType.STREAK_WARRIOR: {
        "name": "Streak Warrior",
        "description": "30-day contribution streak",
        "icon": "💪",
        "color": "#F44336",
        "rarity": "rare"
    },
    TrophyType.STREAK_LEGEND: {
        "name": "Streak Legend",
        "description": "100-day contribution streak",
        "icon": "🌟",
        "color": "#FFD700",
        "rarity": "legendary"
    },
    TrophyType.TRIAGE_HELPER: {
        "name": "Triage Helper",
        "description": "Triaged 10 issues",
        "icon": "📋",
        "color": "#607D8B",
        "rarity": "common"
    },
    TrophyType.TRIAGE_HERO: {
        "name": "Triage Hero",
        "description": "Triaged 50 issues",
        "icon": "🦸",
        "color": "#3F51B5",
        "rarity": "rare"
    },
    TrophyType.FIRST_REVIEW: {
        "name": "First Review",
        "description": "Gave your first code review",
        "icon": "👀",
        "color": "#8BC34A",
        "rarity": "common"
    },
    TrophyType.REVIEW_GURU: {
        "name": "Review Guru",
        "description": "Provided 25 code reviews",
        "icon": "🧙",
        "color": "#795548",
        "rarity": "rare"
    },
    TrophyType.WELCOME_COMMITTEE: {
        "name": "Welcome Committee",
        "description": "Welcomed 5 newcomers to the project",
        "icon": "👋",
        "color": "#FFEB3B",
        "rarity": "uncommon"
    },
    TrophyType.DOCUMENTATION_HERO: {
        "name": "Documentation Hero",
        "description": "Improved project documentation",
        "icon": "📚",
        "color": "#009688",
        "rarity": "uncommon"
    },
    TrophyType.EARLY_ADOPTER: {
        "name": "Early Adopter",
        "description": "One of the first OpenTriage users",
        "icon": "🚀",
        "color": "#00BCD4",
        "rarity": "rare"
    },
    TrophyType.TOP_CONTRIBUTOR: {
        "name": "Top Contributor",
        "description": "Monthly top contributor",
        "icon": "👑",
        "color": "#FFD700",
        "rarity": "legendary"
    }
}


class Trophy(BaseModel):
    """A trophy/badge earned by a user."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    trophy_type: TrophyType
    
    # Display info
    name: str
    description: str
    icon: str
    color: str
    rarity: str  # common, uncommon, rare, legendary
    
    # SVG data for sharing
    svg_data: Optional[str] = None
    
    # Sharing
    is_public: bool = True
    share_url: Optional[str] = None
    
    # Context
    earned_for: Optional[str] = None  # e.g., "owner/repo"
    milestone_value: Optional[int] = None  # e.g., 10 for "10 PRs"
    
    awarded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserTrophyStats(BaseModel):
    """Summary of a user's trophy collection."""
    user_id: str
    username: str
    total_trophies: int = 0
    common_count: int = 0
    uncommon_count: int = 0
    rare_count: int = 0
    legendary_count: int = 0
    recent_trophy: Optional[Trophy] = None
    trophy_ids: List[str] = []
