from collections.abc import Iterable
from pathlib import Path

from app.core.config import Settings
from app.services.chunking import chunk_document
from app.services.document_loader import load_file
from app.services.vector_store import VectorStore

SEED_PATHS = sorted(
    path for path in Path("docs/seed").iterdir() if path.suffix in {".md", ".pdf", ".docx"}
)


async def seed_documents(settings: Settings, vector_store: VectorStore) -> list[dict]:
    """Index the bundled sample documents; returns one summary row per document."""
    indexed = []
    for path in _existing_paths(SEED_PATHS):
        loaded = load_file(path, source=str(path))
        chunks = chunk_document(
            loaded, chunk_size=settings.chunk_size, overlap=settings.chunk_overlap
        )
        await vector_store.upsert_chunks(chunks)
        indexed.append(
            {
                "document_id": loaded.document_id,
                "source": loaded.source,
                "chunks_indexed": len(chunks),
            }
        )
    return indexed


def _existing_paths(paths: Iterable[Path]) -> list[Path]:
    return [path for path in paths if path.exists()]
