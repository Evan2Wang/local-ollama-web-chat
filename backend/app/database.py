from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATA_DIR, settings

DATA_DIR.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_schema() -> None:
    Base.metadata.create_all(bind=engine)
    attachment_columns = {column["name"] for column in inspect(engine).get_columns("attachments")}
    migration_columns = {
        "error_message": "TEXT",
        "is_truncated": "BOOLEAN NOT NULL DEFAULT 0",
        "original_chars": "INTEGER NOT NULL DEFAULT 0",
        "used_chars": "INTEGER NOT NULL DEFAULT 0",
        "updated_at": "DATETIME",
    }
    with engine.begin() as connection:
        for name, definition in migration_columns.items():
            if name not in attachment_columns:
                connection.execute(text(f"ALTER TABLE attachments ADD COLUMN {name} {definition}"))
        connection.execute(text("UPDATE attachments SET updated_at = created_at WHERE updated_at IS NULL"))
