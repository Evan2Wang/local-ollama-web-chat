from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services.ollama_client import get_tags, ollama_error_payload, ollama_url

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models():
    url = ollama_url("/api/tags")
    try:
        tags = await get_tags()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=ollama_error_payload(exc, url)) from exc
    models = tags.get("models", [])
    return {"default_model": settings.default_model, "models": models}
