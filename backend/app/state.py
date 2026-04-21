from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from uuid import UUID


@dataclass
class Document:
    id: UUID
    filename: str
    text: str
    char_count: int
    created_at: datetime


@dataclass
class Message:
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


@dataclass
class Thread:
    id: UUID
    title: str | None
    attached_docs: list[Document]
    messages: list[Message]
    created_at: datetime
    updated_at: datetime


@dataclass
class AppState:
    documents: dict[UUID, Document] = field(default_factory=dict)
    threads: dict[UUID, Thread] = field(default_factory=dict)
