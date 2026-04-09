#!/usr/bin/env bash
# IGP — Start backend + frontend together
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🌿 IGP Dev — starting backend + frontend"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────
echo "▶ Starting FastAPI backend on http://localhost:8000 ..."
cd "$ROOT"

if [ ! -d "backend/.venv" ]; then
  echo "  Creating Python venv..."
  python3 -m venv backend/.venv
fi

source backend/.venv/bin/activate
pip install -q -r requirements.txt

PYTHONPATH=backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Frontend ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Starting Next.js frontend on http://localhost:3000 ..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "────────────────────────────────────────────"
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo "  API docs → http://localhost:8000/docs"
echo "────────────────────────────────────────────"
echo "  Press Ctrl+C to stop both"
echo ""

# Wait for either to exit, then kill both
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
