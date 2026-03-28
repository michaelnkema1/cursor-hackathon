#!/usr/bin/env bash
# Run FastAPI (port 8000) and Next.js (port 3000) together from the repo root.
# Prerequisites: root .env for the API; optional frontend/.env.local with BACKEND_URL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PYTHONPATH="${ROOT}/backend"

cleanup() {
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "FixGhana dev: starting API on http://127.0.0.1:8000 and frontend on http://127.0.0.1:3000"
echo "Press Ctrl+C to stop both."

if [[ -x "${ROOT}/backend/.venv/bin/uvicorn" ]]; then
  "${ROOT}/backend/.venv/bin/uvicorn" app.main:app --reload --host 0.0.0.0 --port 8000 &
else
  echo "Note: create backend/.venv and pip install -r requirements.txt for a stable Python env."
  python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
fi
BACKEND_PID=$!

(cd "${ROOT}/frontend" && exec npm run dev) &
FRONTEND_PID=$!

wait
