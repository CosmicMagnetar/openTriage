"""
Resource Vault Models for OpenTriage.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class ResourceType(str, Enum):
    LINK = "link"
    CODE_SNIPPET = "code_snippet"
    DOCUMENTATION = "documentation"
    TUTORIAL = "tutorial"
    TOOL = "tool"
    EXAMPLE = "example"
    ANSWER = "answer"


class Resource(BaseModel):
    """A saved resource from chat or discussions."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Source
    repo_name: str
    source_type: str = "chat"  # chat, comment, issue, pr
    source_id: Optional[str] = None  # ID of the source message/comment
    
    # Content
    resource_type: ResourceType
    title: str
    content: str  # The actual content (URL, code, etc.)
    description: Optional[str] = None
    
    # Metadata
    tags: List[str] = []
    language: Optional[str] = None  # For code snippets
    
    # Attribution
    shared_by: str  # Username who shared it
    shared_by_id: str
    
    # Stats
    save_count: int = 0  # How many users saved this
    helpful_count: int = 0  # Upvotes
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSavedResource(BaseModel):
    """A resource saved by a specific user."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    resource_id: str
    notes: Optional[str] = None  # Personal notes
    saved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResourceExtraction(BaseModel):
    """Result of extracting resources from a message."""
    message_id: str
    extracted_resources: List[Resource] = []
    extraction_confidence: float = 0.0
