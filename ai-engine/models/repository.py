from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid


class Repository(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    githubRepoId: int
    name: str
    owner: str
    userId: str
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
