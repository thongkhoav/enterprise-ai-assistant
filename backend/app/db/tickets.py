import asyncio
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


class TicketStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    async def create_ticket(self, *, title: str, description: str, priority: str) -> dict:
        return await asyncio.to_thread(
            self._create_ticket_sync,
            title,
            description,
            priority,
        )

    def _ensure_schema(self) -> None:
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS tickets (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def _create_ticket_sync(self, title: str, description: str, priority: str) -> dict:
        ticket = {
            "id": str(uuid4()),
            "title": title,
            "description": description,
            "priority": priority,
            "status": "open",
            "created_at": datetime.now(UTC).isoformat(),
        }
        with sqlite3.connect(self.db_path) as connection:
            connection.execute(
                """
                INSERT INTO tickets (id, title, description, priority, status, created_at)
                VALUES (:id, :title, :description, :priority, :status, :created_at)
                """,
                ticket,
            )
            connection.commit()
        return ticket
