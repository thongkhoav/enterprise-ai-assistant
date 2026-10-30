from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid4())


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=_new_id, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    full_name: str | None = None
    # "admin" manages the knowledge base and answers the support inbox; "member" only chats.
    role: str = Field(default="member")
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_type=DateTime(timezone=True),
    )


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: str = Field(default_factory=_new_id, primary_key=True)
    user_id: str = Field(index=True, foreign_key="users.id")
    title: str = "New conversation"
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_type=DateTime(timezone=True),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_type=DateTime(timezone=True),
    )


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: str = Field(default_factory=_new_id, primary_key=True)
    conversation_id: str = Field(index=True, foreign_key="conversations.id")
    role: str
    content: str
    route: str | None = None
    trace_id: str | None = None
    citations: list[Any] | None = Field(default=None, sa_column=Column(JSON))
    tool_results: list[Any] | None = Field(default=None, sa_column=Column(JSON))
    # Follow-up questions offered under an assistant answer.
    suggestions: list[Any] | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_type=DateTime(timezone=True),
    )


class TicketBase(SQLModel):
    title: str
    description: str
    priority: str


class Ticket(TicketBase, table=True):
    __tablename__ = "tickets"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    status: str = Field(default="open", index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),
    )


class TicketPublic(TicketBase):
    id: str
    status: str
    created_at: datetime


class SupportRequest(SQLModel, table=True):
    """A member asking a person for help: a missing document or a human reply."""

    __tablename__ = "support_requests"

    id: str = Field(default_factory=_new_id, primary_key=True)
    kind: str  # "docs" | "human"
    status: str = Field(default="open", index=True)  # "open" | "resolved"
    question: str
    user_id: str = Field(index=True, foreign_key="users.id")
    user_email: str
    user_name: str | None = None
    conversation_id: str | None = Field(default=None, foreign_key="conversations.id")
    message_id: str | None = None
    reply: str | None = None
    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_type=DateTime(timezone=True),
    )
    resolved_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
