"""
Mentor Matching Models for OpenTriage.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class ExpertiseLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class MentorProfile(BaseModel):
    """Profile for users who can mentor others."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    username: str
    
    # Technical expertise
    tech_stack: List[str] = []  # e.g., ["python", "react", "typescript"]
    languages: List[str] = []   # Programming languages
    frameworks: List[str] = []  # Frameworks/libraries
    expertise_level: ExpertiseLevel = ExpertiseLevel.INTERMEDIATE
    
    # Availability
    availability_hours_per_week: int = 5
    timezone: Optional[str] = None
    is_active: bool = True
    
    # Profile info
    bio: str = ""  # About the mentor
    avatar_url: Optional[str] = None

    
    # Stats
    mentee_count: int = 0
    sessions_completed: int = 0
    avg_rating: float = 0.0
    total_ratings: int = 0
    
    # Preferences
    max_mentees: int = 3
    preferred_topics: List[str] = []
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MentorMatch(BaseModel):
    """A match between a mentor and mentee."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mentor_id: str
    mentor_username: str
    mentee_id: str
    mentee_username: str
    
    # Match quality
    compatibility_score: float  # 0-100
    matched_skills: List[str] = []  # Overlapping tech stack
    match_reason: str = ""
    
    # Context
    issue_id: Optional[str] = None
    repo_name: Optional[str] = None
    
    # Status
    status: str = "suggested"  # suggested, accepted, declined, completed
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MentorshipRequest(BaseModel):
    """Request from a mentee to connect with a mentor."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mentee_id: str
    mentor_id: str
    issue_id: Optional[str] = None
    message: str = ""
    status: str = "pending"  # pending, accepted, declined
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MentorRating(BaseModel):
    """Rating given to a mentor after a session."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mentor_id: str
    mentee_id: str
    session_id: Optional[str] = None
    rating: int  # 1-5
    feedback: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
