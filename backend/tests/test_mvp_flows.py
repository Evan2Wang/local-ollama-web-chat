import base64
from collections.abc import AsyncGenerator

from fastapi.testclient import TestClient

from app.routers import health as health_router
from app.routers import models as models_router
from app.routers import chat as chat_router
from app.config import settings

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


def test_health_config_reports_local_runtime_settings(client: TestClient):
    response = client.get("/api/health/config")

    assert response.status_code == 200
    assert response.json() == {
        "ollama_base_url": "http://127.0.0.1:11434",
        "default_model": settings.default_model,
        "ollama_think": settings.ollama_think,
        "max_file_chars": settings.max_file_chars,
        "auth_enabled": False,
    }


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


def test_retry_streams_new_assistant_without_duplicating_user_message(client: TestClient, monkeypatch):
    conversation_id = create_conversation(client)
    retry_context: dict = {}

    async def first_answer(model: str, messages: list[dict]):
        async for chunk in stream_text(["首次回答"]):
            yield chunk

    monkeypatch.setattr(chat_router, "stream_chat", first_answer)
    client.post(
        "/api/chat",
        json={"conversation_id": conversation_id, "model": "qwen3.5:2b", "content": "请重试我", "attachment_ids": []},
    )
    user_message_id = client.get(f"/api/conversations/{conversation_id}").json()["messages"][0]["id"]

    async def retry_answer(model: str, messages: list[dict]):
        retry_context["messages"] = messages
        async for chunk in stream_text(["恢复后的回答"]):
            yield chunk

    monkeypatch.setattr(chat_router, "stream_chat", retry_answer)
    response = client.post("/api/chat/retry", json={"message_id": user_message_id, "model": "qwen3.5:2b"})
    detail = client.get(f"/api/conversations/{conversation_id}").json()

    assert response.status_code == 200
    assert response.text == "恢复后的回答"
    assert [message["role"] for message in detail["messages"]] == ["user", "assistant", "assistant"]
    assert detail["messages"][0]["content"] == "请重试我"
    assert retry_context["messages"][-1]["content"] == "请重试我"
    assert [message["role"] for message in retry_context["messages"]] == ["system", "user"]


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


def test_text_attachment_reports_truncation_metadata(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "max_file_chars", 5)
    conversation_id = create_conversation(client)

    upload = client.post(
        "/api/attachments",
        data={"conversation_id": conversation_id},
        files=[("files", ("long-note.txt", b"123456789", "text/plain"))],
    )
    attachment = upload.json()[0]
    detail = client.get(f"/api/attachments/{attachment['id']}").json()

    assert upload.status_code == 200
    assert detail["parsed_text_preview"] == "12345"
    assert detail["original_chars"] == 9
    assert detail["used_chars"] == 5
    assert detail["is_truncated"] is True


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


def test_token_auth_protects_api_but_leaves_config_and_ollama_health_public(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "auth_enabled", True)
    monkeypatch.setattr(settings, "app_token", "test-token")

    async def fake_tags():
        return {"models": []}

    monkeypatch.setattr(health_router, "get_tags", fake_tags)

    assert client.get("/api/health/config").status_code == 200
    assert client.get("/api/health/ollama").status_code == 200
    assert client.get("/api/conversations").status_code == 401
    assert client.post("/api/auth/check", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/api/conversations", headers={"Authorization": "Bearer test-token"}).status_code == 200


def test_prompt_template_lifecycle(client: TestClient):
    created = client.post(
        "/api/prompt-templates",
        json={"name": "验收模板", "content": "请读取附件", "category": "测试", "sort_order": 99, "enabled": True},
    )
    template_id = created.json()["id"]

    updated = client.patch(
        f"/api/prompt-templates/{template_id}",
        json={"name": "验收模板-已改", "content": "请提取结论", "enabled": False},
    )
    listed = client.get("/api/prompt-templates").json()
    deleted = client.delete(f"/api/prompt-templates/{template_id}")

    assert created.status_code == 200
    assert updated.status_code == 200
    assert updated.json()["name"] == "验收模板-已改"
    assert updated.json()["content"] == "请提取结论"
    assert updated.json()["enabled"] is False
    assert any(item["id"] == template_id for item in listed)
    assert deleted.status_code == 200
    assert all(item["id"] != template_id for item in client.get("/api/prompt-templates").json())


def test_attachment_detail_reparse_and_filename_search(client: TestClient):
    conversation_id = create_conversation(client)
    upload = client.post(
        "/api/attachments",
        data={"conversation_id": conversation_id},
        files=[("files", ("searchable-note.txt", b"alpha search body", "text/plain"))],
    )
    attachment_id = upload.json()[0]["id"]

    detail = client.get(f"/api/attachments/{attachment_id}").json()
    reparsed = client.post(f"/api/attachments/{attachment_id}/reparse").json()
    attachment_search = client.get("/api/conversations/search", params={"q": "searchable-note"}).json()

    assert detail["parsed_text_preview"] == "alpha search body"
    assert detail["original_chars"] == len("alpha search body")
    assert reparsed["status"] == "parsed"
    assert attachment_search[0]["conversation_id"] == conversation_id
    assert attachment_search[0]["matched_type"] == "attachment"


def test_conversation_search_matches_title_and_message(client: TestClient, monkeypatch):
    conversation_id = create_conversation(client)

    async def fake_stream_chat(model: str, messages: list[dict]):
        async for chunk in stream_text(["beta answer detail"]):
            yield chunk

    monkeypatch.setattr(chat_router, "stream_chat", fake_stream_chat)
    client.post(
        "/api/chat",
        json={
            "conversation_id": conversation_id,
            "model": "qwen3.5:2b",
            "content": "title needle",
            "attachment_ids": [],
        },
    )

    title_search = client.get("/api/conversations/search", params={"q": "title needle"}).json()
    message_search = client.get("/api/conversations/search", params={"q": "beta answer"}).json()

    assert title_search[0]["conversation_id"] == conversation_id
    assert title_search[0]["matched_type"] == "title"
    assert message_search[0]["conversation_id"] == conversation_id
    assert message_search[0]["matched_type"] == "message"
