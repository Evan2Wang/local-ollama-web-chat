import base64
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.config import DATA_DIR
from app.models import Attachment, Conversation, Message
from app.services.file_parser import read_parsed_text
from app.services.ollama_client import model_supports_vision


def build_user_content(content: str, attachments: list[Attachment]) -> tuple[str, bool]:
    file_sections: list[str] = []
    truncated = False
    for att in attachments:
        if att.file_type != "file" or att.status != "parsed":
            continue
        text = read_parsed_text(att.parsed_text_path)
        if att.is_truncated:
            truncated = True
        file_sections.append(f"【文件：{att.filename}】\n{text}")

    if not file_sections:
        return content, False

    warning = "注意：部分文件内容过长，以下仅包含截断后的前半部分，请在回答开头提示用户内容已截断。\n\n" if truncated else ""
    prompt = (
        f"{warning}用户问题：\n{content}\n\n"
        "以下是用户上传的文件内容，请基于这些内容回答：\n\n"
        + "\n\n".join(file_sections)
        + "\n\n回答要求：\n1. 优先基于文件内容回答；\n2. 如果文件内容不足，请明确说明；\n3. 不要编造文件中没有的信息；\n4. 用中文回答；\n5. 结构清晰，必要时使用表格。"
    )
    return prompt, truncated


def image_payloads(model: str, attachments: list[Attachment]) -> list[str]:
    if not model_supports_vision(model):
        return []
    images: list[str] = []
    for att in attachments:
        path = Path(att.storage_path)
        if att.storage_path.startswith("/uploads/"):
            path = DATA_DIR / "uploads" / att.storage_path.removeprefix("/uploads/")
        if att.file_type == "image" and path.exists():
            images.append(base64.b64encode(path.read_bytes()).decode("ascii"))
    return images


def build_messages(db: Session, conversation: Conversation, current_content: str, attachments: list[Attachment], model: str) -> list[dict]:
    history = list(
        db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(settings.max_context_messages)
        )
    )
    history.reverse()
    messages: list[dict] = [{"role": "system", "content": conversation.system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    user_message: dict = {"role": "user", "content": current_content}
    images = image_payloads(model, attachments)
    if images:
        user_message["images"] = images
    messages.append(user_message)
    return messages
