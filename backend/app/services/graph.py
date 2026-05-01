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
    in_thinking = False
    async for chunk in llm.astream(llm_messages):
        reasoning = chunk.additional_kwargs.get("reasoning_content")
        content = str(chunk.content) if chunk.content else ""

        if reasoning:
            if not in_thinking:
                in_thinking = True
                writer("<think>")
                full_content += "<think>"
        elif content and in_thinking:
            in_thinking = False
            writer("</think>")
            full_content += "</think>"

        if reasoning:
            writer(reasoning)
            full_content += reasoning
        elif content:
            writer(content)
            full_content += content

    if in_thinking:
        writer("</think>")
        full_content += "</think>"

    return {"messages": messages + [AIMessage(content=full_content)]}


def _build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("generate", generate)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", END)
    return graph.compile()


compiled_graph = _build_graph()
