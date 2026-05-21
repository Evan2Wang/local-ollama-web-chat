from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import DATA_DIR, settings
from app.database import create_schema
from app.routers import attachments, auth, chat, conversations, health, models, prompt_templates
from app.services.prompt_templates import seed_builtin_templates

create_schema()
seed_builtin_templates()

app = FastAPI(title="local-ollama-web-chat")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+):5173$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_app_token(request: Request, call_next):
    public_routes = {
        ("POST", "/api/auth/check"),
        ("GET", "/api/health/config"),
        ("GET", "/api/health/ollama"),
    }
    if (
        not settings.auth_enabled
        or request.method == "OPTIONS"
        or (request.method, request.url.path) in public_routes
        or request.url.path.startswith("/uploads/")
    ):
        return await call_next(request)

    expected = f"Bearer {settings.app_token}"
    if request.headers.get("Authorization") != expected:
        return JSONResponse(status_code=401, content={"detail": "Token 无效或缺失"})
    return await call_next(request)


(DATA_DIR / "uploads").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=DATA_DIR / "uploads"), name="uploads")

app.include_router(models.router)
app.include_router(conversations.router)
app.include_router(attachments.router)
app.include_router(chat.router)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(prompt_templates.router)
