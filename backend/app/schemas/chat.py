from __future__ import annotations

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    session_id: str = "demo-session"
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class Citation(BaseModel):
    source: str
    chunk_id: str
    score: float | None = None
    page: int | None = None


class ToolResult(BaseModel):
    name: str
    result: dict


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    route: str
    citations: list[Citation]
    tool_results: list[ToolResult]
    trace_id: str
