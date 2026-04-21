from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    char_count: int
    created_at: datetime


class ThreadCreateRequest(BaseModel):
    document_ids: list[UUID] | None = None


class ThreadDocumentMeta(BaseModel):
    id: UUID
    filename: str


class ThreadCreateResponse(BaseModel):
    id: UUID
    created_at: datetime
    documents: list[ThreadDocumentMeta]


class ThreadListResponse(BaseModel):
    id: UUID
    title: str | None
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    role: str
    content: str
    created_at: datetime


class ThreadDetailResponse(BaseModel):
    id: UUID
    title: str | None
    created_at: datetime
    messages: list[MessageResponse]
    documents: list[ThreadDocumentMeta]


class ChatRequest(BaseModel):
    thread_id: UUID
    message: str
