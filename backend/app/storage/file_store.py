import re
import shutil
from pathlib import Path

from fastapi import UploadFile

from app.config import DATA_DIR
from app.models import new_id

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
FILE_EXTS = {".txt", ".md", ".csv", ".pdf", ".docx", ".pptx", ".xlsx"}


def safe_filename(filename: str) -> str:
    stem = Path(filename).stem or "file"
    suffix = Path(filename).suffix.lower()
    cleaned = re.sub(r"[^a-zA-Z0-9._\-\u4e00-\u9fff]+", "_", stem).strip("._")
    return f"{cleaned[:80] or 'file'}{suffix}"


def classify_file(filename: str, mime_type: str = "") -> str:
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTS or mime_type.startswith("image/"):
        return "image"
    return "file"


def is_supported(filename: str, mime_type: str = "") -> bool:
    ext = Path(filename).suffix.lower()
    return ext in IMAGE_EXTS or ext in FILE_EXTS or mime_type.startswith("image/")


def save_upload(upload: UploadFile) -> tuple[str, str, int]:
    file_type = classify_file(upload.filename or "upload", upload.content_type or "")
    folder = DATA_DIR / "uploads" / ("images" if file_type == "image" else "files")
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{new_id('up')}_{safe_filename(upload.filename or 'upload')}"
    target = folder / filename
    with target.open("wb") as f:
        shutil.copyfileobj(upload.file, f)
    return file_type, str(target), target.stat().st_size


def public_upload_path(path: str) -> str:
    try:
        rel = Path(path).resolve().relative_to((DATA_DIR / "uploads").resolve())
        return f"/uploads/{rel.as_posix()}"
    except ValueError:
        return path


def local_upload_path(path: str) -> str:
    if path.startswith("/uploads/"):
        return str(DATA_DIR / "uploads" / path.removeprefix("/uploads/"))
    return path
