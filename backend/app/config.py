from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"


class Settings(BaseSettings):
    ollama_base_url: str = Field(
        default="http://127.0.0.1:11434",
        validation_alias=AliasChoices("OLLAMA_BASE_URL", "LOCAL_CHAT_OLLAMA_BASE_URL"),
    )
    default_model: str = Field(default="qwen3.6:35b-a3b", validation_alias=AliasChoices("DEFAULT_MODEL", "LOCAL_CHAT_DEFAULT_MODEL"))
    ollama_think: bool = Field(default=True, validation_alias=AliasChoices("OLLAMA_THINK", "LOCAL_CHAT_OLLAMA_THINK"))
    auth_enabled: bool = Field(default=True, validation_alias=AliasChoices("AUTH_ENABLED", "LOCAL_CHAT_AUTH_ENABLED"))
    app_token: str = Field(default="your-local-secret-token", validation_alias=AliasChoices("APP_TOKEN", "LOCAL_CHAT_APP_TOKEN"))
    system_prompt: str = Field(default="你是一个本地中文助手，请用中文回答，结构清晰。", validation_alias=AliasChoices("SYSTEM_PROMPT", "LOCAL_CHAT_SYSTEM_PROMPT"))
    max_context_messages: int = Field(default=40, validation_alias=AliasChoices("MAX_CONTEXT_MESSAGES", "LOCAL_CHAT_MAX_CONTEXT_MESSAGES"))
    max_file_chars: int = Field(default=1000000, validation_alias=AliasChoices("MAX_FILE_CHARS", "LOCAL_CHAT_MAX_FILE_CHARS"))
    vision_model_keywords: str = Field(
        default="llava,bakllava,moondream,qwen-vl,qwen2-vl,qwen2.5vl,qwen2.5-vl,qwen3.5,minicpm-v,gemma3",
        validation_alias=AliasChoices("VISION_MODEL_KEYWORDS", "LOCAL_CHAT_VISION_MODEL_KEYWORDS"),
    )

    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", extra="ignore")

    @field_validator("ollama_base_url")
    @classmethod
    def normalize_ollama_base_url(cls, value: str) -> str:
        normalized = value.strip().replace("://localhost", "://127.0.0.1").rstrip("/")
        if normalized.endswith("/api"):
            normalized = normalized[:-4]
        return normalized

    @property
    def database_url(self) -> str:
        return f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"


settings = Settings()
