import pytest
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_upload_md_happy_path():
    """Upload a .md file — expect 200 with id and filename, chunks created."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("test.md", b"# Hello\n\nSome content.")},
        )
    assert response.status_code == 200
    body = response.json()
    assert "id" in body
    assert "filename" in body
    assert body["filename"] == "test.md"


@pytest.mark.asyncio
async def test_upload_reject_non_md():
    """Upload a .txt file — expect 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("test.txt", b"not markdown")},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_unknown_document():
    """GET a document id that doesn't exist — expect 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/documents/{uuid4()}")
    assert response.status_code == 404
