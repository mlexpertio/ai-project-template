from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from starlette.responses import Response

from app.config import settings
from app.schemas import (
    ThreadCreateRequest,
    ThreadCreateResponse,
    ThreadDetailResponse,
    ThreadDocumentMeta,
    ThreadListResponse,
)
from app.state import ContextLimitExceeded, Document, Thread

router = APIRouter()


@router.post("/threads", status_code=201, response_model=ThreadCreateResponse)
async def create_thread(request: Request, body: ThreadCreateRequest):
    store = request.app.state.store
    doc_ids = body.document_ids or []

    docs: list[Document] = []
    for doc_id in doc_ids:
        doc = store.documents.get(doc_id)
        if doc is None:
            raise HTTPException(status_code=400, detail="Unknown document_ids")
        docs.append(doc)

    try:
        thread = Thread.create(
            docs,
            max_context_chars=settings.max_context_chars,
            now=datetime.now(timezone.utc),
        )
    except ContextLimitExceeded as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    store.threads[thread.id] = thread

    return {
        "id": thread.id,
        "created_at": thread.created_at,
        "documents": [
            ThreadDocumentMeta(id=d.id, filename=d.filename)
            for d in thread.attached_docs
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
