from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.db import conversations as conversation_repo
from app.db.database import SessionDep
from app.db.models import User
from app.schemas.conversation import (
    ConversationCreate,
    ConversationDetail,
    ConversationRename,
    ConversationSummary,
    MessagePublic,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationSummary])
async def read_conversations(
    session: SessionDep,
    current_user: User = Depends(get_current_user),
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
) -> list[ConversationSummary]:
    conversations = await conversation_repo.list_conversations(
        session, user_id=current_user.id, limit=limit, offset=offset
    )
    return [ConversationSummary.model_validate(c, from_attributes=True) for c in conversations]


@router.post("", response_model=ConversationDetail, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    session: SessionDep,
    current_user: User = Depends(get_current_user),
) -> ConversationDetail:
    conversation = await conversation_repo.create_conversation(
        session,
        user_id=current_user.id,
        title=payload.title or "New conversation",
    )
    return ConversationDetail.model_validate(conversation, from_attributes=True)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def read_conversation(
    conversation_id: str,
    session: SessionDep,
    current_user: User = Depends(get_current_user),
) -> ConversationDetail:
    conversation = await conversation_repo.get_conversation(
        session, conversation_id=conversation_id, user_id=current_user.id
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = await conversation_repo.list_messages(session, conversation_id=conversation_id)
    detail = ConversationDetail.model_validate(conversation, from_attributes=True)
    detail.messages = [MessagePublic.model_validate(m, from_attributes=True) for m in messages]
    return detail


@router.patch("/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: str,
    payload: ConversationRename,
    session: SessionDep,
    current_user: User = Depends(get_current_user),
) -> ConversationSummary:
    conversation = await conversation_repo.get_conversation(
        session, conversation_id=conversation_id, user_id=current_user.id
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = await conversation_repo.rename_conversation(
        session, conversation=conversation, title=payload.title
    )
    return ConversationSummary.model_validate(conversation, from_attributes=True)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_conversation(
    conversation_id: str,
    session: SessionDep,
    current_user: User = Depends(get_current_user),
) -> None:
    conversation = await conversation_repo.get_conversation(
        session, conversation_id=conversation_id, user_id=current_user.id
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await conversation_repo.delete_conversation(session, conversation=conversation)
