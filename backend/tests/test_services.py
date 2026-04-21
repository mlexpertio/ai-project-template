import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.core.config import settings
from app.services.graph import build_graph
from app.services.llm import get_llm
from app.services.sse import encode_done, encode_error, encode_text


def test_encode_text():
    assert encode_text("hello") == '0:"hello"\n'


def test_encode_error():
    assert encode_error("oops") == '3:"oops"\n'


def test_encode_done():
    assert encode_done() == "d\n"


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
    def test_graph_no_docs(self):
        from unittest.mock import patch

        with patch("app.services.graph.get_llm") as mock_get_llm:
            mock_llm = mock_get_llm.return_value
            mock_llm.invoke.return_value = AIMessage(content="Hello!")

            graph = build_graph()
            result = graph.invoke(
                {
                    "messages": [HumanMessage(content="Hi")],
                    "attached_docs": [],
                }
            )

        assert len(result["messages"]) == 2
        assert result["messages"][1].content == "Hello!"

    def test_graph_with_docs(self):
        from unittest.mock import patch

        with patch("app.services.graph.get_llm") as mock_get_llm:
            mock_llm = mock_get_llm.return_value
            mock_llm.invoke.return_value = AIMessage(content="Answer is 42.")

            graph = build_graph()
            result = graph.invoke(
                {
                    "messages": [HumanMessage(content="What is it?")],
                    "attached_docs": [
                        {"filename": "data.txt", "text": "The answer is 42."}
                    ],
                }
            )

        # System message should be prepended
        call_args = mock_llm.invoke.call_args[0][0]
        assert isinstance(call_args[0], SystemMessage)
        assert "data.txt" in call_args[0].content
        assert "The answer is 42." in call_args[0].content
        assert result["messages"][-1].content == "Answer is 42."
