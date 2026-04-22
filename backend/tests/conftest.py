from datetime import datetime, timezone
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.state import AppState, Document


@pytest.fixture(autouse=True)
def clear_store():
    store: AppState = app.state.store
    store.documents.clear()
    store.threads.clear()
    yield
    store.documents.clear()
    store.threads.clear()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def make_doc():
    def _make(
        store: AppState, text: str = "hello", filename: str = "test.txt"
    ) -> Document:
        doc = Document(
            id=uuid4(),
            filename=filename,
            text=text,
            char_count=len(text),
            created_at=datetime.now(timezone.utc),
        )
        store.documents[doc.id] = doc
        return doc

    return _make
