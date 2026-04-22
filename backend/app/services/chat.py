from collections.abc import AsyncIterator
from datetime import datetime, timezone

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from app.services.graph import build_graph
from app.services.sse import encode_done, encode_error, encode_text
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

    graph = build_graph()
    graph_input = {
        "messages": _to_langchain_messages(thread.messages),
        "attached_docs": thread.attached_docs,
    }

    try:
        chunks: list[str] = []
        async for piece in graph.astream(graph_input, stream_mode="custom"):
            if piece:
                chunks.append(piece)
                yield encode_text(piece)

        thread.append_assistant("".join(chunks), now=datetime.now(timezone.utc))
        yield encode_done()
    except Exception as exc:
        yield encode_error(str(exc))
        yield encode_done()
