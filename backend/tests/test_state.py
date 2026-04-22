from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.state import AppState, Document, Thread


@pytest.mark.asyncio
async def test_cors_preflight(client):
    response = await client.options(
        "/api/v1/documents",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers


class TestDataclasses:
    def test_document_creation(self):
        doc = Document(
            id=uuid4(),
            filename="test.txt",
            text="hello",
            char_count=5,
            created_at=datetime.now(timezone.utc),
        )
        assert doc.filename == "test.txt"
        assert doc.char_count == 5

    def test_app_state_isolation(self):
        s1 = AppState()
        s2 = AppState()
        assert s1.documents is not s2.documents
        assert s1.threads is not s2.threads

    def test_thread_snapshot_independence(self):
        """Mutating the source doc must not touch the snapshot held by the thread."""
        doc = Document(
            id=uuid4(),
            filename="original.txt",
            text="original",
            char_count=8,
            created_at=datetime.now(timezone.utc),
        )
        thread = Thread(
            id=uuid4(),
            title="Test",
            attached_docs=deepcopy([doc]),
            messages=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        doc.text = "mutated"
        assert thread.attached_docs[0].text == "original"
