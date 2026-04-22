import json
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from langchain_core.messages import AIMessageChunk

from app.main import app
from app.state import AppState, Thread


class _StreamingLLM:
    """Yields the response word-by-word via astream (the only method the graph uses)."""

    def __init__(self, response: str = "Hello there!"):
        self._response = response

    async def astream(self, messages):
        for word in self._response.split():
            yield AIMessageChunk(content=word + " ")


class _FailingLLM:
    """Streams one chunk, then raises mid-stream."""

    async def astream(self, messages):
        yield AIMessageChunk(content="Partial")
        raise RuntimeError("boom")


def _put_thread(store: AppState, title: str | None = "Test") -> Thread:
    tid = uuid4()
    now = datetime.now(timezone.utc)
    thread = Thread(
        id=tid,
        title=title,
        attached_docs=[],
        messages=[],
        created_at=now,
        updated_at=now,
    )
    store.threads[tid] = thread
    return thread


def _stream_texts(body: bytes) -> list[str]:
    """Parse Vercel AI SDK data-stream `0:"..."` frames into their text payloads."""
    return [
        json.loads(line[2:])
        for line in body.decode("utf-8").strip().split("\n")
        if line.startswith("0:")
    ]


@pytest.mark.asyncio
async def test_chat_stream_happy_path(client):
    thread = _put_thread(app.state.store)

    with patch("app.services.graph.get_llm", return_value=_StreamingLLM("Hi back!")):
        response = await client.post(
            "/api/v1/chat/stream",
            json={"thread_id": str(thread.id), "message": "Hello"},
        )

    assert response.status_code == 200
    assert "".join(_stream_texts(response.content)) == "Hi back! "

    assert len(thread.messages) == 2
    assert thread.messages[0].role == "user"
    assert thread.messages[0].content == "Hello"
    assert thread.messages[1].role == "assistant"
    assert thread.messages[1].content == "Hi back! "


@pytest.mark.asyncio
async def test_chat_stream_auto_title(client):
    thread = _put_thread(app.state.store, title=None)

    with patch("app.services.graph.get_llm", return_value=_StreamingLLM("Sure!")):
        response = await client.post(
            "/api/v1/chat/stream",
            json={
                "thread_id": str(thread.id),
                "message": "This is my first question ever",
            },
        )

    assert response.status_code == 200
    assert thread.title == "This is my first question ever"[:60]


@pytest.mark.asyncio
async def test_chat_stream_with_attached_docs(client, make_doc):
    store: AppState = app.state.store
    doc = make_doc(store, "The answer is 42.", filename="context.txt")
    thread = _put_thread(store)
    thread.attached_docs = [doc]

    with patch("app.services.graph.get_llm", return_value=_StreamingLLM("42")):
        response = await client.post(
            "/api/v1/chat/stream",
            json={"thread_id": str(thread.id), "message": "What is the answer?"},
        )

    assert response.status_code == 200
    assert "".join(_stream_texts(response.content)) == "42 "


@pytest.mark.asyncio
async def test_chat_stream_unknown_thread(client):
    response = await client.post(
        "/api/v1/chat/stream",
        json={"thread_id": str(uuid4()), "message": "Hello"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_chat_stream_error_midstream(client):
    """If the LLM raises, the endpoint emits an error frame and closes cleanly."""
    thread = _put_thread(app.state.store)

    with patch("app.services.graph.get_llm", return_value=_FailingLLM()):
        response = await client.post(
            "/api/v1/chat/stream",
            json={"thread_id": str(thread.id), "message": "Hello"},
        )

    assert response.status_code == 200
    assert "3:" in response.content.decode("utf-8")
