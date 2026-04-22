from importlib.resources import files
from typing import TypedDict

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from app.services.llm import get_llm
from app.state import Document

SYSTEM_PROMPT = (files("app") / "prompts" / "system.md").read_text()


class GraphState(TypedDict):
    messages: list[BaseMessage]
    attached_docs: list[Document]


async def generate(state: GraphState):
    messages = state["messages"]
    docs = state.get("attached_docs", [])

    system_parts = [SYSTEM_PROMPT]
    for doc in docs:
        system_parts.append(f"--- Context: {doc.filename} ---\n{doc.text}")
    llm_messages = [SystemMessage(content="\n\n".join(system_parts))] + messages

    writer = get_stream_writer()
    llm = get_llm()

    full_content = ""
    async for chunk in llm.astream(llm_messages):
        piece = str(chunk.content) if chunk.content else ""
        if piece:
            writer(piece)
            full_content += piece

    return {"messages": messages + [AIMessage(content=full_content)]}


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("generate", generate)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", END)
    return graph.compile()
