from __future__ import annotations

import asyncio
import math
from hashlib import sha1
from typing import Any

from openai import AsyncOpenAI

from app.core.config import Settings


class EmbeddingClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.provider = self._resolve_provider()
        self._openai_client = (
            AsyncOpenAI(api_key=settings.openai_api_key) if self.provider == "openai" else None
        )
        self._local_model: Any | None = None

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if self.provider == "openai" and self._openai_client:
            response = await self._openai_client.embeddings.create(
                model=self.settings.openai_embedding_model,
                input=texts,
            )
            return [item.embedding for item in response.data]

        if self.provider == "local":
            return await asyncio.to_thread(self._embed_local, texts)

        return [self._hash_embedding(text) for text in texts]

    def _resolve_provider(self) -> str:
        if self.settings.embedding_provider == "auto":
            if self.settings.openai_api_key:
                return "openai"
            if self._fastembed_available():
                return "local"
            return "hash"

        if self.settings.embedding_provider == "openai" and not self.settings.openai_api_key:
            raise RuntimeError("EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY.")

        return self.settings.embedding_provider

    def _embed_local(self, texts: list[str]) -> list[list[float]]:
        model = self._load_local_model()
        embeddings = model.embed(texts)
        return [embedding.tolist() for embedding in embeddings]

    def _load_local_model(self) -> Any:
        if self._local_model is not None:
            return self._local_model

        try:
            from fastembed import TextEmbedding
        except ImportError as exc:
            raise RuntimeError(
                "EMBEDDING_PROVIDER=local requires fastembed. "
                "Install it with: uv sync --extra dev --extra local-embeddings"
            ) from exc

        self._local_model = TextEmbedding(model_name=self.settings.local_embedding_model)
        return self._local_model

    def _fastembed_available(self) -> bool:
        try:
            import fastembed  # noqa: F401
        except ImportError:
            return False
        return True

    def _hash_embedding(self, text: str) -> list[float]:
        vector = [0.0] * self.settings.embedding_dimensions
        for token in text.lower().split():
            digest = sha1(token.encode("utf-8")).hexdigest()
            index = int(digest[:8], 16) % self.settings.embedding_dimensions
            vector[index] += 1.0

        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]
