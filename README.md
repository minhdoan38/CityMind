# CityMind AI

CityMind AI is an AI-assisted Decision Intelligence Platform that transforms
citizen reports, geolocation, evidence images, and urban context into
structured, prioritized, and auditable actions for smarter communities.

AI recommendations are advisory. Officers remain responsible for verification
and final decisions.

## Live prototype

- Web: <https://citymind-web-lvdth2uirq-uc.a.run.app>
- Public report form: <https://citymind-web-lvdth2uirq-uc.a.run.app/report>
- Officer login: <https://citymind-web-lvdth2uirq-uc.a.run.app/login>
- API health: <https://citymind-api-lvdth2uirq-uc.a.run.app/health>

The submission build includes one-click officer access for judges. Disable
`ENABLE_QUICK_OFFICER_ACCESS` after evaluation because this mode grants full
dashboard permissions.

## Core capabilities

- Citizen reports with text, location, and optional image evidence.
- Structured Gemini analysis: category, severity, confidence, priority,
  evidence, uncertainty, impact, and recommended action.
- BigQuery persistence and private Cloud Storage evidence.
- Protected officer dashboard with operational filters.
- Report detail, status updates, and append-only status history.
- Responsive public form with browser geolocation and camera support.
- Cloud Run deployment, Secret Manager, IAM, rate limiting, and cost alerts.

## Architecture

```text
Next.js public form
  -> FastAPI ingestion
  -> Vertex AI Gemini
  -> BigQuery + private Cloud Storage
  -> authenticated Next.js officer dashboard
```

## Local development

### Backend

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm ci
copy .env.example .env.local
npm run dev
```

- Backend: `http://127.0.0.1:8000`
- Frontend: `http://localhost:3000`

### Docker (app only — no Supabase in Docker)

Prerequisite: localhost Supabase running on the host (`supabase start`, then `supabase migration up`).

```powershell
# From repo root, after backend/.env is configured
docker compose up --build
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- Supabase stays on host (`http://localhost:54321` via `host.docker.internal` inside containers)

Optional map tile env (frontend `.env.local`):

```env
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=© OpenStreetMap contributors
```

## Verification

```powershell
cd backend
pytest -q

cd ..\frontend
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

## Demo data

```powershell
python scripts\seed_reports.py
python scripts\seed_reports.py --apply
```

The deterministic seed contains 10 reports, one synthetic evidence image,
urban context, balanced priorities, and append-only status events.

## Deployment

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy_cloudrun.ps1
powershell -ExecutionPolicy Bypass -File scripts\create_budget.ps1
```

## Current limitations

- This MVP provides decision support, not validated prediction.
- BigQuery is used as an MVP operational store; Firestore or PostgreSQL is a
  better production choice.
- Quick officer access must be disabled after judging.
- The in-memory rate limiter is per Cloud Run instance.
- Live urban-context enrichment is disabled in production.
- Firebase Auth, per-user audit, frontend E2E tests, and full observability are
  future work.
