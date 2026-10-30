from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import get_settings
from app.db import models  # noqa: F401  (import registers tables on SQLModel.metadata)


def _async_dsn(url: str) -> str:
    """Normalize a standard Postgres URL to use the asyncpg driver."""
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://") :]
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://") :]
    return url


_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(_async_dsn(get_settings().database_url))
    return _engine


# Columns added after the first release. `create_all` only creates missing tables, so an
# existing database gets them here (the project has no migration tool yet).
_ADDED_COLUMNS = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'member'",
    "ALTER TABLE messages ADD COLUMN IF NOT EXISTS suggestions JSON",
    "ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS user_name VARCHAR",
)


async def create_db_and_tables() -> None:
    async with get_engine().begin() as connection:
        await connection.run_sync(SQLModel.metadata.create_all)
        if connection.dialect.name == "postgresql":
            for statement in _ADDED_COLUMNS:
                await connection.execute(text(statement))


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSession(get_engine()) as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
