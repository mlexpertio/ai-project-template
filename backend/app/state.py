from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from uuid import UUID, uuid4


class ContextLimitExceeded(ValueError):
    def __init__(self, total: int, limit: int) -> None:
        super().__init__(f"Attached docs total {total} chars, limit is {limit}")
        self.total = total
        self.limit = limit


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

    def append_user(self, content: str, *, now: datetime) -> None:
        self.messages.append(Message(role="user", content=content, created_at=now))
        self.updated_at = now

    def append_assistant(self, content: str, *, now: datetime) -> None:
        self.messages.append(Message(role="assistant", content=content, created_at=now))
        self.updated_at = now

    def ensure_titled_from_first_message(self) -> None:
        if (
            self.title is None
            and len(self.messages) == 1
            and self.messages[0].role == "user"
        ):
            self.title = self.messages[0].content[:60]

    @classmethod
    def create(
        cls,
        docs: list[Document],
        *,
        max_context_chars: int,
        now: datetime,
    ) -> "Thread":
        snapshots = [deepcopy(d) for d in docs]
        total = sum(d.char_count for d in snapshots)
        if total > max_context_chars:
            raise ContextLimitExceeded(total, max_context_chars)
        return cls(
            id=uuid4(),
            title=None,
            attached_docs=snapshots,
            messages=[],
            created_at=now,
            updated_at=now,
        )


@dataclass
class AppState:
    documents: dict[UUID, Document] = field(default_factory=dict)
    threads: dict[UUID, Thread] = field(default_factory=dict)
