from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha1


@dataclass(frozen=True)
class TextChunk:
    id: str
    text: str
    source: str
    document_id: str
    metadata: dict = field(default_factory=dict)


def chunk_text(
    text: str,
    *,
    source: str,
    document_id: str,
    chunk_size: int,
    overlap: int,
    base_metadata: dict | None = None,
) -> list[TextChunk]:
    clean = " ".join(text.split())
    if not clean:
        return []

    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    chunks: list[TextChunk] = []
    start = 0
    index = 0
    while start < len(clean):
        end = min(start + chunk_size, len(clean))
        body = clean[start:end].strip()
        digest = sha1(f"{document_id}:{index}:{body}".encode()).hexdigest()[:16]
        chunks.append(
            TextChunk(
                id=f"{document_id}:{index}:{digest}",
                text=body,
                source=source,
                document_id=document_id,
                metadata={**(base_metadata or {}), "chunk_index": index},
            )
        )
        if end == len(clean):
            break
        start = end - overlap
        index += 1
    return chunks
