from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import get_vector_store
from app.api.routes import auth, chat, conversations, documents, health, tickets
from app.core.config import get_settings
from app.db.database import create_db_and_tables
from app.services.seed import seed_documents


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    vector_store = get_vector_store()
    # Load the embedding model now so the first question does not pay for it.
    await vector_store.embeddings.embed_texts(["warmup"])
    if get_settings().seed_on_startup and vector_store.collection.count() == 0:
        await seed_documents(get_settings(), vector_store)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Enterprise AI Assistant API with RAG, tools, LangGraph, and tracing.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router, prefix="/v1")
    app.include_router(conversations.router, prefix="/v1")
    app.include_router(chat.router, prefix="/v1")
    app.include_router(documents.router, prefix="/v1")
    app.include_router(tickets.router, prefix="/v1")
    return app


app = create_app()
