from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SupportRequestCreate(BaseModel):
    kind: Literal["docs", "human"]
    question: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None
    message_id: str | None = None


class SupportRequestResolve(BaseModel):
    reply: str = Field(min_length=1, max_length=4000)


class SupportRequestPublic(BaseModel):
    id: str
    kind: str
    status: str
    question: str
    user_email: str
    conversation_id: str | None = None
    message_id: str | None = None
    reply: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class SupportChannel(BaseModel):
    kind: str
    label: str
    href: str
