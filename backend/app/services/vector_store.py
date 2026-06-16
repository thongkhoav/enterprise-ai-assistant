import asyncio
from typing import Any

import chromadb

from app.core.config import Settings
from app.services.chunking import TextChunk
from app.services.embeddings import EmbeddingClient


class VectorStore:
    def __init__(self, settings: Settings, embeddings: EmbeddingClient) -> None:
        self.settings = settings
        self.embeddings = embeddings
        self.client = chromadb.PersistentClient(path=str(settings.chroma_path))
        self.collection = self.client.get_or_create_collection(settings.chroma_collection)

    async def upsert_chunks(self, chunks: list[TextChunk]) -> None:
        """Embed chunk texts and upsert them into the Chroma collection.

        Upsert is keyed by chunk id, so re-indexing the same chunks is idempotent. The blocking
        Chroma call runs in a worker thread to avoid stalling the event loop.
        """
        if not chunks:
            return

        vectors = await self.embeddings.embed_texts([chunk.text for chunk in chunks])
        await asyncio.to_thread(
            self.collection.upsert,
            ids=[chunk.id for chunk in chunks],
            embeddings=vectors,
            documents=[chunk.text for chunk in chunks],
            metadatas=[self._metadata_for(chunk) for chunk in chunks],
        )

    async def search(self, query: str, *, top_k: int) -> list[dict[str, Any]]:
        """Embed the query and return the top_k nearest chunks as {text, metadata, score} dicts."""
        query_embedding = (await self.embeddings.embed_texts([query]))[0]
        result = await asyncio.to_thread(
            self.collection.query,
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        return self._normalize_results(result)

    def _metadata_for(self, chunk: TextChunk) -> dict[str, Any]:
        """Build Chroma-safe metadata for a chunk, keeping only scalar values."""
        metadata = {
            "source": chunk.source,
            "document_id": chunk.document_id,
            "chunk_id": chunk.id,
            **chunk.metadata,
        }
        return {
            key: value
            for key, value in metadata.items()
            if isinstance(value, (str, int, float, bool))
        }

    def _normalize_results(self, result: dict[str, Any]) -> list[dict[str, Any]]:
        """Flatten Chroma's query result; convert each distance to score = 1 / (1 + distance)."""
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        normalized: list[dict[str, Any]] = []

        for document, metadata, distance in zip(documents, metadatas, distances, strict=False):
            score = 1.0 / (1.0 + float(distance)) if distance is not None else None
            normalized.append({"text": document, "metadata": metadata or {}, "score": score})
        return normalized
