import asyncio
import json
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI(title="mock-ollama")


@app.get("/api/tags")
def tags():
    now = datetime.now(timezone.utc).isoformat()
    return {
        "models": [
            {
                "name": "qwen3.6:35b",
                "model": "qwen3.6:35b",
                "modified_at": now,
                "size": 35_000_000_000,
                "digest": "mock-qwen-text",
                "details": {
                    "format": "mock",
                    "family": "qwen",
                    "parameter_size": "35B",
                    "quantization_level": "Q4_K_M",
                },
            },
            {
                "name": "mock-vision:latest",
                "model": "mock-vision:latest",
                "modified_at": now,
                "size": 8_000_000_000,
                "digest": "mock-vision",
                "details": {
                    "format": "mock",
                    "family": "vision",
                    "parameter_size": "8B",
                    "quantization_level": "Q4_K_M",
                },
            },
        ]
    }


def latest_user_message(messages: list[dict]) -> dict:
    for message in reversed(messages):
        if message.get("role") == "user":
            return message
    return {"content": ""}


def build_answer(payload: dict) -> str:
    messages = payload.get("messages", [])
    current = latest_user_message(messages)
    content = current.get("content", "")
    image_count = len(current.get("images", []) or [])
    history_count = len([item for item in messages if item.get("role") != "system"])

    file_hint = ""
    if "以下是用户上传的文件内容" in content:
        file_hint = "\n\n我检测到了上传文件内容，说明后端已经把附件解析文本拼接进本轮请求。"
    image_hint = ""
    if image_count:
        image_hint = f"\n\n我收到了 {image_count} 张图片的 Base64 数据，说明视觉模型分支已经打通。"

    preview = content.strip().replace("\r", " ").replace("\n", " ")
    if len(preview) > 260:
        preview = preview[:260] + "..."

    return (
        "这是来自 Mock Ollama 的流式回复。\n\n"
        f"- 模型：`{payload.get('model', 'unknown')}`\n"
        f"- 本次上下文消息数：{history_count}\n"
        f"- 用户问题预览：{preview or '空输入'}"
        f"{file_hint}{image_hint}\n\n"
        "你可以用它测试前端流式输出、Markdown 渲染、历史记录、附件展示和文件解析链路。"
    )


@app.post("/api/chat")
async def chat(request: Request):
    payload = await request.json()
    stream = payload.get("stream", True)
    answer = build_answer(payload)

    if not stream:
        return {
            "model": payload.get("model", "mock"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "message": {"role": "assistant", "content": answer},
            "done": True,
        }

    async def generate():
        for char in answer:
            packet = {
                "model": payload.get("model", "mock"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "message": {"role": "assistant", "content": char},
                "done": False,
            }
            yield json.dumps(packet, ensure_ascii=False) + "\n"
            await asyncio.sleep(0.01)
        yield json.dumps({"done": True}, ensure_ascii=False) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
