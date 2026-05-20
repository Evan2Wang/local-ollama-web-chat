from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import get_db
from app.models import Conversation, Message
from app.schemas import ConversationCreate, ConversationDetail, ConversationOut

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.post("", response_model=ConversationOut)
def create_conversation(payload: ConversationCreate, db: Session = Depends(get_db)):
    conversation = Conversation(
        title="新会话",
        model=payload.model or settings.default_model,
        system_prompt=payload.system_prompt or settings.system_prompt,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db)):
    return db.scalars(select(Conversation).order_by(Conversation.updated_at.desc())).all()


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conversation = db.scalar(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages).selectinload(Message.attachments))
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")
    conversation.messages.sort(key=lambda item: item.created_at)
    return conversation


@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="会话不存在")
    db.delete(conversation)
    db.commit()
    return {"ok": True}
