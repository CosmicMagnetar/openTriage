from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
import uuid


class UserRole(str, Enum):
    MAINTAINER = "MAINTAINER"
    CONTRIBUTOR = "CONTRIBUTOR"


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    githubId: int
    username: str
    avatarUrl: str
    role: Optional[UserRole] = None
    repositories: List[str] = []
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
