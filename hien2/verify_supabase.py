"""
HIEN — Supabase Verification Runner (Frontend Directory Proxy)
=============================================================
Runs verify_supabase.py directly from hien-backend so that running
'python verify_supabase.py' from inside hien2 also works seamlessly.
"""

import os
import sys
import subprocess

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "hien-backend"))
SCRIPT_PATH = os.path.join(BACKEND_DIR, "verify_supabase.py")

if not os.path.exists(SCRIPT_PATH):
    print(f"[ERROR] Could not find verify_supabase.py at: {SCRIPT_PATH}")
    sys.exit(1)

print(f"--> Executing verify_supabase.py in {BACKEND_DIR}...\n")
result = subprocess.run([sys.executable, SCRIPT_PATH], cwd=BACKEND_DIR)
sys.exit(result.returncode)
