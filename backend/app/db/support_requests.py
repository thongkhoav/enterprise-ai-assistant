from __future__ import annotations

from datetime import UTC, datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import SupportRequest


async def find_open(
    session: AsyncSession, *, user_id: str, kind: str, message_id: str | None
) -> SupportRequest | None:
    """The open request this user already made about the same answer, if any."""
    if message_id is None:
        return None
    statement = select(SupportRequest).where(
        SupportRequest.user_id == user_id,
        SupportRequest.kind == kind,
        SupportRequest.message_id == message_id,
        SupportRequest.status == "open",
    )
    result = await session.exec(statement)
    return result.first()


async def create_request(session: AsyncSession, request: SupportRequest) -> SupportRequest:
    session.add(request)
    await session.commit()
    await session.refresh(request)
    return request


async def list_requests(
    session: AsyncSession, *, user_id: str | None = None, status: str | None = None
) -> list[SupportRequest]:
    """Newest first; `user_id` limits the list to one member's own requests."""
    statement = select(SupportRequest).order_by(SupportRequest.created_at.desc()).limit(200)
    if user_id is not None:
        statement = statement.where(SupportRequest.user_id == user_id)
    if status is not None:
        statement = statement.where(SupportRequest.status == status)
    result = await session.exec(statement)
    return list(result.all())


async def resolve_request(
    session: AsyncSession, request: SupportRequest, *, reply: str
) -> SupportRequest:
    request.status = "resolved"
    request.reply = reply
    request.resolved_at = datetime.now(UTC)
    session.add(request)
    await session.commit()
    await session.refresh(request)
    return request
