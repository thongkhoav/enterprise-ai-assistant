from __future__ import annotations

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class Citation(BaseModel):
    n: int | None = None
    source: str
    document_id: str | None = None
    chunk_id: str
    score: float | None = None
    page: int | None = None
    text: str | None = None


class ToolResult(BaseModel):
    name: str
    result: dict


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    route: str
    citations: list[Citation]
    tool_results: list[ToolResult]
    trace_id: str
    latency_ms: int | None = None
    answer_mode: str | None = None
    message_id: str | None = None
    suggestions: list[str] = Field(default_factory=list)
