import json
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.state import AppState, Document, Thread


@pytest.fixture(autouse=True)
def clear_store():
    store: AppState = app.state.store
    store.documents.clear()
    store.threads.clear()
    yield
    store.documents.clear()
    store.threads.clear()


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _MockLLM:
    """Fake LLM that returns a predictable response."""

    def __init__(self, response: str = "Hello there!"):
        self._response = response

    def invoke(self, messages):
        from langchain_core.messages import AIMessage

        return AIMessage(content=self._response)

    async def ainvoke(self, messages):
        return self.invoke(messages)

    def stream(self, messages):
        from langchain_core.messages import AIMessageChunk

        words = self._response.split()
        for word in words:
            yield AIMessageChunk(content=word + " ")

    async def astream(self, messages):
        for chunk in self.stream(messages):
            yield chunk


def _make_thread(store: AppState, title: str = "Test") -> Thread:
    tid = uuid4()
    thread = Thread(
        id=tid,
        title=title,
        attached_docs=[],
        messages=[],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    store.threads[tid] = thread
    return thread


def _read_stream(body: bytes) -> list[str]:
    """Parse Vercel AI SDK data-stream format lines."""
    lines = body.decode("utf-8").strip().split("\n")
    texts = []
    for line in lines:
        if line.startswith("0:"):
            texts.append(json.loads(line[2:]))
    return texts


@pytest.mark.asyncio
async def test_chat_stream_happy_path():
    store: AppState = app.state.store
    thread = _make_thread(store)

    with patch("app.services.graph.get_llm", return_value=_MockLLM("Hi back!")):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/chat/stream",
                json={"thread_id": str(thread.id), "message": "Hello"},
            )

    assert response.status_code == 200
    texts = _read_stream(response.content)
    assert "".join(texts) == "Hi back! "

    # Thread should have user + assistant messages
    assert len(thread.messages) == 2
    assert thread.messages[0].role == "user"
    assert thread.messages[0].content == "Hello"
    assert thread.messages[1].role == "assistant"
    assert thread.messages[1].content == "Hi back! "


@pytest.mark.asyncio
async def test_chat_stream_auto_title():
    store: AppState = app.state.store
    thread = _make_thread(store, title=None)

    with patch("app.services.graph.get_llm", return_value=_MockLLM("Sure!")):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
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
async def test_chat_stream_with_attached_docs():
    store: AppState = app.state.store
    doc = Document(
        id=uuid4(),
        filename="context.txt",
        text="The answer is 42.",
        char_count=19,
        created_at=datetime.now(timezone.utc),
    )
    store.documents[doc.id] = doc
    thread = _make_thread(store)
    thread.attached_docs = [doc]

    with patch("app.services.graph.get_llm", return_value=_MockLLM("42")):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/chat/stream",
                json={"thread_id": str(thread.id), "message": "What is the answer?"},
            )

    assert response.status_code == 200
    texts = _read_stream(response.content)
    assert "".join(texts) == "42 "


@pytest.mark.asyncio
async def test_chat_stream_unknown_thread():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/chat/stream",
            json={"thread_id": str(uuid4()), "message": "Hello"},
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_chat_stream_error_midstream():
    """If the LLM raises, the endpoint should emit an error event and close cleanly."""
    store: AppState = app.state.store
    thread = _make_thread(store)

    class _BadLLM:
        async def astream(self, messages):
            from langchain_core.messages import AIMessageChunk

            yield AIMessageChunk(content="Partial")
            raise RuntimeError("boom")

        def invoke(self, messages):
            raise RuntimeError("boom")

        async def ainvoke(self, messages):
            raise RuntimeError("boom")

    with patch("app.services.graph.get_llm", return_value=_BadLLM()):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/chat/stream",
                json={"thread_id": str(thread.id), "message": "Hello"},
            )

    assert response.status_code == 200
    body = response.content.decode("utf-8")
    assert "3:" in body  # error line prefix
