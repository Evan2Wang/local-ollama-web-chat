import json

import httpx

from app.config import settings


def model_supports_vision(model: str) -> bool:
    name = model.lower()
    return any(keyword.strip() and keyword.strip() in name for keyword in settings.vision_model_keywords.lower().split(","))


async def list_models() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(f"{settings.ollama_base_url}/api/tags")
        response.raise_for_status()
        return response.json().get("models", [])


async def stream_chat(model: str, messages: list[dict]):
    payload = {"model": model, "messages": messages, "stream": True}
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", f"{settings.ollama_base_url}/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                if "message" in data:
                    yield data["message"].get("content", "")
                if data.get("done"):
                    break
