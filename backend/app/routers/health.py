from fastapi import APIRouter

from app.config import settings
from app.services.ollama_client import chat_once, get_tags, ollama_error_payload, ollama_url

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
def health():
    return {"ok": True}


@router.get("/config")
def health_config():
    return {
        "ollama_base_url": settings.ollama_base_url,
        "default_model": settings.default_model,
        "ollama_think": settings.ollama_think,
        "max_file_chars": settings.max_file_chars,
        "auth_enabled": settings.auth_enabled,
    }


@router.get("/ollama")
async def health_ollama():
    url = ollama_url("/api/tags")
    try:
        tags = await get_tags()
        return {
            "ok": True,
            "ollama_base_url": settings.ollama_base_url,
            "tags_url": url,
            "status_code": 200,
            "models": tags.get("models", []),
        }
    except Exception as exc:
        return {
            **ollama_error_payload(exc, url),
            "ollama_base_url": settings.ollama_base_url,
            "tags_url": url,
            "models": [],
        }


@router.get("/chat")
async def health_chat():
    url = ollama_url("/api/chat")
    model = settings.default_model
    try:
        response = await chat_once(model=model, content="你好，简单回复一句。")
        return {
            "ok": True,
            "ollama_base_url": settings.ollama_base_url,
            "chat_url": url,
            "status_code": 200,
            "model": model,
            "response": response,
        }
    except Exception as exc:
        return {
            **ollama_error_payload(exc, url),
            "ollama_base_url": settings.ollama_base_url,
            "chat_url": url,
            "model": model,
        }
