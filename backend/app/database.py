"""
HIEN Backend — Database configuration
======================================
Creates the SQLAlchemy engine, session factory, and a FastAPI dependency
for injecting database sessions into route handlers.

Requires a PostGIS-enabled PostgreSQL database.
"""

import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/hien",
)

# ---------------------------------------------------------------------------
# Engine & session
# ---------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # Reconnect on stale connections
    pool_size=5,
    max_overflow=10,
    echo=False,            # Set True for SQL debugging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

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
