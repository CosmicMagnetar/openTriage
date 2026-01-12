from pydantic import BaseModel, Field, ConfigDict
from typing import List
from datetime import datetime, timezone
import uuid


class ChatHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str
    sessionId: str
    messages: List[dict]
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
