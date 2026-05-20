from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import DATA_DIR
from app.database import Base, engine
from app.routers import attachments, chat, conversations, models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="local-ollama-web-chat")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+):5173$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

(DATA_DIR / "uploads").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=DATA_DIR / "uploads"), name="uploads")

app.include_router(models.router)
app.include_router(conversations.router)
app.include_router(attachments.router)
app.include_router(chat.router)


@app.get("/api/health")
def health():
    return {"ok": True}
