from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    document_id: str
    source: str
    chunks_indexed: int

