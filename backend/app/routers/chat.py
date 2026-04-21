from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from app.schemas import ChatRequest
from app.services.llm import get_llm
from app.services.sse import encode_done, encode_error, encode_text
from app.state import Message

router = APIRouter()


@router.post("/chat/stream")
async def chat_stream(request: Request, body: ChatRequest):
    store = request.app.state.store
    thread = store.threads.get(body.thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    now = datetime.now(timezone.utc)
    thread.messages.append(Message(role="user", content=body.message, created_at=now))
    thread.updated_at = now

    # Auto-derive title on first user message
    if len(thread.messages) == 1:
        thread.title = body.message[:60]

    async def event_generator():
        try:
            llm = get_llm()

            # Build message list for the LLM
            llm_messages = [HumanMessage(content=m.content) for m in thread.messages]

            # Build system message from attached docs
            system_parts: list[str] = []
            for doc in thread.attached_docs:
                system_parts.append(f"--- Context: {doc.filename} ---\n{doc.text}")
            if system_parts:
                from langchain_core.messages import SystemMessage

                llm_messages.insert(0, SystemMessage(content="\n\n".join(system_parts)))

            chunks: list[str] = []
            async for chunk in llm.astream(llm_messages):
                if chunk.content:
                    text_chunk = str(chunk.content)
                    chunks.append(text_chunk)
                    yield encode_text(text_chunk)

            # Append final assistant message
            full_content = "".join(chunks)
            thread.messages.append(
                Message(
                    role="assistant",
                    content=full_content,
                    created_at=datetime.now(timezone.utc),
                )
            )
            thread.updated_at = datetime.now(timezone.utc)

            yield encode_done()
        except Exception as exc:
            yield encode_error(str(exc))
            yield encode_done()

    return StreamingResponse(event_generator(), media_type="text/plain")
