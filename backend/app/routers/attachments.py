from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Attachment, Conversation
from app.schemas import AttachmentOut
from app.services.file_parser import parse_file
from app.storage.file_store import is_supported, public_upload_path, save_upload

router = APIRouter(prefix="/api/attachments", tags=["attachments"])


@router.post("", response_model=list[AttachmentOut])
async def upload_attachments(
    conversation_id: str = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not db.get(Conversation, conversation_id):
        raise HTTPException(status_code=404, detail="会话不存在")

    results: list[Attachment] = []
    for upload in files:
        if not is_supported(upload.filename or "", upload.content_type or ""):
            raise HTTPException(status_code=400, detail=f"不支持的文件类型：{upload.filename}")
        file_type, storage_path, size = save_upload(upload)
        attachment = Attachment(
            conversation_id=conversation_id,
            filename=upload.filename or "upload",
            file_type=file_type,
            mime_type=upload.content_type or "",
            size=size,
            storage_path=public_upload_path(storage_path),
            status="uploaded" if file_type == "image" else "parsing",
        )
        db.add(attachment)
        db.flush()
        if file_type == "file":
            try:
                parsed_path, status = parse_file(storage_path, attachment.id)
            except Exception:
                parsed_path, status = None, "failed"
            attachment.parsed_text_path = parsed_path
            attachment.status = status
        results.append(attachment)
    db.commit()
    for item in results:
        db.refresh(item)
    return results
