"""Hand-offs from the assistant to people: missing-document requests and human replies.

Members open requests from an answer; admins see every open request in their inbox and
resolve it with a reply, which is posted back into the member's conversation.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, require_admin
from app.core.config import Settings, get_settings
from app.db import conversations as conversation_repo
from app.db import support_requests as request_repo
from app.db.database import SessionDep
from app.db.models import SupportRequest, User
from app.schemas.support import (
    SupportChannel,
    SupportRequestCreate,
    SupportRequestPublic,
    SupportRequestResolve,
)

router = APIRouter(prefix="/support", tags=["support"])


@router.get("/channels", response_model=list[SupportChannel])
async def read_channels(
    _: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> list[SupportChannel]:
    return [SupportChannel(**channel) for channel in settings.support_channels]


@router.post("/requests", response_model=SupportRequestPublic, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: SupportRequestCreate,
    session: SessionDep,
    current_user: User = Depends(get_current_user),
) -> SupportRequest:
    if payload.conversation_id:
        conversation = await conversation_repo.get_conversation(
            session, conversation_id=payload.conversation_id, user_id=current_user.id
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

    existing = await request_repo.find_open(
        session, user_id=current_user.id, kind=payload.kind, message_id=payload.message_id
    )
    if existing is not None:
        return existing

    return await request_repo.create_request(
        session,
        SupportRequest(
            kind=payload.kind,
            question=payload.question.strip(),
            user_id=current_user.id,
            user_email=current_user.email,
            user_name=current_user.full_name,
            conversation_id=payload.conversation_id,
            message_id=payload.message_id,
        ),
    )


@router.get("/requests", response_model=list[SupportRequestPublic])
async def read_requests(
    session: SessionDep,
    current_user: User = Depends(get_current_user),
    status: Literal["open", "resolved"] | None = None,
) -> list[SupportRequest]:
    """Admins get every request (their inbox); members get their own."""
    owner = None if current_user.role == "admin" else current_user.id
    return await request_repo.list_requests(session, user_id=owner, status=status)


@router.post("/requests/{request_id}/resolve", response_model=SupportRequestPublic)
async def resolve_request(
    request_id: str,
    payload: SupportRequestResolve,
    session: SessionDep,
    _: User = Depends(require_admin),
) -> SupportRequest:
    request = await session.get(SupportRequest, request_id)
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")

    reply = payload.reply.strip()
    if request.conversation_id:
        await conversation_repo.add_message(
            session,
            conversation_id=request.conversation_id,
            role="agent",
            content=reply,
            route="support",
        )
    return await request_repo.resolve_request(session, request, reply=reply)
