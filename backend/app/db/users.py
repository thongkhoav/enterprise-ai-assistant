from __future__ import annotations

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import User


async def create_user(
    session: AsyncSession, *, email: str, hashed_password: str, full_name: str | None = None
) -> User:
    user = User(email=email, hashed_password=hashed_password, full_name=full_name)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    result = await session.exec(statement)
    return result.first()


async def get_user(session: AsyncSession, user_id: str) -> User | None:
    return await session.get(User, user_id)
