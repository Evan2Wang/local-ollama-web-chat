from fastapi import APIRouter, HTTPException

from app.config import settings
from app.services.ollama_client import list_models

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
async def get_models():
    try:
        models = await list_models()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"无法连接 Ollama：{exc}") from exc
    return {"default_model": settings.default_model, "models": models}
