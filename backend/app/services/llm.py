from langchain.chat_models import init_chat_model

from app.config import settings


def get_llm():
    provider = settings.ai_provider.lower()
    model = settings.model_name

    kwargs = {}
    if provider == "ollama":
        kwargs["base_url"] = settings.ollama_base_url
    elif provider == "openai":
        kwargs["api_key"] = settings.openai_api_key
    elif provider == "anthropic":
        kwargs["api_key"] = settings.anthropic_api_key
    else:
        raise ValueError(f"Unknown AI provider: {provider}")

    return init_chat_model(f"{provider}:{model}", **kwargs)
