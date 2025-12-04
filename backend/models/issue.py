from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid


class Issue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    githubIssueId: int
    number: int
    title: str
    body: Optional[str] = ""
    authorName: str
    repoId: str
    repoName: str
    owner: Optional[str] = ""  # Repository owner username
    repo: Optional[str] = ""   # Repository name
    htmlUrl: Optional[str] = ""  # GitHub issue URL
    state: str = "open"
    isPR: bool = False
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
