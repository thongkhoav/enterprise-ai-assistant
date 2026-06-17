from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_current_user, get_vector_store
from app.core.config import Settings, get_settings
from app.schemas.documents import DocumentUploadResponse
from app.services.chunking import chunk_text
from app.services.document_loader import load_upload
from app.services.vector_store import VectorStore

router = APIRouter(
    prefix="/documents", tags=["documents"], dependencies=[Depends(get_current_user)]
)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    source: str | None = Form(default=None),
    settings: Settings = Depends(get_settings),
    vector_store: VectorStore = Depends(get_vector_store),
) -> DocumentUploadResponse:
    loaded = await load_upload(file, source=source)
    chunks = chunk_text(
        loaded.text,
        source=loaded.source,
        document_id=loaded.document_id,
        chunk_size=settings.chunk_size,
        overlap=settings.chunk_overlap,
        base_metadata=loaded.metadata,
    )
    await vector_store.upsert_chunks(chunks)
    return DocumentUploadResponse(
        document_id=loaded.document_id,
        source=loaded.source,
        chunks_indexed=len(chunks),
    )
