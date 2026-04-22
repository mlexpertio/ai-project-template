from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


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


class UIMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    role: Literal["user", "assistant", "system"]
    parts: list[dict[str, Any]]

    def text_content(self) -> str:
        return "".join(p.get("text", "") for p in self.parts if p.get("type") == "text")


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    messages: list[UIMessage]
    trigger: str | None = None
    messageId: str | None = None
