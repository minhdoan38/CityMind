# CityMind AI

CityMind AI is an AI-assisted Decision Intelligence Platform for smart communities.
Citizens submit urban incident reports; a configurable third-party AI API produces
structured, advisory triage output; officers review, filter, and update status on
a protected dashboard.

AI recommendations are advisory. Officers remain responsible for verification
and final decisions.

The runnable application lives in [`frontend/`](frontend/). Planning artifacts
remain in [`.planning/`](.planning/).

## Platform (Milestone v2)

- **Runtime:** Node.js 22 + Next.js 16 (single process on your laptop)
- **Data:** Self-hosted Supabase Postgres, Auth, and private Storage
- **AI:** Provider-neutral `THIRD_PARTY_API_KEY` + endpoint/model env configuration
- **Exception:** Google Fonts via `next/font/google` only

## Quick start

```powershell
cd frontend
npm ci
copy .env.example .env.local
# Edit .env.local with Supabase URL, keys, AI endpoint, and SUPABASE_DB_URL

supabase db push
npm run dev
```

- App (dev): `http://localhost:3000`
- Liveness: `GET /api/health`
- Readiness: `GET /api/ready` (Supabase connectivity; no AI tokens spent)

### Production on laptop

```powershell
cd frontend
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

Loopback is the default bind. Use `scripts/register-citymind-task.ps1 -Register`
from the `frontend` directory for Windows Task Scheduler startup/restart.

```powershell
npm run smoke:production
```

## Operations

Run from the `frontend` directory:

| Task | Command |
|------|---------|
| DB + Storage backup | `powershell -File scripts/backup-citymind.ps1 -Output <dir>` |
| Isolated restore drill | `powershell -File scripts/restore-citymind.ps1 -Input <dir> -Target isolated` |
| Officer role grant | `powershell -File scripts/seed_officer_role.ps1 -Email you@example.com` |
| Google-exit audit | `npm run audit:google-exit -- --mode final` |
| Apply SQL test | `node scripts/run-supabase-sql.mjs -f supabase/tests/<file>.sql` |

## Verification

```powershell
cd frontend
npm test
npm run lint
npm run build
npm run smoke:production
```

## Architecture

```text
Citizen / officer browser
  -> Next.js App Router (UI + API routes)
  -> Supabase Postgres / Auth / private Storage
  -> Third-party AI API (structured JSON analysis)
```

Historical FastAPI, BigQuery, GCS, and Cloud Run artifacts were removed in Phase 7.
See `.planning/phases/07-google-free-self-hosted-platform/` for migration evidence.

## Optional map tiles

```env
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=© OpenStreetMap contributors
```
