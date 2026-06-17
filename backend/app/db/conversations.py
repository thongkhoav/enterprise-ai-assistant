from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import Conversation, Message


async def create_conversation(
    session: AsyncSession, *, user_id: str, title: str = "New conversation"
) -> Conversation:
    conversation = Conversation(user_id=user_id, title=title)
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    return conversation


async def list_conversations(
    session: AsyncSession, *, user_id: str, limit: int = 100, offset: int = 0
) -> list[Conversation]:
    statement = (
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.exec(statement)
    return list(result.all())


async def get_conversation(
    session: AsyncSession, *, conversation_id: str, user_id: str
) -> Conversation | None:
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != user_id:
        return None
    return conversation


async def list_messages(
    session: AsyncSession, *, conversation_id: str
) -> list[Message]:
    statement = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    result = await session.exec(statement)
    return list(result.all())


async def add_message(
    session: AsyncSession,
    *,
    conversation_id: str,
    role: str,
    content: str,
    route: str | None = None,
    trace_id: str | None = None,
    citations: list[Any] | None = None,
    tool_results: list[Any] | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        route=route,
        trace_id=trace_id,
        citations=citations,
        tool_results=tool_results,
    )
    session.add(message)

    conversation = await session.get(Conversation, conversation_id)
    if conversation is not None:
        conversation.updated_at = datetime.now(UTC)
        session.add(conversation)

    await session.commit()
    await session.refresh(message)
    return message


async def rename_conversation(
    session: AsyncSession, *, conversation: Conversation, title: str
) -> Conversation:
    conversation.title = title
    conversation.updated_at = datetime.now(UTC)
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    return conversation


async def delete_conversation(session: AsyncSession, *, conversation: Conversation) -> None:
    await session.exec(
        delete(Message).where(Message.conversation_id == conversation.id)
    )
    await session.delete(conversation)
    await session.commit()
