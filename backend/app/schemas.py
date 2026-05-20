from datetime import datetime

from pydantic import BaseModel


class AttachmentOut(BaseModel):
    id: str
    message_id: str | None
    conversation_id: str
    filename: str
    file_type: str
    mime_type: str
    size: int
    storage_path: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    created_at: datetime
    attachments: list[AttachmentOut] = []

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    model: str | None = None
    system_prompt: str | None = None


class ConversationOut(BaseModel):
    id: str
    title: str
    model: str
    system_prompt: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class ChatRequest(BaseModel):
    conversation_id: str
    model: str | None = None
    content: str
    attachment_ids: list[str] = []
    stream: bool = True
