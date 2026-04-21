import pytest
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from main import app, documents


@pytest.fixture(autouse=True)
def clear_documents():
    """Reset the in-memory documents store before each test."""
    documents.clear()
    yield
    documents.clear()


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_upload_txt_happy_path():
    """Upload a .txt file — expect 201 with metadata, no chunks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("test.txt", b"Hello world", "text/plain")},
        )
    assert response.status_code == 201
    body = response.json()
    assert "id" in body
    assert body["filename"] == "test.txt"
    assert body["char_count"] == 11
    assert "created_at" in body
    assert "text" not in body
    assert "chunks" not in body


@pytest.mark.asyncio
async def test_upload_md_happy_path():
    """Upload a .md file — expect 201 with metadata."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("test.md", b"# Hello\n\nSome content.", "text/markdown")},
        )
    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "test.md"
    assert body["char_count"] == 22


@pytest.mark.asyncio
async def test_upload_pdf_happy_path():
    """Upload a minimal PDF — expect 201 with metadata."""
    from io import BytesIO

    # Build a minimal valid 1-page PDF in memory.
    def _minimal_pdf() -> bytes:
        buf = BytesIO()
        buf.write(b"%PDF-1.4\n")
        o1 = b"1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n"
        o2 = b"2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n"
        o3 = b"3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>\nendobj\n"
        offsets = []
        for o in [o1, o2, o3]:
            offsets.append(buf.tell())
            buf.write(o)
        xref = buf.tell()
        buf.write(b"xref\n0 4\n0000000000 65535 f \n")
        for off in offsets:
            buf.write(f"{off:010d} 00000 n \n".encode())
        buf.write(b"trailer\n<</Size 4/Root 1 0 R>>\n")
        buf.write(f"startxref\n{xref}\n%%EOF\n".encode())
        return buf.getvalue()

    pdf_bytes = _minimal_pdf()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
        )
    assert response.status_code == 201
    body = response.json()
    assert body["filename"] == "test.pdf"
    assert "char_count" in body
    assert isinstance(body["char_count"], int)


@pytest.mark.asyncio
async def test_upload_unsupported_mime():
    """Upload a .csv file — expect 415 Unsupported Media Type."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("data.csv", b"a,b,c", "text/csv")},
        )
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_upload_too_large():
    """Upload a file > 5 MB — expect 413 Payload Too Large."""
    transport = ASGITransport(app=app)
    big = b"x" * (5 * 1024 * 1024 + 1)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/documents",
            files={"file": ("big.txt", big, "text/plain")},
        )
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_list_documents():
    """GET /api/v1/documents returns metadata-only list."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Empty list initially
        response = await client.get("/api/v1/documents")
        assert response.status_code == 200
        assert response.json() == []

        # Upload one doc
        await client.post(
            "/api/v1/documents",
            files={"file": ("a.txt", b"abc", "text/plain")},
        )
        response = await client.get("/api/v1/documents")
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert set(body[0].keys()) == {"id", "filename", "char_count", "created_at"}
        assert body[0]["filename"] == "a.txt"
        assert body[0]["char_count"] == 3


@pytest.mark.asyncio
async def test_delete_document():
    """DELETE an existing document — expect 204."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        upload_resp = await client.post(
            "/api/v1/documents",
            files={"file": ("del.txt", b"bye", "text/plain")},
        )
        doc_id = upload_resp.json()["id"]

        delete_resp = await client.delete(f"/api/v1/documents/{doc_id}")
        assert delete_resp.status_code == 204

        list_resp = await client.get("/api/v1/documents")
        assert list_resp.json() == []


@pytest.mark.asyncio
async def test_delete_unknown_document():
    """DELETE a document id that doesn't exist — expect 404."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete(f"/api/v1/documents/{uuid4()}")
    assert response.status_code == 404
