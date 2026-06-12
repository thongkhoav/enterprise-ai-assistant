from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status

from app.agents.graph import AgentRunner
from app.core.config import Settings, get_settings
from app.db.tickets import TicketStore
from app.services.embeddings import EmbeddingClient
from app.services.rag import RAGService
from app.services.vector_store import VectorStore


async def require_api_key(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = f"Bearer {settings.app_api_key}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid bearer token.",
        )


@lru_cache(maxsize=1)
def get_embedding_client() -> EmbeddingClient:
    return EmbeddingClient(get_settings())


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    return VectorStore(get_settings(), get_embedding_client())


@lru_cache(maxsize=1)
def get_ticket_store() -> TicketStore:
    return TicketStore(get_settings().tickets_db_path)


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
