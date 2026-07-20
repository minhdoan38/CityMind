# Architecture

**Analysis Date:** 2026-07-20

## Pattern Overview

**Overall:** Two-service MVP (Next.js full-stack UI + FastAPI API) with server-side proxying

**Key Characteristics:**
- Frontend serves both public submission UI and an authenticated officer dashboard
- Backend is a thin REST API around services (Gemini, BigQuery, GCS, optional urban context)
- Decision outputs from Gemini are structured and treated as advisory

## Layers

**Frontend UI (Next.js app router):**
- Purpose: User-facing pages for citizens and officers
- Contains: Server components/pages + client components for form interactions
- Depends on: Next.js routing/rendering
- Used by: End users (public) and officers (authenticated dashboard)
- Key locations: `frontend/src/app/page.tsx`, `frontend/src/app/report/page.tsx`, `frontend/src/app/reports/[reportId]/page.tsx`

**Frontend API proxy (Next.js route handlers):**
- Purpose: Bridge Next app to FastAPI, add officer session handling, and stream evidence images
- Contains: `route.ts` handlers that call `frontend/src/lib/backend.ts`
- Depends on: Backend URL + officer API key header (env-driven)
- Used by: UI pages/components
- Key locations:
  - `frontend/src/app/api/public/reports/analyze/route.ts`
  - `frontend/src/app/api/session/login/route.ts`, `frontend/src/app/api/session/logout/route.ts`
  - `frontend/src/app/api/officer/reports/[reportId]/status/route.ts`
  - `frontend/src/app/api/officer/reports/[reportId]/image/route.ts`

**Backend API layer (FastAPI router):**
- Purpose: HTTP boundary for report ingestion, querying, and status transitions
- Contains: `/api/v1/reports/analyze`, `/recent`, `/summary`, `/{report_id}` and status/image endpoints
- Depends on: service classes (GeminiAnalyzer, BigQueryReportSink, UrbanContextService, EvidenceStorage)
- Used by: Next.js proxy routes
- Key locations: `backend/app/api/reports.py`, `backend/app/main.py`

**Service/Integration layer (backend/app/services):**
- Purpose: Encapsulate external calls and persistence logic
- Contains:
  - `GeminiAnalyzer` (Vertex AI Gemini)
  - `BigQueryReportSink` (BigQuery reads/writes)
  - `UrbanContextService` (OpenWeather + Nominatim)
  - `EvidenceStorage` (GCS evidence)
- Depends on: external SDKs and environment configuration

## Data Flow

**Public report submission (HTTP form -> FastAPI analysis -> persistence):**

1. User submits the report on the public page: `frontend/src/components/ReportForm.tsx`
2. Next route handler `frontend/src/app/api/public/reports/analyze/route.ts` forwards the form-data to FastAPI
3. FastAPI endpoint `backend/app/api/reports.py::analyze_report`:
   - Validates/normalizes inputs (description, optional image, lat/lon)
   - Applies rate limiting via `backend/app/security.py::enforce_report_rate_limit`
   - Uploads evidence to GCS via `EvidenceStorage.upload_image()` (optional/enabled)
   - Enriches description with urban context via `UrbanContextService.get_context()` (optional/enabled)
   - Calls Gemini via `GeminiAnalyzer.analyze()` to generate `ReportAnalysis`
   - Persists report + analysis and returns `report_id` + analysis payload

**Officer dashboard (authenticated read + updates):**

1. Officer logs in via `frontend/src/app/api/session/login/route.ts`:
   - Creates HttpOnly HMAC cookie `citymind_officer_session`
2. Server components call `requireOfficerSession()` to guard access
3. Dashboard page `frontend/src/app/page.tsx` fetches:
   - `/api/v1/reports/recent` (with filters)
   - `/api/v1/reports/summary`
4. Officer updates status via `frontend/src/components/StatusActions.tsx`:
   - PATCH to Next API route, which forwards PATCH to FastAPI with the officer header
5. Evidence image is streamed through Next:
   - Next API route calls FastAPI image endpoint; FastAPI streams bytes from GCS

## Key Abstractions

**GeminiAnalyzer:**
- Purpose: Turn citizen description + optional evidence image into structured `ReportAnalysis`
- Examples: `backend/app/services/gemini.py::GeminiAnalyzer`
- Pattern: Service object wrapping an SDK client; JSON-schema shaped responses

**BigQueryReportSink:**
- Purpose: Persist reports and status history; query recent items
- Examples: `backend/app/services/bigquery.py::BigQueryReportSink`
- Pattern: Data-access object; SQL queries with parameterized inputs

**UrbanContextService:**
- Purpose: Optional enrichment (weather + reverse geocoding)
- Examples: `backend/app/services/context_data.py`
- Pattern: Feature-gated HTTP enrichment with graceful degradation per sub-call

**EvidenceStorage:**
- Purpose: Optional evidence image storage in GCS
- Examples: `backend/app/services/storage.py`
- Pattern: Feature-gated upload/download returning `gs://` URIs

## Entry Points

**Backend:**
- FastAPI app instantiation + CORS + router wiring:
  - `backend/app/main.py`
- Server runtime:
  - `uvicorn app.main:app --host 0.0.0.0 --port ${PORT}` (see `backend/Dockerfile`)

**Frontend:**
- Next.js entry routes:
  - Dashboard: `frontend/src/app/page.tsx`
  - Public form: `frontend/src/app/report/page.tsx`
  - Report detail: `frontend/src/app/reports/[reportId]/page.tsx`
  - Login: `frontend/src/app/login/page.tsx`
- Next server route handlers:
  - `frontend/src/app/api/**/route.ts`

## Error Handling

**Backend strategy:**
- Request-level validation via Pydantic/FastAPI produces 4xx responses.
- External/service calls are wrapped:
  - Gemini/BigQuery/GCS failures often become `HTTPException(502, ...)` at the API boundary
- Status transitions and image fetching:
  - Return 404 for missing report/image, 422 for invalid enum filters, 502 for upstream failures

**Frontend strategy:**
- Fetch wrappers check `res.ok` and show user-friendly error text.
- Some officer actions use optimistic UI refresh (`router.refresh()`) after success.

## Cross-Cutting Concerns

**CORS:**
- Configured in FastAPI `backend/app/main.py` using `settings.cors_origin_list`

**Authentication/Authorization:**
- Frontend session cookie + server components guard routes
- Backend officer auth enforced per request via `X-CityMind-Officer-Key`

**Rate limiting:**
- In-memory sliding window limiter per FastAPI instance:
  - `backend/app/security.py::SlidingWindowLimiter`

---
*Architecture analysis: 2026-07-20*
*Update when major patterns change*

