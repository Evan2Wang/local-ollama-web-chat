import json

import httpx

from app.config import settings

TAGS_TIMEOUT = httpx.Timeout(30.0)
CHAT_TIMEOUT = httpx.Timeout(300.0)


def model_supports_vision(model: str) -> bool:
    name = model.lower()
    return any(keyword.strip() and keyword.strip() in name for keyword in settings.vision_model_keywords.lower().split(","))


def ollama_url(path: str) -> str:
    return f"{settings.ollama_base_url}{path}"


def ollama_error_payload(exc: Exception, url: str) -> dict:
    if isinstance(exc, httpx.HTTPStatusError):
        return {
            "ok": False,
            "error": f"Ollama returned HTTP {exc.response.status_code}",
            "url": url,
            "status_code": exc.response.status_code,
            "detail": exc.response.text,
        }
    if isinstance(exc, httpx.RequestError):
        return {
            "ok": False,
            "error": exc.__class__.__name__,
            "url": url,
            "status_code": None,
            "detail": str(exc),
        }
    return {
        "ok": False,
        "error": exc.__class__.__name__,
        "url": url,
        "status_code": None,
        "detail": str(exc),
    }


async def list_models() -> list[dict]:
    data = await get_tags()
    return data.get("models", [])


async def get_tags() -> dict:
    url = ollama_url("/api/tags")
    async with httpx.AsyncClient(timeout=TAGS_TIMEOUT, trust_env=False) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def chat_once(model: str, content: str) -> dict:
    url = ollama_url("/api/chat")
    payload = {
        "model": model,
        "stream": False,
        "messages": [{"role": "user", "content": content}],
    }
    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT, trust_env=False) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


async def stream_chat(model: str, messages: list[dict]):
    payload = {"model": model, "messages": messages, "stream": True}
    url = ollama_url("/api/chat")
    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT, trust_env=False) as client:
        async with client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                if "message" in data:
                    yield data["message"].get("content", "")
                if data.get("done"):
                    break
