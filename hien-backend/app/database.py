"""
HIEN Backend — Database configuration
======================================
Creates the SQLAlchemy engine, session factory, and a FastAPI dependency
for injecting database sessions into route handlers.

Supports:
  • Local PostgreSQL / PostGIS (Docker Compose or local install)
  • Supabase Cloud PostgreSQL with Session Pooler (port 5432)
  • Automatic password URL-encoding and SSL enforcement for cloud hosts

Requires a PostGIS-enabled PostgreSQL database.
"""

import os
import logging
import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _build_database_url() -> str:
    """Build or normalize the database connection URL."""
    raw_url = os.getenv("DATABASE_URL")
    supabase_pw = os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD")

    # If DATABASE_URL is not set or set to a placeholder, and a Supabase password is provided
    has_placeholder = (
        not raw_url
        or "change_this_password" in raw_url
        or "[YOUR-PASSWORD]" in raw_url
        or "[YOUR_PASSWORD]" in raw_url
        or "YourActualPasswordHere" in raw_url
    )
    if has_placeholder and supabase_pw:
        if supabase_pw not in ("change_this_password", "YourActualPasswordHere") and not supabase_pw.startswith("@"):
            user = os.getenv("SUPABASE_USER", "postgres.zrskclaymemxmrducoqx")
            host = os.getenv("SUPABASE_HOST", "aws-0-ap-southeast-1.pooler.supabase.com")
            port = os.getenv("SUPABASE_PORT", "5432")
            db = os.getenv("SUPABASE_DB", "postgres")
            encoded_pw = urllib.parse.quote_plus(supabase_pw)
            return f"postgresql://{user}:{encoded_pw}@{host}:{port}/{db}?sslmode=require"

    if not raw_url:
        return "postgresql://postgres:password@localhost:5432/hien"

    # Normalize Heroku / Supabase style "postgres://" to "postgresql://" for SQLAlchemy
    if raw_url.startswith("postgres://"):
        raw_url = "postgresql://" + raw_url[len("postgres://"):]

    # If host is "postgres" and cannot be resolved (running locally outside Docker container), fallback to "localhost"
    if "@postgres:" in raw_url:
        try:
            import socket
            socket.gethostbyname("postgres")
        except Exception:
            raw_url = raw_url.replace("@postgres:", "@localhost:")

    return raw_url


DATABASE_URL: str = _build_database_url()

# ---------------------------------------------------------------------------
# Engine & session
# ---------------------------------------------------------------------------
_connect_args = {}
# Enforce SSL for remote Supabase connections if not explicitly disabled
if "supabase.co" in DATABASE_URL and "sslmode=" not in DATABASE_URL:
    _connect_args["sslmode"] = "require"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # Detect disconnected/stale sockets before query
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),  # Recycle idle sockets before cloud timeouts
    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
    connect_args=_connect_args,
    echo=False,              # Set True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Safe sanitized connection logging (passwords masked)
try:
    _sanitized_url = make_url(DATABASE_URL).render_as_string(hide_password=True)
    logger.info("Database configured for target: %s", _sanitized_url)
except Exception:
    logger.info("Database configured.")

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db():
    """Yield a database session and guarantee cleanup."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_db_connection() -> bool:
    """Return True if the database is reachable, False otherwise."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database connection check failed: %s", exc)
        return False
