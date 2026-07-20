# Technology Stack

**Analysis Date:** 2026-07-20

## Languages

**Primary:**
- TypeScript 5.x - Frontend Next.js app (UI + Next server/API routes)

**Secondary:**
- Python 3.12 - Backend FastAPI API, services (Gemini/BigQuery/GCS), and tests

## Runtime

**Environment:**
- Node.js 22 (Alpine) - Frontend Docker image uses `node:22-alpine`
- Python 3.12 - Backend Docker image uses `python:3.12-slim`

**Package Manager:**
- npm - Frontend uses `package-lock.json` and `npm ci` in Docker
- Lockfile: `frontend/package-lock.json`

## Frameworks

**Core:**
- Next.js 16.2.10 - App Router UI and Next API proxy endpoints
- FastAPI 0.115.14 - REST API for report ingestion, querying, and officer operations

**Testing:**
- pytest 8.4.1 - Backend tests (API/unit tests)

**Build/Dev:**
- TypeScript 5.x - Type checking + compilation for Next.js
- ESLint 9.x (via `eslint-config-next`) - Linting

## Key Dependencies

**Critical:**
- google-genai 1.23.0 - Vertex AI Gemini content generation (JSON-schema shaped output)
- google-cloud-bigquery 3.34.0 - Report persistence, querying, and status history
- google-cloud-storage 3.12.0 - Evidence image upload/download (GCS URIs)
- fastapi 0.115.14 - Backend web framework (Pydantic request/response models)
- uvicorn 0.34.3 - Backend ASGI server
- pydantic 2.11.7 - Typed schemas/models for request/response and Gemini parsing

**Infrastructure/HTTP:**
- requests 2.34.2 - Urban context enrichment (OpenWeather + Nominatim)

## Configuration

**Environment:**
- Frontend (in `frontend/.env.example`):
  - `BACKEND_API_URL` (or `NEXT_PUBLIC_API_URL`) - where the Next server proxies backend calls
  - `SESSION_SECRET` - HMAC secret for officer session cookies
  - `OFFICER_DASHBOARD_PASSWORD`, `ADMIN_DASHBOARD_PASSWORD` - optional dashboard login passwords
  - `OFFICER_API_KEY` - shared secret sent to FastAPI as `X-CityMind-Officer-Key`
  - `ENABLE_QUICK_OFFICER_ACCESS` - evaluation-only login bypass mode

- Backend (in `backend/.env.example` / loaded from `backend/.env`):
  - `APP_ENV` - controls auth behavior and runtime mode
  - `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` - Vertex AI/GCP project + region
  - `GEMINI_MODEL` - Gemini model name
  - `BIGQUERY_DATASET`, `BIGQUERY_REPORTS_TABLE` - BigQuery dataset/table names
  - `ENABLE_BIGQUERY` - gates persistence and querying
  - `ENABLE_IMAGE_STORAGE`, `GCS_BUCKET_NAME` - gates evidence storage
  - `ENABLE_URBAN_CONTEXT`, `OPENWEATHER_API_KEY` - gates/backs urban context enrichment
  - `OFFICER_API_KEY` - required for officer endpoints in production
  - `CORS_ORIGINS` - allowed origins for browser requests
  - `REPORT_RATE_LIMIT_PER_MINUTE`, `MAX_IMAGE_BYTES` - request limits

**Build:**
- `frontend/next.config.ts` sets `output: "standalone"` for container-friendly builds

## Platform Requirements

**Development:**
- Node.js 22+
- Python 3.12+
- Run backend with `uvicorn app.main:app --reload`
- Run frontend with `next dev`

**Production:**
- Deploy containers (Cloud Run noted in `scripts/deploy_cloudrun.ps1`)
- Google Cloud access:
  - Vertex AI access for Gemini
  - BigQuery access for reads/writes
  - (Optional) Cloud Storage access for evidence images

---
*Stack analysis: 2026-07-20*
*Update after major dependency changes*

