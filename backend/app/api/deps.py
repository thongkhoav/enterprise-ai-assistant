from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException, status

from app.agents.graph import AgentRunner
from app.core.config import Settings, get_settings
from app.core.security import decode_access_token
from app.db.database import SessionDep
from app.db.models import User
from app.db.tickets import TicketStore
from app.db.users import get_user
from app.services.embeddings import EmbeddingClient
from app.services.rag import RAGService
from app.services.vector_store import VectorStore

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Missing or invalid authentication token.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    session: SessionDep,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _CREDENTIALS_ERROR

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(settings, token)
    except jwt.PyJWTError as exc:
        raise _CREDENTIALS_ERROR from exc

    user_id = payload.get("sub")
    if not user_id:
        raise _CREDENTIALS_ERROR

    user = await get_user(session, user_id)
    if user is None:
        raise _CREDENTIALS_ERROR
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only knowledge base admins can change documents.",
        )
    return current_user


@lru_cache(maxsize=1)
def get_embedding_client() -> EmbeddingClient:
    return EmbeddingClient(get_settings())


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    return VectorStore(get_settings(), get_embedding_client())


@lru_cache(maxsize=1)
def get_ticket_store() -> TicketStore:
    return TicketStore()


@lru_cache(maxsize=1)
def get_rag_service() -> RAGService:
    return RAGService(get_settings(), get_vector_store())


@lru_cache(maxsize=1)
def get_agent_runner() -> AgentRunner:
    return AgentRunner(
        settings=get_settings(),
        rag=get_rag_service(),
        ticket_store=get_ticket_store(),
    )
