from datetime import datetime, timezone
from uuid import uuid4

import pytest
from langchain_core.messages import AIMessageChunk, HumanMessage, SystemMessage

from app.config import settings
from app.services.graph import compiled_graph
from app.services.llm import get_llm
from app.services import sse
from app.state import Document


class _StreamingMockLLM:
    """Async-streamable stand-in for a chat model."""

    def __init__(self, response: str):
        self._response = response
        self.astream_calls: list[list] = []

    async def astream(self, messages):
        self.astream_calls.append(messages)
        for word in self._response.split():
            yield AIMessageChunk(content=word + " ")


def test_sse_start():
    assert sse.start("msg_1") == 'data: {"type":"start","messageId":"msg_1"}\n\n'


def test_sse_text_start():
    assert sse.text_start("t1") == 'data: {"type":"text-start","id":"t1"}\n\n'


def test_sse_text_delta():
    assert (
        sse.text_delta("t1", "hello")
        == 'data: {"type":"text-delta","id":"t1","delta":"hello"}\n\n'
    )


def test_sse_text_end():
    assert sse.text_end("t1") == 'data: {"type":"text-end","id":"t1"}\n\n'


def test_sse_finish():
    assert sse.finish() == 'data: {"type":"finish"}\n\n'


def test_sse_error():
    assert sse.error("oops") == 'data: {"type":"error","errorText":"oops"}\n\n'


def test_sse_done():
    assert sse.done() == "data: [DONE]\n\n"


class TestLLMFactory:
    def test_unknown_provider_raises(self, monkeypatch):
        monkeypatch.setattr(settings, "ai_provider", "unknown")
        with pytest.raises(ValueError, match="Unknown AI provider"):
            get_llm()

    def test_ollama_provider(self, monkeypatch):
        monkeypatch.setattr(settings, "ai_provider", "ollama")
        monkeypatch.setattr(settings, "model_name", "llama3.2")
        monkeypatch.setattr(settings, "ollama_base_url", "http://ollama:11434")
        llm = get_llm()
        assert llm.model == "llama3.2"

    def test_openai_provider(self, monkeypatch):
        monkeypatch.setattr(settings, "ai_provider", "openai")
        monkeypatch.setattr(settings, "model_name", "gpt-4o-mini")
        monkeypatch.setattr(settings, "openai_api_key", "sk-test")
        llm = get_llm()
        assert llm.model_name == "gpt-4o-mini"

    def test_anthropic_provider(self, monkeypatch):
        monkeypatch.setattr(settings, "ai_provider", "anthropic")
        monkeypatch.setattr(settings, "model_name", "claude-haiku-4-5")
        monkeypatch.setattr(settings, "anthropic_api_key", "sk-ant-test")
        llm = get_llm()
        assert llm.model == "claude-haiku-4-5"


class TestGraph:
    @pytest.mark.asyncio
    async def test_graph_no_docs(self):
        from unittest.mock import patch

        mock_llm = _StreamingMockLLM("Hello!")
        with patch("app.services.graph.get_llm", return_value=mock_llm):
            pieces: list[str] = []
            async for piece in compiled_graph.astream(
                {
                    "messages": [HumanMessage(content="Hi")],
                    "attached_docs": [],
                },
                stream_mode="custom",
            ):
                pieces.append(piece)

        assert "".join(pieces) == "Hello! "
        # System prompt is always prepended, even with no docs
        passed = mock_llm.astream_calls[0]
        assert isinstance(passed[0], SystemMessage)
        assert "helpful ai assistant" in passed[0].content.lower()

    @pytest.mark.asyncio
    async def test_graph_with_docs(self):
        from unittest.mock import patch

        doc = Document(
            id=uuid4(),
            filename="data.txt",
            text="The answer is 42.",
            char_count=17,
            created_at=datetime.now(timezone.utc),
        )

        mock_llm = _StreamingMockLLM("Answer is 42.")
        with patch("app.services.graph.get_llm", return_value=mock_llm):
            pieces: list[str] = []
            async for piece in compiled_graph.astream(
                {
                    "messages": [HumanMessage(content="What is it?")],
                    "attached_docs": [doc],
                },
                stream_mode="custom",
            ):
                pieces.append(piece)

        passed = mock_llm.astream_calls[0]
        assert isinstance(passed[0], SystemMessage)
        assert "data.txt" in passed[0].content
        assert "The answer is 42." in passed[0].content
        assert "".join(pieces) == "Answer is 42. "
