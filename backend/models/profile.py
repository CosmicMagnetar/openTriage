"""
Profile models for user profile management.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ProfileVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    CONNECTIONS_ONLY = "connections_only"


class UserProfile(BaseModel):
    """Extended user profile with skills and preferences."""
    user_id: str
    username: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    location: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    
    # Mentorship settings
    available_for_mentoring: bool = False
    mentoring_topics: List[str] = Field(default_factory=list)
    
    # Connected repositories for monitoring
    connected_repos: List[str] = Field(default_factory=list)
    
    # Visibility settings
    profile_visibility: ProfileVisibility = ProfileVisibility.PUBLIC
    show_email: bool = False
    
    # Stats (cached from GitHub)
    github_stats: Optional[dict] = None
    stats_updated_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProfileUpdate(BaseModel):
    """Model for profile update requests."""
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    location: Optional[str] = None
    website: Optional[str] = None
    twitter: Optional[str] = None
    available_for_mentoring: Optional[bool] = None
    mentoring_topics: Optional[List[str]] = None
    profile_visibility: Optional[ProfileVisibility] = None
    show_email: Optional[bool] = None


class RepoConnection(BaseModel):
    """Model for connecting a repository."""
    repo_name: str  # Format: owner/repo
    enable_monitoring: bool = True


class GitHubStats(BaseModel):
    """GitHub contribution statistics."""
    username: str
    total_contributions: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    total_commits: int = 0
    total_prs: int = 0
    total_issues: int = 0
    total_reviews: int = 0
    contribution_days: List[dict] = Field(default_factory=list)  # [{date, count, type}]
    repositories: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class ProfileSummary(BaseModel):
    """Lightweight profile summary for listings."""
    user_id: str
    username: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    available_for_mentoring: bool = False
    current_streak: int = 0
    trophy_count: int = 0
