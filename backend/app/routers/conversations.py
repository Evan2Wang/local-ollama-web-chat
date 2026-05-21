from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import get_db
from app.models import Attachment, Conversation, Message
from app.schemas import ConversationCreate, ConversationDetail, ConversationOut, ConversationSearchResult

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


@router.get("/search", response_model=list[ConversationSearchResult])
def search_conversations(q: str, db: Session = Depends(get_db)):
    keyword = q.strip()
    if not keyword:
        return []
    pattern = f"%{keyword}%"
    candidates = db.scalars(
        select(Conversation)
        .outerjoin(Message)
        .outerjoin(Attachment, Attachment.conversation_id == Conversation.id)
        .where(
            Conversation.title.ilike(pattern)
            | Message.content.ilike(pattern)
            | Attachment.filename.ilike(pattern)
        )
        .order_by(Conversation.updated_at.desc())
        .distinct()
    ).all()

    results: list[dict] = []
    for conversation in candidates:
        if keyword.casefold() in conversation.title.casefold():
            results.append(search_result(conversation, "title", conversation.title))
            continue
        message = db.scalar(
            select(Message)
            .where(Message.conversation_id == conversation.id, Message.content.ilike(pattern))
            .order_by(Message.created_at.desc())
        )
        if message:
            results.append(search_result(conversation, "message", message.content[:180]))
            continue
        attachment = db.scalar(
            select(Attachment)
            .where(Attachment.conversation_id == conversation.id, Attachment.filename.ilike(pattern))
            .order_by(Attachment.created_at.desc())
        )
        if attachment:
            results.append(search_result(conversation, "attachment", attachment.filename))
    return results


def search_result(conversation: Conversation, matched_type: str, matched_text: str) -> dict:
    return {
        "conversation_id": conversation.id,
        "title": conversation.title,
        "matched_type": matched_type,
        "matched_text": matched_text,
        "updated_at": conversation.updated_at,
    }


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
