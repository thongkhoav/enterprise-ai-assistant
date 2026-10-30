from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Example channels for the Acme sample company; set SUPPORT_CHANNELS to your own.
DEFAULT_SUPPORT_CHANNELS = (
    {"kind": "email", "label": "Email the help desk", "href": "mailto:helpdesk@acme.example"},
    {
        "kind": "slack",
        "label": "Slack #ask-ops",
        "href": "https://slack.com/app_redirect?channel=ask-ops",
    },
    {"kind": "teams", "label": "Microsoft Teams", "href": "https://teams.microsoft.com/"},
)

# Public in this repo, so anyone could sign tokens with it: local development only.
DEV_JWT_SECRET = "dev-jwt-secret-change-me-in-production-0123456789"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Enterprise AI Assistant API"
    app_env: str = "local"

    jwt_secret: str = DEV_JWT_SECRET
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
    # (see `DEFAULT_MIN_SCORE` and `LLM_MIN_SCORE` in app/services/rag.py).
    rag_min_score: float | None = None
    # Index the bundled sample docs at startup when the index is empty (handy on hosts with
    # ephemeral disks, so a fresh deploy is never an empty demo).
    seed_on_startup: bool = False
    chunk_size: int = 900
    chunk_overlap: int = 120
    rough_cost_per_1k_tokens_usd: float = 0.002

    # Accounts registered with these emails get the admin role (comma separated).
    admin_emails_raw: str = Field(default="", alias="ADMIN_EMAILS")
    # Public demo only: lets any signed-in user switch between member and admin.
    demo_role_switch: bool = False
    # Other ways to reach a person, shown under answers. JSON list of
    # {"kind": "email" | "slack" | "teams" | "phone" | "link", "label": ..., "href": ...}.
    support_channels: list[dict[str, str]] = Field(
        default_factory=lambda: [dict(channel) for channel in DEFAULT_SUPPORT_CHANNELS]
    )

    cors_origins_raw: str = Field(
        default="http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ORIGINS",
    )

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> Settings:
        if self.app_env == "production" and (
            self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32
        ):
            raise ValueError(
                "JWT_SECRET must be set to a random string of at least 32 characters when "
                "APP_ENV=production, e.g. the output of `openssl rand -hex 32`."
            )
        return self

    @property
    def admin_emails(self) -> set[str]:
        return {
            email.strip().lower() for email in self.admin_emails_raw.split(",") if email.strip()
        }

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.chroma_path.mkdir(parents=True, exist_ok=True)
    settings.trace_log_path.parent.mkdir(parents=True, exist_ok=True)
    return settings
