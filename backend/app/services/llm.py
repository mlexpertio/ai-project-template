from langchain_anthropic import ChatAnthropic
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from app.core.config import settings


def get_llm():
    provider = settings.ai_provider.lower()
    model = settings.model_name

    if provider == "ollama":
        return ChatOllama(model=model, base_url=settings.ollama_base_url)
    elif provider == "openai":
        return ChatOpenAI(model=model, api_key=settings.openai_api_key)
    elif provider == "anthropic":
        return ChatAnthropic(model=model, api_key=settings.anthropic_api_key)
    else:
        raise ValueError(f"Unknown AI provider: {provider}")
