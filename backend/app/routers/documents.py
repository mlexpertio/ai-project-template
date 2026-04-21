import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, UploadFile
from starlette.responses import Response

from app.schemas import DocumentResponse
from app.services.parse import extract_text
from app.state import Document

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = {"text/plain", "text/markdown", "application/pdf"}


@router.post("/documents", status_code=201, response_model=DocumentResponse)
async def upload_document(request: Request, file: UploadFile):
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported media type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    text = extract_text(content, content_type)
    doc_id = uuid.uuid4()
    created_at = datetime.now(timezone.utc)

    doc = Document(
        id=doc_id,
        filename=file.filename or "untitled",
        text=text,
        char_count=len(text),
        created_at=created_at,
    )
    request.app.state.store.documents[doc_id] = doc

    return {
        "id": doc.id,
        "filename": doc.filename,
        "char_count": doc.char_count,
        "created_at": doc.created_at,
    }


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(request: Request):
    docs = request.app.state.store.documents.values()
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "char_count": doc.char_count,
            "created_at": doc.created_at,
        }
        for doc in docs
    ]


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(request: Request, doc_id: str):
    try:
        doc_uuid = UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Document not found")

    store = request.app.state.store
    if doc_uuid not in store.documents:
        raise HTTPException(status_code=404, detail="Document not found")
    del store.documents[doc_uuid]
    return Response(status_code=204)
