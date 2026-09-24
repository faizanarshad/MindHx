"""Database engine/session setup.

Defaults to a local SQLite file so local dev and tests need no running
database. Set DATABASE_URL to a postgresql://... connection string for
real deployments; psycopg2-binary (already in requirements.txt) is only
imported by SQLAlchemy at connection time, once that URL is configured.
"""

import os

from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mindhx.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_user_columns() -> None:
    """Adds columns to an already-existing users table.

    Base.metadata.create_all only creates tables that don't exist yet - it
    never alters one that's already there, and this project has no Alembic
    (or other) migration system. For a users table already deployed without
    these columns, add them here. Each column gets its own transaction and
    swallows the "already exists" error, so this stays safe to run on every
    startup, whether the column is missing (fresh add) or already present
    (a previous startup already added it).
    """
    new_columns = {
        "full_name": "VARCHAR(120)",
        "phone": "VARCHAR(30)",
        "gender": "VARCHAR(40)",
        "marital_status": "VARCHAR(40)",
        "life_context": "VARCHAR(40)",
        "preferred_language": "VARCHAR(10)",
        "avatar_data_url": "TEXT",
    }
    for column, column_type in new_columns.items():
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {column} {column_type}"))
        except DBAPIError:
            pass  # Column already exists.


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_user_columns()
