import uuid
from copy import deepcopy
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from starlette.responses import Response

from app.core.config import settings
from app.schemas import (
    ThreadCreateRequest,
    ThreadCreateResponse,
    ThreadDetailResponse,
    ThreadDocumentMeta,
    ThreadListResponse,
)
from app.state import Thread

router = APIRouter()


@router.post("/threads", status_code=201, response_model=ThreadCreateResponse)
async def create_thread(request: Request, body: ThreadCreateRequest):
    store = request.app.state.store
    doc_ids = body.document_ids or []

    # Validate all IDs exist
    for doc_id in doc_ids:
        if doc_id not in store.documents:
            raise HTTPException(status_code=400, detail="Unknown document_ids")

    # Snapshot docs and cap combined text
    attached = [deepcopy(store.documents[doc_id]) for doc_id in doc_ids]
    total_chars = sum(d.char_count for d in attached)
    if total_chars > settings.max_context_chars:
        raise HTTPException(
            status_code=400, detail="Combined attached text exceeds MAX_CONTEXT_CHARS"
        )

    tid = uuid.uuid4()
    now = datetime.now(timezone.utc)
    thread = Thread(
        id=tid,
        title=None,
        attached_docs=attached,
        messages=[],
        created_at=now,
        updated_at=now,
    )
    store.threads[tid] = thread

    return {
        "id": tid,
        "created_at": now,
        "documents": [
            ThreadDocumentMeta(id=d.id, filename=d.filename) for d in attached
        ],
    }


@router.get("/threads", response_model=list[ThreadListResponse])
async def list_threads(request: Request):
    store = request.app.state.store
    return [
        {
            "id": t.id,
            "title": t.title,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        }
        for t in store.threads.values()
    ]


@router.get("/threads/{thread_id}", response_model=ThreadDetailResponse)
async def get_thread(request: Request, thread_id: UUID):
    store = request.app.state.store
    thread = store.threads.get(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    return {
        "id": thread.id,
        "title": thread.title,
        "created_at": thread.created_at,
        "messages": [
            {"role": m.role, "content": m.content, "created_at": m.created_at}
            for m in thread.messages
        ],
        "documents": [
            ThreadDocumentMeta(id=d.id, filename=d.filename)
            for d in thread.attached_docs
        ],
    }


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(request: Request, thread_id: UUID):
    store = request.app.state.store
    if thread_id not in store.threads:
        raise HTTPException(status_code=404, detail="Thread not found")
    del store.threads[thread_id]
    return Response(status_code=204)
