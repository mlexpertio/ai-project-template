from typing import TypedDict

from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.services.llm import get_llm


class GraphState(TypedDict):
    messages: list[BaseMessage]
    attached_docs: list[dict]


def generate(state: GraphState):
    messages = state["messages"]
    docs = state.get("attached_docs", [])

    system_parts: list[str] = []
    for doc in docs:
        system_parts.append(f"--- Context: {doc['filename']} ---\n{doc['text']}")

    if system_parts:
        system_msg = SystemMessage(content="\n\n".join(system_parts))
        llm_messages = [system_msg] + messages
    else:
        llm_messages = messages

    llm = get_llm()
    response = llm.invoke(llm_messages)

    return {"messages": messages + [response]}


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("generate", generate)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", END)
    return graph.compile()
