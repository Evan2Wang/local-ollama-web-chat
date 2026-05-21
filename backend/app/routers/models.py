from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services.ollama_client import get_tags, ollama_error_payload, ollama_url

router = APIRouter(prefix="/api/models", tags=["models"])


def available_default_model(models: list[dict]) -> str:
    model_names = {model.get("name") or model.get("model") for model in models}
    if settings.default_model in model_names:
        return settings.default_model
    first_model = models[0] if models else {}
    return first_model.get("name") or first_model.get("model") or settings.default_model


@router.get("")
async def get_models():
    url = ollama_url("/api/tags")
    try:
        tags = await get_tags()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=ollama_error_payload(exc, url)) from exc
    models = tags.get("models", [])
    return {"default_model": available_default_model(models), "models": models}
