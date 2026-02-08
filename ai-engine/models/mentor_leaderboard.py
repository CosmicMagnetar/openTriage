"""
Mentor Leaderboard Models - AI-powered ranking with sentiment analysis.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone
from enum import Enum
import uuid


class MentorLeaderboardEntry(BaseModel):
    """A mentor's ranking entry in the AI leaderboard."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mentor_id: str
    mentor_username: str
    
    # Ranking scores (0-100)
    overall_score: float = 0.0  # Weighted average of all metrics
    sentiment_score: float = 0.0  # Based on conversation sentiment analysis
    expertise_score: float = 0.0  # Based on language proficiency
    engagement_score: float = 0.0  # Based on message frequency, session count
    
    # Best programming language
    best_language: Optional[str] = None
    language_proficiency: Dict[str, float] = {}  # {"python": 85.0, "javascript": 72.0, ...}
    
    # Sentiment breakdown
    avg_sentiment_score: float = 0.0
    positive_sentiment_ratio: float = 0.0  # 0-1
    conversations_analyzed: int = 0
    
    # Expertise metrics
    total_sessions: int = 0
    total_mentees: int = 0
    avg_session_duration_minutes: float = 0.0
    
    # Leaderboard position
    rank: int = 0
    rank_change: int = 0  # +/- from last ranking
    
    # Customization/Editing
    is_custom_edited: bool = False
    custom_notes: Optional[str] = None
    manual_adjustments: Dict[str, float] = {}  # {field: adjustment_value}
    
    # Metadata
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_edited_by: Optional[str] = None  # Maintainer username
    edit_history: List[Dict] = []  # [{timestamp, edited_by, field, old_value, new_value}]


class LeaderboardEdit(BaseModel):
    """Record of a leaderboard edit made by maintainer."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entry_id: str  # Leaderboard entry ID being edited
    mentor_id: str
    edited_by: str  # Maintainer username
    
    # What was changed
    field: str  # Which field was edited
    old_value: any
    new_value: any
    reason: Optional[str] = None
    
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeaderboardConfig(BaseModel):
    """Configuration for leaderboard generation."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Weighting for overall score
    sentiment_weight: float = 0.35  # How much sentiment impacts score
    expertise_weight: float = 0.40
    engagement_weight: float = 0.25
    
    # Language detection patterns
    programming_languages: List[str] = [
        "python", "javascript", "typescript", "java", "cpp", "c++", "rust",
        "go", "ruby", "php", "swift", "kotlin", "scala", "clojure",
        "react", "vue", "angular", "django", "flask", "fastapi",
        "node", "express", "nextjs", "nuxt"
    ]
    
    # Sentiment thresholds
    positive_sentiment_threshold: float = 0.6
    negative_sentiment_threshold: float = 0.4
    
    # Session filters
    min_sessions_for_ranking: int = 1
    days_lookback: int = 90  # Only include recent conversations
    
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeaderboardResponse(BaseModel):
    """Paginated leaderboard response."""
    entries: List[MentorLeaderboardEntry]
    total_mentors: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    config: Optional[LeaderboardConfig] = None
