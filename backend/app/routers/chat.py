from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.schemas import ChatRequest
from app.services.chat import stream_chat

router = APIRouter()

_STREAM_HEADERS = {"x-vercel-ai-ui-message-stream": "v1"}


@router.post("/chat/stream")
async def chat_stream(request: Request, body: ChatRequest):
    thread = request.app.state.store.threads.get(body.id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    if not body.messages or body.messages[-1].role != "user":
        raise HTTPException(
            status_code=400, detail="Latest message must be from the user"
        )

    user_text = body.messages[-1].text_content()
    if not user_text:
        raise HTTPException(
            status_code=400, detail="Latest user message has no text content"
        )

    return StreamingResponse(
        stream_chat(thread, user_text),
        media_type="text/event-stream",
        headers=_STREAM_HEADERS,
    )
