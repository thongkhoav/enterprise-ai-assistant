from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.chat import Citation, ToolResult


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationRename(BaseModel):
    title: str


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessagePublic(BaseModel):
    id: str
    role: str
    content: str
    route: str | None = None
    trace_id: str | None = None
    citations: list[Citation] = []
    tool_results: list[ToolResult] = []
    suggestions: list[str] = []
    created_at: datetime

    @field_validator("citations", "tool_results", "suggestions", mode="before")
    @classmethod
    def _coerce_none_to_list(cls, value: object) -> object:
        return value if value is not None else []


class ConversationDetail(ConversationSummary):
    messages: list[MessagePublic] = []
