from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.db import tickets as ticket_repo
from app.db.database import SessionDep
from app.db.models import TicketPublic

router = APIRouter(prefix="/tickets", tags=["tickets"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[TicketPublic])
async def read_tickets(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
) -> list[TicketPublic]:
    return await ticket_repo.list_tickets(session, limit=limit, offset=offset)


@router.get("/{ticket_id}", response_model=TicketPublic)
async def read_ticket(ticket_id: str, session: SessionDep) -> TicketPublic:
    ticket = await ticket_repo.get_ticket(session, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket
