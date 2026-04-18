import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile
from fastapi.responses import JSONResponse
from langchain_text_splitters import CharacterTextSplitter, MarkdownHeaderTextSplitter

app = FastAPI()


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


documents: dict[str, dict] = {}

HEADERS_TO_SPLIT_ON = [
    ("#", "Header"),
    ("##", "SubHeader"),
    ("###", "SubSubHeader"),
]


def _chunk_text(text: str) -> list[dict]:
    markdown_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=HEADERS_TO_SPLIT_ON,
        strip_headers=False,
    )
    md_chunks = markdown_splitter.split_text(text)

    char_splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=500,
        chunk_overlap=50,
        length_function=len,
    )

    chunks: list[dict] = []
    index = 0
    for doc in md_chunks:
        sub_chunks = char_splitter.split_text(doc.page_content)
        for sub in sub_chunks:
            chunks.append({"index": index, "content": sub})
            index += 1
    return chunks


@app.post("/api/v1/documents")
async def upload_document(file: UploadFile):
    if not file.filename or not file.filename.endswith(".md"):
        return JSONResponse(
            status_code=400, content={"detail": "Only .md files accepted"}
        )

    content = await file.read()
    text = content.decode("utf-8")
    doc_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)

    chunks = _chunk_text(text)

    documents[doc_id] = {
        "id": doc_id,
        "filename": file.filename,
        "created_at": created_at.isoformat(),
        "chunks": chunks,
    }

    return {"id": doc_id, "filename": file.filename}


@app.get("/api/v1/documents/{doc_id}")
async def get_document(doc_id: str):
    doc = documents.get(doc_id)
    if doc is None:
        return JSONResponse(status_code=404, content={"detail": "Document not found"})
    return doc
