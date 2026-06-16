from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


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
