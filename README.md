# FixGhana

FixGhana is a civic reporting platform: citizens submit photo, location, and voice or text; the backend classifies the issue with AI, estimates severity, and supports routing and dashboards for authorities. This repository contains the **FastAPI backend** (sole writer to Supabase) and deployment helpers; the database schema and migrations are maintained separately by your team.

## Issue severity scale

Each report gets an integer **`ai_severity`** from **1** (lowest) to **5** (highest). Gemini assigns this from the description, transcript, and optional image. The scale is designed for triage and map filtering, not a legal finding.

| Level | Meaning |
| ----- | ------- |
| **1** | Minor or cosmetic; very low impact; no meaningful safety risk; suitable for routine maintenance backlog. |
| **2** | Noticeable inconvenience or small localized defect; minimal direct safety risk. |
| **3** | Moderate impact on public use, access, or the environment; some safety or health concern if ignored. |
| **4** | Significant hazard, service failure, or widespread nuisance; needs prompt official attention. |
| **5** | Immediate danger to life, serious injury, or critical infrastructure failure; emergency priority. |

Values are clamped to 1–5 in application code after model output. The same scale is spelled out in the classification prompt in [`backend/app/services/gemini.py`](backend/app/services/gemini.py); update both places together if you change definitions.

## Backend stack

- **FastAPI** — REST API, JWT verification (Supabase user tokens), global error handling  
- **Supabase** — Postgres (via service role), Storage signed upload/read URLs  
- **Google Gemini** — issue classification, structured civic report JSON  
- **Deploy** — optional [Vercel](vercel.json) (`api/index.py`), optional [Docker](backend/Dockerfile)

## Repository layout

```
hackathon/
├── README.md                 # This file
├── .env                      # Local secrets (not committed); see backend/.env.example
├── api/index.py              # Vercel entry: exposes FastAPI `app`
├── vercel.json
├── requirements.txt          # Delegates to backend/requirements.txt
└── backend/
    ├── app/
    │   ├── main.py           # App factory, CORS, exception handlers
    │   ├── config.py         # Pydantic settings / env
    │   ├── deps.py           # Supabase client, JWT, staff helpers
    │   ├── db_contract.py    # Expected table/RPC names for the DB teammate
    │   ├── routers/          # issues, uploads, internal (AI webhook)
    │   └── services/         # issues, gemini, ai_dispatch
    ├── tests/                # pytest + dependency overrides
    ├── Dockerfile
    ├── requirements.txt
    └── .env.example
```

## Environment variables

Copy [`backend/.env.example`](backend/.env.example) to the **repository root** as `.env` (recommended for this layout), or place `.env` in `backend/` and run uvicorn with `cwd` set to `backend`.

Required for the API process:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`  
- `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`)

Optional and feature flags are documented in `backend/.env.example`.

## Run locally

From the **repository root** (so root `.env` is loaded by Pydantic):

```bash
cd /path/to/hackathon
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r requirements.txt
export PYTHONPATH=backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `GET http://localhost:8000/health`  
- OpenAPI UI: `http://localhost:8000/docs`

Authenticated routes expect `Authorization: Bearer <Supabase access token>`.

## Docker

From `backend/` (build context must include `app/` and `requirements.txt`):

```bash
cd backend
docker build -t fixghana-api .
docker run --env-file ../.env -p 8000:8000 fixghana-api
```

Adjust `--env-file` to your `.env` path.

## Vercel

Set the same environment variables in the Vercel project. Keep the project root at this repo root so `api/index.py` can add `backend/` to `sys.path`. Dependencies install from root [`requirements.txt`](requirements.txt).

## API overview

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/health` | Liveness |
| POST | `/uploads/sign` | Signed upload URL (JWT) |
| POST | `/uploads/sign-read` | Signed read URL for media (JWT; path rules apply) |
| POST | `/reports` | Create issue; inline AI when `AI_INLINE=true` |
| GET | `/me/reports` | Reporter’s issues (JWT) |
| GET | `/staff/issues` | Staff queue (JWT, role-gated) |
| GET | `/issues/nearby` | Map radius (PostGIS RPC on DB side) |
| GET/PATCH | `/issues/{id}` | Detail / status update (PATCH staff rules apply) |
| POST | `/internal/process-issue/{id}` | AI processing with `X-Internal-Key` (webhook / serverless) |

Full schemas: **`/docs`** or **`/openapi.json`**.

## Database contract

The backend assumes table and RPC names documented in [`backend/app/db_contract.py`](backend/app/db_contract.py). Align Supabase migrations and RLS with that file.

## Tests

```bash
cd backend
PYTHONPATH=. pytest tests/ -q
```

## License

Specify your team or organization’s license for the hackathon project.
