from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"


class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    default_model: str = "qwen3.6:35b"
    system_prompt: str = "你是一个本地中文助手，请用中文回答，结构清晰。"
    max_context_messages: int = 40
    max_file_chars: int = 30000
    vision_model_keywords: str = "llava,bakllava,moondream,qwen-vl,qwen2-vl,qwen2.5vl,qwen2.5-vl,minicpm-v,gemma3"

    model_config = SettingsConfigDict(env_file=ROOT_DIR / ".env", env_prefix="LOCAL_CHAT_")

    @property
    def database_url(self) -> str:
        return f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"


settings = Settings()
