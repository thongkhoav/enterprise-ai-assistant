from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Enterprise AI Assistant API"
    app_env: str = "local"
    app_api_key: str = "dev-secret"

    jwt_secret: str = "dev-jwt-secret-change-me-in-production-0123456789"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    openai_api_key: str | None = None
    openai_model: str | None = None
    # Any OpenAI-compatible endpoint (OpenRouter, Groq, Together, ...). Empty = api.openai.com.
    openai_base_url: str | None = None
    embedding_provider: Literal["auto", "openai", "local", "hash"] = "hash"
    openai_embedding_model: str = "text-embedding-3-small"
    local_embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dimensions: int = 384

    chroma_path: Path = Path("data/chroma")
    chroma_collection: str = "enterprise_knowledge"
    database_url: str = "postgresql://postgres:postgres@localhost:5433/enterprise_ai"
    trace_log_path: Path = Path("logs/traces.jsonl")

    rag_top_k: int = 5
    # Chunks scoring below this cosine similarity are ignored. When nothing clears it, the
    # assistant answers "I don't know" instead of guessing. Unset = a per-provider default
    # (see `DEFAULT_MIN_SCORE` in app/services/rag.py).
    rag_min_score: float | None = None
    # Index the bundled sample docs at startup when the index is empty (handy on hosts with
    # ephemeral disks, so a fresh deploy is never an empty demo).
    seed_on_startup: bool = False
    chunk_size: int = 900
    chunk_overlap: int = 120
    rough_cost_per_1k_tokens_usd: float = 0.002

    cors_origins_raw: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.chroma_path.mkdir(parents=True, exist_ok=True)
    settings.trace_log_path.parent.mkdir(parents=True, exist_ok=True)
    return settings
