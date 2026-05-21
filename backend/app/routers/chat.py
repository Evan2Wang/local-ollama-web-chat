from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import Attachment, Conversation, Message
from app.schemas import ChatRequest
from app.services.context_builder import build_messages, build_user_content
from app.services.ollama_client import model_supports_vision, stream_chat
from app.services.title_service import title_from_content

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    conversation = db.get(Conversation, payload.conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")

    model = payload.model or conversation.model
    attachments = list(db.scalars(select(Attachment).where(Attachment.id.in_(payload.attachment_ids)))) if payload.attachment_ids else []
    if len(attachments) != len(payload.attachment_ids):
        raise HTTPException(status_code=400, detail="部分附件不存在")

    user_content, _ = build_user_content(payload.content, attachments)
    if any(att.file_type == "image" for att in attachments) and not model_supports_vision(model):
        user_content += "\n\n【系统提示】当前模型看起来不是视觉模型，图片已保存为附件，但不会直接发送给 Ollama 识图。"

    if conversation.title == "新会话":
        conversation.title = title_from_content(payload.content)
    conversation.model = model
    conversation.updated_at = datetime.now(timezone.utc)

    messages = build_messages(db, conversation, user_content, attachments, model)

    user_message = Message(conversation_id=conversation.id, role="user", content=payload.content)
    db.add(user_message)
    db.flush()
    for att in attachments:
        att.message_id = user_message.id
    conversation_id = conversation.id
    db.commit()

    async def generate():
        full_text: list[str] = []
        try:
            async for chunk in stream_chat(model, messages):
                full_text.append(chunk)
                yield chunk
        except Exception as exc:
            yield f"\n\n[调用 Ollama 失败：{exc}]"
        finally:
            assistant_content = "".join(full_text).strip()
            if assistant_content:
                write_db = SessionLocal()
                try:
                    assistant = Message(conversation_id=conversation_id, role="assistant", content=assistant_content)
                    conv = write_db.get(Conversation, conversation_id)
                    if conv:
                        conv.updated_at = datetime.now(timezone.utc)
                    write_db.add(assistant)
                    write_db.commit()
                finally:
                    write_db.close()

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
