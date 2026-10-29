import asyncio
import json

from app.core.config import get_settings
from app.services.embeddings import EmbeddingClient
from app.services.seed import seed_documents
from app.services.vector_store import VectorStore


async def main() -> None:
    settings = get_settings()
    vector_store = VectorStore(settings, EmbeddingClient(settings))
    indexed_documents = await seed_documents(settings, vector_store)

    print(
        json.dumps(
            {
                "documents_indexed": len(indexed_documents),
                "chunks_indexed": sum(item["chunks_indexed"] for item in indexed_documents),
                "documents": indexed_documents,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
