# Codebase Structure

**Analysis Date:** 2026-07-20

## Directory Layout

```
CityMind/
├── backend/                 # FastAPI ingestion + persistence services
├── frontend/                # Next.js UI + API proxy + officer dashboard
├── infra/                   # BigQuery schemas and schema assets
├── scripts/                 # Seed and deployment scripts
└── .planning/               # Generated planning artifacts (this folder)
```

## Directory Purposes

**backend/**
- Purpose: Python service exposing the FastAPI API
- Contains: API router (`app/api`), service integrations (`app/services`), Pydantic schemas, and tests
- Key files:
  - `backend/app/main.py` - FastAPI app + middleware + router include
  - `backend/app/api/reports.py` - Report ingestion/query/status/image endpoints
  - `backend/app/services/` - Gemini/BigQuery/GCS/urban context services
  - `backend/tests/` - pytest-based unit/API tests

**frontend/**
- Purpose: Web UI + Next.js route handlers that proxy requests to FastAPI
- Contains: App Router pages under `src/app`, UI components, and server utilities under `src/lib`
- Key files:
  - `frontend/src/app/page.tsx` - Officer dashboard
  - `frontend/src/app/report/page.tsx` - Public report form
  - `frontend/src/app/reports/[reportId]/page.tsx` - Report detail view
  - `frontend/src/app/api/public/reports/analyze/route.ts` - Forwards citizen submissions
  - `frontend/src/app/api/officer/reports/[reportId]/**/route.ts` - Officer status + evidence image proxy endpoints
  - `frontend/src/lib/auth.ts` - HMAC session cookie auth

**infra/**
- Purpose: Infrastructure assets (SQL + JSON schema) for BigQuery tables
- Contains: BigQuery schema definitions
- Key files:
  - `infra/bigquery/schema.sql`
  - `infra/bigquery/create_status_events.sql`

**scripts/**
- Purpose: Automation for local development and cloud deployment
- Contains: Seed scripts and Cloud Run deployment helpers
- Key files:
  - `scripts/seed_reports.py` - deterministic demo data seed
  - `scripts/deploy_cloudrun.ps1` - deployment script
  - `scripts/create_budget.ps1` - cost/budget helper

**.planning/codebase/**
- Purpose: Generated codebase map documentation for planning and onboarding
- Contains: Structured reference docs (STACK/ARCHITECTURE/STRUCTURE/CONVENTIONS/TESTING/INTEGRATIONS/CONCERNS)

## Key File Locations

**Entry Points:**
- `backend/app/main.py` - FastAPI app entry + CORS + route wiring
- `backend/app/api/reports.py` - API router for report analyze/query/status/image
- `frontend/src/app/page.tsx` - Officer dashboard entry page
- `frontend/src/app/report/page.tsx` - Public report submission page
- `frontend/src/app/reports/[reportId]/page.tsx` - Report detail page

**Configuration:**
- `backend/app/config.py` - Pydantic settings and env-file wiring
- `backend/.env.example` - expected backend environment variables
- `frontend/tsconfig.json` - TypeScript config + `@/*` alias
- `frontend/.env.example` - expected frontend environment variables

**Core Logic:**
- `backend/app/services/gemini.py` - LLM analysis (GeminiAnalyzer)
- `backend/app/services/bigquery.py` - BigQuery persistence and queries
- `backend/app/services/storage.py` - Evidence upload/download (GCS)
- `backend/app/services/context_data.py` - Urban context enrichment

**Testing:**
- `backend/tests/` - pytest tests for services and API routes

**Documentation:**
- `README.md` - project overview, local dev instructions, and limitations
- `idea.md` - longer project notes/planning (not part of the codebase map but useful context)

## Naming Conventions

**Files:**
- `snake_case.py` for Python modules (e.g., `backend/app/services/gemini.py`)
- `kebab-case` not used; TypeScript uses descriptive filenames (e.g., `ReportForm.tsx`, `StatusActions.tsx`)

**Directories:**
- `app/` / `components/` / `lib/` patterns in Next.js (`frontend/src/app`, `frontend/src/components`, `frontend/src/lib`)
- `services/` under backend to separate integrations

**Special Patterns:**
- Backend services are grouped under `backend/app/services/`
- API endpoints live in `backend/app/api/`

## Where to Add New Code

**New backend endpoint:**
- Definition: `backend/app/api/reports.py` (or a new router file under `backend/app/api/`)
- Handler logic: `backend/app/services/` (if it integrates with an external system)
- Tests: `backend/tests/` (add a targeted `test_*.py` for boundary logic)

**New backend integration/service:**
- Implementation: `backend/app/services/<service>.py`
- Schemas: extend `backend/app/schemas.py` if new Pydantic models are needed

**New frontend page/component:**
- Primary page: `frontend/src/app/**/page.tsx`
- UI component: `frontend/src/components/*.tsx`
- Server/auth utilities: `frontend/src/lib/*.ts`

**New officer proxy API route (Next):**
- Location: `frontend/src/app/api/officer/**/route.ts`

## Special Directories

**frontend/.next/**
- Purpose: Next.js build output
- Source: generated at build time
- Committed: No (implicitly gitignored by Next)

**backend/__pycache__/**
- Purpose: Python bytecode cache
- Source: generated at runtime
- Committed: No

---
*Structure analysis: 2026-07-20*
*Update when directory structure changes*

