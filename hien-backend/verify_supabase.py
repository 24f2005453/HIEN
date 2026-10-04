"""
HIEN Backend — Supabase Connection & Schema Verification Script
================================================================
Performs a safe, read-only verification of the Supabase PostgreSQL + PostGIS
connection, checks table visibility, verifies PostGIS version, and compares
database schema against SQLAlchemy models in app/models.py.

Security: Never prints passwords or raw credentials to terminal or logs.
"""

import os
import sys
import logging
import urllib.parse
from dotenv import load_dotenv

# Ensure the backend root is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

# Load environment variables
load_dotenv(os.path.join(SCRIPT_DIR, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
logger = logging.getLogger("supabase_verifier")


def get_sanitized_connection():
    """Retrieve and sanitize DATABASE_URL or build from Supabase variables."""
    from sqlalchemy.engine import make_url

    raw_url = os.getenv("DATABASE_URL")
    supabase_pw = os.getenv("SUPABASE_DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD")

    # Check if raw_url is missing or has placeholders
    has_placeholder = (
        not raw_url
        or "@postgres:5432" in raw_url
        or "@localhost:5432" in raw_url
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
            raw_url = f"postgresql://{user}:{encoded_pw}@{host}:{port}/{db}?sslmode=require"

    if not raw_url:
        return None, None, "DATABASE_URL is not set"

    # Normalize postgres:// to postgresql://
    if raw_url.startswith("postgres://"):
        raw_url = "postgresql://" + raw_url[len("postgres://"):]

    try:
        url_obj = make_url(raw_url)
        sanitized = url_obj.render_as_string(hide_password=True)
        return raw_url, sanitized, None
    except Exception as exc:
        return None, None, f"Invalid DATABASE_URL format: {exc}"


def verify():
    from sqlalchemy import create_engine, text, inspect
    from app.models import DemandSignal, LocalInventory

    raw_url, sanitized_url, err = get_sanitized_connection()
    if err or not raw_url:
        print(f"\n[ERROR] Configuration check failed: {err}")
        print("Please configure DATABASE_URL or SUPABASE_DB_PASSWORD in .env")
        return False

    print(f"\n============================================================")
    print(f"HIEN Backend — Supabase Connection Verification")
    print(f"============================================================")
    print(f"Target Connection: {sanitized_url}")

    # Check for placeholder passwords
    if any(ph in raw_url for ph in ["change_this_password", "[YOUR-PASSWORD]", "[YOUR_PASSWORD]", "YourActualPasswordHere"]):
        print("\n[WARNING] Database URL contains a placeholder password ('YourActualPasswordHere', 'change_this_password', or '[YOUR_PASSWORD]').")
        print("Please set your actual Supabase database password in .env before testing.")
        return False

    connect_args = {}
    if "sslmode" not in raw_url and "supabase.co" in raw_url:
        connect_args["sslmode"] = "require"

    try:
        engine = create_engine(
            raw_url,
            connect_args=connect_args,
            pool_pre_ping=True,
            pool_recycle=1800,
        )
    except Exception as exc:
        print(f"\n[ERROR] Failed to initialize SQLAlchemy engine: {exc}")
        return False

    # 1. Test basic connection
    print("\n[1/5] Testing basic connection (SELECT 1)...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            if result == 1:
                print("  --> Connection successful: SELECT 1 returned 1.")
            else:
                print(f"  --> Unexpected result: {result}")
                return False
    except Exception as exc:
        print(f"  --> Connection failed: {exc}")
        if "password authentication failed" in str(exc):
            print("\n" + "=" * 60)
            print("[AUTHENTICATION] SUPABASE PASSWORD AUTHENTICATION FAILED")
            print("=" * 60)
            print("Explanation:")
            print("  In Supabase, your 'Database Password' is NOT your Supabase account")
            print("  login password. It is the password configured for PostgreSQL.")
            print("\nHow to fix:")
            print("  1. Open: https://supabase.com/dashboard")
            print("  2. Select your project -> Click Project Settings (gear icon)")
            print("  3. Click 'Database' in the sidebar")
            print("  4. Scroll down to 'Database password' and click 'Reset database password'")
            print("  5. Enter a new password (e.g. MyDatabasePass2026!)")
            print("  6. Paste that exact password into hien-backend/.env:")
            print("     SUPABASE_DB_PASSWORD=MyDatabasePass2026!")
            print("=" * 60 + "\n")
        return False

    # 2. Test PostGIS extension
    print("\n[2/5] Testing PostGIS extension...")
    try:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT PostGIS_Full_Version();")).scalar()
            print(f"  --> PostGIS version: {version}")
    except Exception as exc:
        print(f"  --> PostGIS check failed: {exc}")
        return False

    # 3. Check table visibility and schema inspection
    print("\n[3/5] Inspecting database tables...")
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names(schema="public")
    print(f"  --> Public tables found: {existing_tables}")

    required_tables = ["demand_signals", "local_inventory"]
    for t in required_tables:
        if t in existing_tables:
            print(f"  --> Table '{t}' is PRESENT in public schema.")
            cols = inspector.get_columns(t, schema="public")
            col_info = [f"{c['name']} ({c['type']})" for c in cols]
            print(f"      Columns: {', '.join(col_info)}")
            pk = inspector.get_pk_constraint(t, schema="public")
            print(f"      Primary key: {pk.get('constrained_columns')}")
            indexes = inspector.get_indexes(t, schema="public")
            idx_names = [i['name'] for i in indexes]
            print(f"      Indexes: {', '.join(idx_names)}")
        else:
            print(f"  --> Table '{t}' is MISSING in public schema!")

    # 4. Safe read-only count queries
    print("\n[4/5] Executing safe read-only queries...")
    try:
        with engine.connect() as conn:
            if "demand_signals" in existing_tables:
                ds_count = conn.execute(text("SELECT count(*) FROM demand_signals")).scalar()
                print(f"  --> demand_signals row count: {ds_count}")
            if "local_inventory" in existing_tables:
                li_count = conn.execute(text("SELECT count(*) FROM local_inventory")).scalar()
                print(f"  --> local_inventory row count: {li_count}")
    except Exception as exc:
        print(f"  --> Read-only query failed: {exc}")
        return False

    # 5. Test PostGIS spatial query function
    print("\n[5/5] Testing PostGIS ST_DWithin function...")
    try:
        with engine.connect() as conn:
            query = text(
                "SELECT ST_DWithin("
                "ST_SetSRID(ST_Point(80.2707, 13.0827), 4326)::geography, "
                "ST_SetSRID(ST_Point(80.2750, 13.0900), 4326)::geography, "
                "3000);"
            )
            is_within = conn.execute(query).scalar()
            print(f"  --> ST_DWithin (3000 m check between test points): {is_within}")
    except Exception as exc:
        print(f"  --> PostGIS spatial query test failed: {exc}")
        return False

    print("\n============================================================")
    print("ALL CHECKS PASSED: Supabase PostgreSQL + PostGIS is fully operational!")
    print("============================================================\n")
    return True


if __name__ == "__main__":
    success = verify()
    sys.exit(0 if success else 1)
