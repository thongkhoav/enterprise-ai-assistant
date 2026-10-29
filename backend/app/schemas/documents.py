from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    document_id: str
    source: str
    chunks_indexed: int
    page_count: int | None = None


class DocumentSummary(BaseModel):
    document_id: str
    source: str
    filename: str | None = None
    page_count: int | None = None
    chunks: int
