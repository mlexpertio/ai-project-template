from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from app.main import app
from app.state import AppState, Message, Thread


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


@pytest.mark.asyncio
async def test_create_thread_no_docs(client):
    response = await client.post("/api/v1/threads", json={})
    assert response.status_code == 201
    body = response.json()
    assert "id" in body
    assert "created_at" in body
    assert body["documents"] == []


@pytest.mark.asyncio
async def test_create_thread_with_docs(client, make_doc):
    store: AppState = app.state.store
    doc = make_doc(store, "document content")

    response = await client.post(
        "/api/v1/threads",
        json={"document_ids": [str(doc.id)]},
    )
    assert response.status_code == 201
    body = response.json()
    assert len(body["documents"]) == 1
    assert body["documents"][0]["id"] == str(doc.id)
    assert body["documents"][0]["filename"] == "test.txt"

    thread_id = UUID(body["id"])
    thread = store.threads[thread_id]
    assert thread.attached_docs[0].text == "document content"


@pytest.mark.asyncio
async def test_create_thread_unknown_doc(client):
    response = await client.post(
        "/api/v1/threads",
        json={"document_ids": [str(uuid4())]},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_create_thread_too_much_text(client, make_doc):
    store: AppState = app.state.store
    make_doc(store, "x" * 26000)

    response = await client.post(
        "/api/v1/threads",
        json={"document_ids": [str(next(iter(store.documents)))]},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_threads(client):
    store: AppState = app.state.store
    thread = _put_thread(store, title="My Thread")

    response = await client.get("/api/v1/threads")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == str(thread.id)
    assert body[0]["title"] == "My Thread"
    assert "created_at" in body[0]
    assert "updated_at" in body[0]
    assert "messages" not in body[0]


@pytest.mark.asyncio
async def test_get_thread(client):
    store: AppState = app.state.store
    thread = _put_thread(store, title="Detail Thread")
    thread.messages.append(
        Message(role="user", content="hi", created_at=datetime.now(timezone.utc))
    )

    response = await client.get(f"/api/v1/threads/{thread.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(thread.id)
    assert body["title"] == "Detail Thread"
    assert len(body["messages"]) == 1
    assert body["messages"][0]["role"] == "user"
    assert body["messages"][0]["content"] == "hi"


@pytest.mark.asyncio
async def test_get_unknown_thread(client):
    response = await client.get(f"/api/v1/threads/{uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_thread(client):
    store: AppState = app.state.store
    thread = _put_thread(store, title="Delete Me")

    response = await client.delete(f"/api/v1/threads/{thread.id}")
    assert response.status_code == 204
    assert thread.id not in store.threads


@pytest.mark.asyncio
async def test_delete_unknown_thread(client):
    response = await client.delete(f"/api/v1/threads/{uuid4()}")
    assert response.status_code == 404
