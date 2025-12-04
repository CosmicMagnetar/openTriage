from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
from enum import Enum
import uuid


class Classification(str, Enum):
    CRITICAL_BUG = "CRITICAL_BUG"
    BUG = "BUG"
    FEATURE_REQUEST = "FEATURE_REQUEST"
    QUESTION = "QUESTION"
    DOCS = "DOCS"
    DUPLICATE = "DUPLICATE"
    NEEDS_INFO = "NEEDS_INFO"
    SPAM = "SPAM"


class Sentiment(str, Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    FRUSTRATED = "FRUSTRATED"


class IssueTriageData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    issueId: str
    classification: Classification
    summary: str
    suggestedLabel: str
    sentiment: Sentiment
    analyzedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    body: str
    ownerId: str
    triggerClassification: Optional[Classification] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
