import asyncio
import json
from collections.abc import Iterable
from pathlib import Path

from app.core.config import get_settings
from app.services.chunking import chunk_text
from app.services.document_loader import load_file
from app.services.embeddings import EmbeddingClient
from app.services.vector_store import VectorStore

SEED_PATHS = [
    Path("docs/sample_policy.md"),
    *sorted(Path("docs/seed").glob("*.md")),
]


async def main() -> None:
    settings = get_settings()
    embeddings = EmbeddingClient(settings)
    vector_store = VectorStore(settings, embeddings)
    indexed_documents = []
    total_chunks = 0

    for path in _existing_seed_paths(SEED_PATHS):
        loaded = load_file(path, source=str(path))
        chunks = chunk_text(
            loaded.text,
            source=loaded.source,
            document_id=loaded.document_id,
            chunk_size=settings.chunk_size,
            overlap=settings.chunk_overlap,
            base_metadata=loaded.metadata,
        )
        await vector_store.upsert_chunks(chunks)
        total_chunks += len(chunks)
        indexed_documents.append(
            {
                "document_id": loaded.document_id,
                "source": loaded.source,
                "chunks_indexed": len(chunks),
            }
        )

    print(
        json.dumps(
            {
                "documents_indexed": len(indexed_documents),
                "chunks_indexed": total_chunks,
                "documents": indexed_documents,
            },
            indent=2,
        )
    )


def _existing_seed_paths(paths: Iterable[Path]) -> list[Path]:
    return [path for path in paths if path.exists()]


if __name__ == "__main__":
    asyncio.run(main())
