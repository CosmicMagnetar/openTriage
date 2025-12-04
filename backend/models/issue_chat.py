from pydantic import BaseModel, Field, ConfigDict
from typing import List
from datetime import datetime, timezone
import uuid


class IssueChat(BaseModel):
    """Model for tracking chat conversations on GitHub issues."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    issueId: str
    userId: str
    sessionId: str
    messages: List[dict] = []  # Array of {role, content, timestamp, githubCommentId, githubCommentUrl}
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
