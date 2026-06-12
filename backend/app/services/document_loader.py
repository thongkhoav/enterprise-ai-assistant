from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha1
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from pypdf import PdfReader


@dataclass(frozen=True)
class LoadedDocument:
    document_id: str
    source: str
    text: str
    metadata: dict = field(default_factory=dict)


async def load_upload(file: UploadFile, *, source: str | None = None) -> LoadedDocument:
    content = await file.read()
    filename = file.filename or "upload"
    suffix = Path(filename).suffix.lower()
    text, metadata = _extract_text(content, suffix)
    digest = sha1(content).hexdigest()[:16]
    return LoadedDocument(
        document_id=digest,
        source=source or filename,
        text=text,
        metadata={"filename": filename, "content_type": file.content_type or "", **metadata},
    )


def load_file(path: Path, *, source: str | None = None) -> LoadedDocument:
    content = path.read_bytes()
    text, metadata = _extract_text(content, path.suffix.lower())
    digest = sha1(content).hexdigest()[:16]
    return LoadedDocument(
        document_id=digest,
        source=source or path.name,
        text=text,
        metadata={"filename": path.name, **metadata},
    )


def _extract_text(content: bytes, suffix: str) -> tuple[str, dict]:
    if suffix == ".pdf":
        reader = PdfReader(BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages), {"page_count": len(pages)}

    if suffix == ".docx":
        from docx import Document

        document = Document(BytesIO(content))
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        return "\n".join(paragraphs), {"paragraph_count": len(paragraphs)}

    return content.decode("utf-8", errors="ignore"), {}
