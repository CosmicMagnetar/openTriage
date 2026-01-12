"""
Chat Session Models for OpenTriage Mentorship.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class SessionType(str, Enum):
    ONE_ON_ONE = "one_on_one"
    GROUP = "group"
    ISSUE_HELP = "issue_help"


class SessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ChatSession(BaseModel):
    """A mentorship chat session."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Participants
    mentor_id: str
    mentor_username: str
    mentee_ids: List[str] = []  # Can have multiple for group sessions
    mentee_usernames: List[str] = []
    
    # Type and context
    session_type: SessionType = SessionType.ONE_ON_ONE
    issue_id: Optional[str] = None
    repo_name: Optional[str] = None
    topic: Optional[str] = None
    
    # Status
    status: SessionStatus = SessionStatus.ACTIVE
    
    # Timestamps
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    last_activity_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Summary (AI-generated)
    summary: Optional[str] = None
    key_points: List[str] = []
    resources_shared: List[str] = []  # Resource IDs
    
    # Stats
    message_count: int = 0
    duration_minutes: int = 0


class ChatMessage(BaseModel):
    """A message in a chat session."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    
    # Sender
    sender_id: str
    sender_username: str
    is_mentor: bool = False
    
    # Content
    content: str
    message_type: str = "text"  # text, code, link, file
    
    # Metadata
    language: Optional[str] = None  # For code blocks
    attachments: List[str] = []
    
    # Reactions
    reactions: dict = {}  # {emoji: [user_ids]}
    
    # AI features
    is_ai_generated: bool = False
    contains_resource: bool = False
    extracted_resource_id: Optional[str] = None
    
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    edited_at: Optional[datetime] = None


class SessionSummary(BaseModel):
    """AI-generated summary of a chat session."""
    session_id: str
    
    # Summary content
    overview: str
    topics_discussed: List[str] = []
    key_takeaways: List[str] = []
    action_items: List[str] = []
    
    # Resources
    resources_shared: List[str] = []
    code_snippets_count: int = 0
    links_shared: int = 0
    
    # Metrics
    total_messages: int = 0
    mentor_messages: int = 0
    mentee_messages: int = 0
    duration_minutes: int = 0
    
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
