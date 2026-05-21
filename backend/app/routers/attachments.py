from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Attachment, Conversation
from app.schemas import AttachmentDetail, AttachmentOut
from app.services.file_parser import parse_file, read_parsed_text
from app.storage.file_store import is_supported, local_upload_path, public_upload_path, save_upload

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
            parse_attachment(attachment, storage_path)
        results.append(attachment)
    db.commit()
    for item in results:
        db.refresh(item)
    return results


def parse_attachment(attachment: Attachment, source_path: str) -> None:
    attachment.error_message = None
    try:
        parsed = parse_file(source_path, attachment.id)
        attachment.parsed_text_path = parsed.parsed_text_path
        attachment.status = parsed.status
        attachment.original_chars = parsed.original_chars
        attachment.used_chars = parsed.used_chars
        attachment.is_truncated = parsed.is_truncated
    except Exception as exc:
        attachment.parsed_text_path = None
        attachment.status = "failed"
        attachment.error_message = str(exc) or exc.__class__.__name__
        attachment.original_chars = 0
        attachment.used_chars = 0
        attachment.is_truncated = False


def detail_payload(attachment: Attachment) -> dict:
    return {
        **AttachmentOut.model_validate(attachment).model_dump(),
        "parsed_text_preview": read_parsed_text(attachment.parsed_text_path),
    }


@router.get("/{attachment_id}", response_model=AttachmentDetail)
def get_attachment(attachment_id: str, db: Session = Depends(get_db)):
    attachment = db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    return detail_payload(attachment)


@router.post("/{attachment_id}/reparse", response_model=AttachmentDetail)
def reparse_attachment(attachment_id: str, db: Session = Depends(get_db)):
    attachment = db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    if attachment.file_type != "file":
        raise HTTPException(status_code=400, detail="图片附件不需要解析")
    attachment.status = "parsing"
    parse_attachment(attachment, local_upload_path(attachment.storage_path))
    db.commit()
    db.refresh(attachment)
    return detail_payload(attachment)
