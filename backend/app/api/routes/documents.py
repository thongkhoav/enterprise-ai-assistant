from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import get_current_user, get_vector_store
from app.core.config import Settings, get_settings
from app.schemas.documents import DocumentSummary, DocumentUploadResponse
from app.services.chunking import chunk_document
from app.services.document_loader import SUPPORTED_SUFFIXES, load_upload
from app.services.vector_store import VectorStore

router = APIRouter(
    prefix="/documents", tags=["documents"], dependencies=[Depends(get_current_user)]
)


@router.get("", response_model=list[DocumentSummary])
async def list_documents(
    vector_store: VectorStore = Depends(get_vector_store),
) -> list[DocumentSummary]:
    return [DocumentSummary(**item) for item in await vector_store.list_documents()]


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    source: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    vector_store: VectorStore = Depends(get_vector_store),
) -> DocumentUploadResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Use one of: {', '.join(sorted(SUPPORTED_SUFFIXES))}",
        )

    loaded = await load_upload(file, source=source or None)
    chunks = chunk_document(loaded, chunk_size=settings.chunk_size, overlap=settings.chunk_overlap)
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No text could be extracted. Scanned PDFs need OCR first.",
        )

    await vector_store.upsert_chunks(chunks)
    return DocumentUploadResponse(
        document_id=loaded.document_id,
        source=loaded.source,
        chunks_indexed=len(chunks),
        page_count=loaded.metadata.get("page_count"),
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    vector_store: VectorStore = Depends(get_vector_store),
) -> None:
    if await vector_store.delete_document(document_id) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
