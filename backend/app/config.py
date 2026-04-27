import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        self.ai_provider = os.getenv("AI_PROVIDER", "ollama")
        self.model_name = os.getenv("MODEL_NAME", "qwen3:4b")
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.cors_origins = os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://frontend:3000"
        )
        self.max_context_chars = int(os.getenv("MAX_CONTEXT_CHARS", "25000"))


settings = Settings()
