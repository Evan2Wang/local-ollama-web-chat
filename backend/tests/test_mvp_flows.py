import base64
from collections.abc import AsyncGenerator

from fastapi.testclient import TestClient

from app.routers import health as health_router
from app.routers import models as models_router
from app.routers import chat as chat_router

PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aV0AAAAASUVORK5CYII="
)


def create_conversation(client: TestClient, model: str = "qwen3.5:2b") -> str:
    response = client.post("/api/conversations", json={"model": model})
    assert response.status_code == 200
    return response.json()["id"]


def stream_text(chunks: list[str]) -> AsyncGenerator[str, None]:
    async def generate():
        for chunk in chunks:
            yield chunk

    return generate()


def test_models_proxy_uses_available_model_fallback(client: TestClient, monkeypatch):
    async def fake_tags():
        return {"models": [{"name": "qwen3.5:2b", "model": "qwen3.5:2b"}]}

    monkeypatch.setattr(models_router, "get_tags", fake_tags)

    response = client.get("/api/models")

    assert response.status_code == 200
    assert response.json() == {
        "default_model": "qwen3.5:2b",
        "models": [{"name": "qwen3.5:2b", "model": "qwen3.5:2b"}],
    }


def test_ollama_health_reports_tags_url_and_models(client: TestClient, monkeypatch):
    async def fake_tags():
        return {"models": [{"name": "fixture-model", "model": "fixture-model"}]}

    monkeypatch.setattr(health_router, "get_tags", fake_tags)

    response = client.get("/api/health/ollama")
    body = response.json()

    assert response.status_code == 200
    assert body["ok"] is True
    assert body["ollama_base_url"] == "http://127.0.0.1:11434"
    assert body["tags_url"] == "http://127.0.0.1:11434/api/tags"
    assert body["models"][0]["name"] == "fixture-model"


def test_streaming_chat_persists_history(client: TestClient, monkeypatch):
    conversation_id = create_conversation(client)

    async def fake_stream_chat(model: str, messages: list[dict]):
        assert model == "qwen3.5:2b"
        assert messages[-1]["content"] == "你好"
        async for chunk in stream_text(["流式", "回答"]):
            yield chunk

    monkeypatch.setattr(chat_router, "stream_chat", fake_stream_chat)

    response = client.post(
        "/api/chat",
        json={"conversation_id": conversation_id, "model": "qwen3.5:2b", "content": "你好", "attachment_ids": []},
    )
    detail = client.get(f"/api/conversations/{conversation_id}").json()

    assert response.status_code == 200
    assert response.text == "流式回答"
    assert [message["role"] for message in detail["messages"]] == ["user", "assistant"]
    assert detail["messages"][1]["content"] == "流式回答"
    assert detail["title"] == "你好"


def test_text_attachment_is_parsed_and_sent_to_chat(client: TestClient, monkeypatch):
    conversation_id = create_conversation(client)
    upload = client.post(
        "/api/attachments",
        data={"conversation_id": conversation_id},
        files=[("files", ("brief.md", b"# Project\nThe launch color is amber.", "text/markdown"))],
    )
    attachment = upload.json()[0]
    captured: dict = {}

    async def fake_stream_chat(model: str, messages: list[dict]):
        captured["messages"] = messages
        async for chunk in stream_text(["文件已读取"]):
            yield chunk

    monkeypatch.setattr(chat_router, "stream_chat", fake_stream_chat)

    response = client.post(
        "/api/chat",
        json={
            "conversation_id": conversation_id,
            "model": "qwen3.5:2b",
            "content": "文件里的颜色是什么？",
            "attachment_ids": [attachment["id"]],
        },
    )
    detail = client.get(f"/api/conversations/{conversation_id}").json()
    sent_content = captured["messages"][-1]["content"]

    assert upload.status_code == 200
    assert attachment["status"] == "parsed"
    assert response.text == "文件已读取"
    assert "brief.md" in sent_content
    assert "launch color is amber" in sent_content
    assert detail["messages"][0]["attachments"][0]["filename"] == "brief.md"


def test_vision_attachment_becomes_ollama_image_payload(client: TestClient, monkeypatch):
    conversation_id = create_conversation(client)
    upload = client.post(
        "/api/attachments",
        data={"conversation_id": conversation_id},
        files=[("files", ("pixel.png", PNG_BYTES, "image/png"))],
    )
    attachment = upload.json()[0]
    captured: dict = {}

    async def fake_stream_chat(model: str, messages: list[dict]):
        captured["messages"] = messages
        async for chunk in stream_text(["图片已发送"]):
            yield chunk

    monkeypatch.setattr(chat_router, "stream_chat", fake_stream_chat)

    response = client.post(
        "/api/chat",
        json={
            "conversation_id": conversation_id,
            "model": "qwen3.5:2b",
            "content": "识别图片",
            "attachment_ids": [attachment["id"]],
        },
    )
    last_message = captured["messages"][-1]

    assert upload.status_code == 200
    assert attachment["file_type"] == "image"
    assert response.text == "图片已发送"
    assert last_message["content"] == "识别图片"
    assert last_message["images"] == [base64.b64encode(PNG_BYTES).decode("ascii")]


def test_corrupt_document_upload_is_marked_failed(client: TestClient):
    conversation_id = create_conversation(client)

    response = client.post(
        "/api/attachments",
        data={"conversation_id": conversation_id},
        files=[("files", ("broken.pdf", b"this is not a valid pdf", "application/pdf"))],
    )

    assert response.status_code == 200
    assert response.json()[0]["status"] == "failed"


def test_chat_rejects_attachment_from_another_conversation(client: TestClient):
    owner_id = create_conversation(client)
    other_id = create_conversation(client)
    upload = client.post(
        "/api/attachments",
        data={"conversation_id": owner_id},
        files=[("files", ("owner-note.txt", b"private owner attachment", "text/plain"))],
    )

    response = client.post(
        "/api/chat",
        json={
            "conversation_id": other_id,
            "model": "qwen3.5:2b",
            "content": "读取附件",
            "attachment_ids": [upload.json()[0]["id"]],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "附件不属于当前会话"
