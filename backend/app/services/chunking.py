from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha1
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.document_loader import LoadedDocument


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
    start_index: int = 0,
) -> list[TextChunk]:
    """Split text into overlapping chunks of roughly `chunk_size` characters.

    Whitespace is normalized first, then the text is sliced into windows that overlap by
    `overlap` characters so context near a boundary is not lost. A window ends at the last
    sentence or word break in its final fifth, so chunks (and the snippets shown as citations)
    do not stop mid-word. Each chunk gets a stable id derived from the document id, its index,
    and a content hash. Raises ValueError if `overlap >= chunk_size`; returns an empty list for
    blank text.
    """
    clean = " ".join(text.split())
    if not clean:
        return []

    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    chunks: list[TextChunk] = []
    start = 0
    index = start_index
    while start < len(clean):
        end = _window_end(clean, start, chunk_size)
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
        start = _next_start(clean, max(end - overlap, start + 1), end)
        index += 1
    return chunks


def chunk_document(document: LoadedDocument, *, chunk_size: int, overlap: int) -> list[TextChunk]:
    """Chunk a loaded document, tagging chunks with their 1-based page number for PDFs."""
    chunks: list[TextChunk] = []
    for page_number, page_text in enumerate(document.pages, start=1):
        metadata = dict(document.metadata)
        if document.paged:
            metadata["page"] = page_number
        chunks.extend(
            chunk_text(
                page_text,
                source=document.source,
                document_id=document.document_id,
                chunk_size=chunk_size,
                overlap=overlap,
                base_metadata=metadata,
                start_index=len(chunks),
            )
        )
    return chunks


def _next_start(text: str, position: int, end: int) -> int:
    """Move an overlap start forward to the beginning of a word (never past `end`)."""
    if position == 0 or text[position - 1] == " ":
        return position
    space = text.find(" ", position, end)
    return space + 1 if space != -1 else position


def _window_end(text: str, start: int, chunk_size: int) -> int:
    end = min(start + chunk_size, len(text))
    if end == len(text):
        return end

    floor = start + int(chunk_size * 0.8)
    for marker in (". ", "? ", "! ", " "):
        cut = text.rfind(marker, floor, end)
        if cut != -1:
            return cut + len(marker.rstrip())
    return end
