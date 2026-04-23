from collections.abc import AsyncIterator
from datetime import datetime, timezone
from uuid import uuid4

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.services import sse
from app.services.graph import compiled_graph
from app.state import Message, Thread


def _to_langchain_messages(messages: list[Message]) -> list[BaseMessage]:
    converted: list[BaseMessage] = []
    for m in messages:
        if m.role == "user":
            converted.append(HumanMessage(content=m.content))
        else:
            converted.append(AIMessage(content=m.content))
    return converted


async def stream_chat(thread: Thread, user_message: str) -> AsyncIterator[str]:
    thread.append_user(user_message, now=datetime.now(timezone.utc))
    thread.ensure_titled_from_first_message()

    message_id = f"msg_{uuid4().hex}"
    part_id = f"txt_{uuid4().hex}"

    yield sse.start(message_id)
    yield sse.text_start(part_id)

    graph = compiled_graph
    graph_input = {
        "messages": _to_langchain_messages(thread.messages),
        "attached_docs": thread.attached_docs,
    }

    try:
        chunks: list[str] = []
        async for piece in graph.astream(graph_input, stream_mode="custom"):
            if piece:
                chunks.append(piece)
                yield sse.text_delta(part_id, piece)

        yield sse.text_end(part_id)
        thread.append_assistant("".join(chunks), now=datetime.now(timezone.utc))
        yield sse.finish()
        yield sse.done()
    except Exception as exc:
        yield sse.error(str(exc))
        yield sse.done()
