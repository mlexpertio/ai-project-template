import uuid
from datetime import datetime, timezone

import pypdfium2 as pdfium
from fastapi import FastAPI, HTTPException, UploadFile
from starlette.responses import Response

app = FastAPI()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_MIME_TYPES = {"text/plain", "text/markdown", "application/pdf"}

documents: dict[str, dict] = {}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


def _extract_text(content: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        pdf = pdfium.PdfDocument(content)
        texts: list[str] = []
        for page in pdf:
            textpage = page.get_textpage()
            texts.append(textpage.get_text_bounded())
            textpage.close()
            page.close()
        pdf.close()
        return "\n".join(texts)
    return content.decode("utf-8")


@app.post("/api/v1/documents", status_code=201)
async def upload_document(file: UploadFile):
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported media type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large")

    text = _extract_text(content, content_type)
    doc_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)

    documents[doc_id] = {
        "id": doc_id,
        "filename": file.filename or "untitled",
        "text": text,
        "char_count": len(text),
        "created_at": created_at.isoformat(),
    }

    return {
        "id": doc_id,
        "filename": file.filename or "untitled",
        "char_count": len(text),
        "created_at": created_at.isoformat(),
    }


@app.get("/api/v1/documents")
async def list_documents():
    return [
        {
            "id": doc["id"],
            "filename": doc["filename"],
            "char_count": doc["char_count"],
            "created_at": doc["created_at"],
        }
        for doc in documents.values()
    ]


@app.delete("/api/v1/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    del documents[doc_id]
    return Response(status_code=204)
