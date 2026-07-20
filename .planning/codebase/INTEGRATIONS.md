# External Integrations

**Analysis Date:** 2026-07-20

## APIs & External Services

**Vertex AI / Gemini (LLM):**
- Gemini (Vertex AI) - Generates structured incident triage output in JSON
  - SDK/Client: `google-genai` (`backend/app/services/gemini.py`)
  - Auth: Google Cloud credentials provided to the runtime (project/region configured via env)
  - Endpoints used: Vertex AI Models via `genai.Client(... vertexai=True ...)`

**OpenWeather API (optional urban context):**
- OpenWeather - Weather conditions near the reported coordinates
  - Integration method: HTTP GET via `requests.get`
  - Auth: `OPENWEATHER_API_KEY` env var
  - Rate limits: Not managed in code (see concerns)

**Geocoding / Place context (optional urban context):**
- OpenStreetMap Nominatim - Reverse geocoding for display_name/category/type/address
  - Integration method: HTTP GET via `requests.get`
  - Auth: None (public endpoint); a custom `User-Agent` header is set
  - Rate limits: Not managed in code (see concerns)

**Internal API proxy authentication (frontend -> backend):**
- CityMind API auth - Frontend server authenticates officer actions to FastAPI
  - Integration method: HTTP fetch to backend with header
  - Header: `X-CityMind-Officer-Key`
  - Auth: `OFFICER_API_KEY` env var in Next/Frontend

## Data Storage

**Databases:**
- BigQuery - MVP persistence store for reports and append-only status events
  - Connection: configured via `GOOGLE_CLOUD_PROJECT` + `BIGQUERY_DATASET`
  - Client: `google-cloud-bigquery` (`backend/app/services/bigquery.py`)
  - Tables:
    - Reports table: `${GOOGLE_CLOUD_PROJECT}.${BIGQUERY_DATASET}.${BIGQUERY_REPORTS_TABLE}`
    - Status events table: `${GOOGLE_CLOUD_PROJECT}.${BIGQUERY_DATASET}.report_status_events`

**File Storage:**
- Google Cloud Storage (GCS) - Private evidence images per report
  - SDK/Client: `google-cloud-storage` (`backend/app/services/storage.py`)
  - Auth: Google Cloud runtime credentials
  - Buckets: `GCS_BUCKET_NAME`
  - Object naming: `reports/{report_id}/evidence.{ext}`

## Authentication & Identity

**Officer session (Next.js):**
- Cookie-based HMAC session (server-only auth)
  - Implementation: `frontend/src/lib/auth.ts`
  - Token storage: HttpOnly cookie `citymind_officer_session`
  - Session management: Signed payload containing role + expiry

**Officer authorization (FastAPI):**
- Shared secret header (no external auth provider)
  - Implementation: `backend/app/security.py` (`require_officer`)
  - Token storage: header `X-CityMind-Officer-Key`
  - Session: enforced per request

## Monitoring & Observability

**Error tracking/logging:**
- No external observability integration detected in code (no Sentry/Datadog).
- Errors are surfaced to clients as HTTP 502 messages containing exception strings (see concerns).

## CI/CD & Deployment

**Hosting:**
- Google Cloud Run (documented in `scripts/deploy_cloudrun.ps1` and README)
  - Deployment: likely containerized frontend + backend
  - Secrets management: README references Secret Manager (not directly visible in code)

## Environment Configuration

**Development:**
- Frontend uses `frontend/.env.example` copied to `.env.local` for local runs
- Backend uses `backend/.env.example` copied to `backend/.env` (loaded via `backend/app/config.py`)

**Production:**
- Runtime env vars for enabling/disabling:
  - `ENABLE_BIGQUERY`, `ENABLE_IMAGE_STORAGE`, `ENABLE_URBAN_CONTEXT`
  - cloud credentials assumed to be available to the container

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook routes found).

**Outgoing:**
- None detected besides request/response calls to external APIs (Gemini/OpenWeather/Nominatim) and data writes to BigQuery/GCS.

---
*Integration audit: 2026-07-20*
*Update when adding/removing external services*

