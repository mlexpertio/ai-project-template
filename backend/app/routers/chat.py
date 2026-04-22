from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.schemas import ChatRequest
from app.services.chat import stream_chat

router = APIRouter()


@router.post("/chat/stream")
async def chat_stream(request: Request, body: ChatRequest):
    thread = request.app.state.store.threads.get(body.thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    return StreamingResponse(stream_chat(thread, body.message), media_type="text/plain")
