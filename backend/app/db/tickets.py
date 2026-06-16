from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.database import get_engine
from app.db.models import Ticket


async def add_ticket(
    session: AsyncSession, *, title: str, description: str, priority: str
) -> Ticket:
    ticket = Ticket(title=title, description=description, priority=priority)
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return ticket


async def list_tickets(
    session: AsyncSession, *, limit: int = 100, offset: int = 0
) -> list[Ticket]:
    statement = select(Ticket).order_by(Ticket.created_at.desc()).offset(offset).limit(limit)
    result = await session.exec(statement)
    return list(result.all())


async def get_ticket(session: AsyncSession, ticket_id: str) -> Ticket | None:
    return await session.get(Ticket, ticket_id)


class TicketStore:
    """Repository used by the agent tool, which runs outside the request scope.

    Routes should prefer the `get_session` dependency and the module-level helpers.
    This store opens its own short-lived session from the shared engine.
    """

    async def create_ticket(self, *, title: str, description: str, priority: str) -> dict:
        async with AsyncSession(get_engine()) as session:
            ticket = await add_ticket(
                session, title=title, description=description, priority=priority
            )
            return {
                "id": ticket.id,
                "title": ticket.title,
                "description": ticket.description,
                "priority": ticket.priority,
                "status": ticket.status,
                "created_at": ticket.created_at.isoformat(),
            }
