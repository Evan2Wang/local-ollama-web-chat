from fastapi import APIRouter, Header, HTTPException

from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/check")
def check_token(authorization: str | None = Header(default=None)):
    if not settings.auth_enabled:
        return {"ok": True, "auth_enabled": False}
    valid = authorization == f"Bearer {settings.app_token}"
    if not valid:
        raise HTTPException(status_code=401, detail="Token 无效")
    return {"ok": valid, "auth_enabled": True}
