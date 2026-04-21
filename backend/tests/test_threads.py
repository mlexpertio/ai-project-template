import pytest
from datetime import datetime, timezone
from uuid import UUID, uuid4

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.state import AppState, Document, Message, Thread


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


def _make_doc(store: AppState, text: str = "hello") -> Document:
    doc = Document(
        id=uuid4(),
        filename="test.txt",
        text=text,
        char_count=len(text),
        created_at=datetime.now(timezone.utc),
    )
    store.documents[doc.id] = doc
    return doc


@pytest.mark.asyncio
async def test_create_thread_no_docs():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/threads", json={})
    assert response.status_code == 201
    body = response.json()
    assert "id" in body
    assert "created_at" in body
    assert body["documents"] == []


@pytest.mark.asyncio
async def test_create_thread_with_docs():
    store: AppState = app.state.store
    doc = _make_doc(store, "document content")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/threads",
            json={"document_ids": [str(doc.id)]},
        )
    assert response.status_code == 201
    body = response.json()
    assert len(body["documents"]) == 1
    assert body["documents"][0]["id"] == str(doc.id)
    assert body["documents"][0]["filename"] == "test.txt"

    # Thread should have a snapshot, not a reference
    thread_id = UUID(body["id"])
    thread = store.threads[thread_id]
    assert thread.attached_docs[0].text == "document content"


@pytest.mark.asyncio
async def test_create_thread_unknown_doc():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/threads",
            json={"document_ids": [str(uuid4())]},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_thread_too_much_text():
    store: AppState = app.state.store
    # Create a doc that exceeds the default 25_000 char limit
    big_text = "x" * 26000
    doc = _make_doc(store, big_text)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/threads",
            json={"document_ids": [str(doc.id)]},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_threads():
    store: AppState = app.state.store
    tid = uuid4()
    store.threads[tid] = Thread(
        id=tid,
        title="My Thread",
        attached_docs=[],
        messages=[],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/threads")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(tid)
    assert body[0]["title"] == "My Thread"
    assert "created_at" in body[0]
    assert "updated_at" in body[0]
    assert "messages" not in body[0]


@pytest.mark.asyncio
async def test_get_thread():
    store: AppState = app.state.store
    tid = uuid4()
    store.threads[tid] = Thread(
        id=tid,
        title="Detail Thread",
        attached_docs=[],
        messages=[
            Message(role="user", content="hi", created_at=datetime.now(timezone.utc))
        ],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/threads/{tid}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(tid)
    assert body["title"] == "Detail Thread"
    assert len(body["messages"]) == 1
    assert body["messages"][0]["role"] == "user"
    assert body["messages"][0]["content"] == "hi"


@pytest.mark.asyncio
async def test_get_unknown_thread():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/threads/{uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_thread():
    store: AppState = app.state.store
    tid = uuid4()
    store.threads[tid] = Thread(
        id=tid,
        title="Delete Me",
        attached_docs=[],
        messages=[],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete(f"/api/v1/threads/{tid}")
    assert response.status_code == 204
    assert tid not in store.threads


@pytest.mark.asyncio
async def test_delete_unknown_thread():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete(f"/api/v1/threads/{uuid4()}")
    assert response.status_code == 404
