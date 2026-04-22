from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.schemas import ChatRequest
from app.services.graph import build_graph
from app.services.sse import encode_done, encode_error, encode_text
from app.state import Message

router = APIRouter()


def _to_langchain_messages(messages: list[Message]) -> list[BaseMessage]:
    converted: list[BaseMessage] = []
    for m in messages:
        if m.role == "user":
            converted.append(HumanMessage(content=m.content))
        else:
            converted.append(AIMessage(content=m.content))
    return converted


@router.post("/chat/stream")
async def chat_stream(request: Request, body: ChatRequest):
    store = request.app.state.store
    thread = store.threads.get(body.thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    now = datetime.now(timezone.utc)
    thread.messages.append(Message(role="user", content=body.message, created_at=now))
    thread.updated_at = now

    if len(thread.messages) == 1:
        thread.title = body.message[:60]

    async def event_generator():
        try:
            graph = build_graph()
            graph_input = {
                "messages": _to_langchain_messages(thread.messages),
                "attached_docs": thread.attached_docs,
            }

            chunks: list[str] = []
            async for piece in graph.astream(graph_input, stream_mode="custom"):
                if piece:
                    chunks.append(piece)
                    yield encode_text(piece)

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
