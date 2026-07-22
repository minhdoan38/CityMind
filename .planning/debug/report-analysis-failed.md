---
status: diagnosed
trigger: Report analysis failed
created: 2026-07-21
updated: 2026-07-21
---

# Debug: report-analysis-failed

## Symptoms

- **Expected:** Citizen report submit calls Gemini via `/api/v1/reports/analyze` and returns structured analysis + access token.
- **Actual:** `POST /api/public/reports/analyze` returns **502** with body `{"detail":"Report analysis failed"}`.
- **Error:** Generic backend catch-all; real exception logged server-side.
- **Timeline:** Reproduced 2026-07-21 against Docker backend (`citymind-backend-1`).
- **Reproduction:** Submit any report from `/en/report` (or POST to backend analyze endpoint).

## Current Focus

hypothesis: Vertex AI Gemini call fails because Docker backend has no GCP Application Default Credentials and GOOGLE_CLOUD_PROJECT is still the placeholder `your-project-id`.
test: Inspect `docker logs citymind-backend-1` after a failed analyze POST.
expecting: `google.auth.exceptions.DefaultCredentialsError` during `get_analyzer().analyze()`.
next_action: Configure real GCP project + ADC (or service-account key mount) in backend/.env and docker-compose; restart backend.

## Evidence

- timestamp: 2026-07-21T10:27+07 — Frontend log: `POST /api/public/reports/analyze 502 in 3.5s`
- timestamp: 2026-07-21T10:27+07 — Backend traceback:
  - `File "/app/app/api/reports.py", line 158, in analyze_report` → `get_analyzer().analyze(...)`
  - `File "/app/app/services/gemini.py", line 34` → `self.client.models.generate_content(...)`
  - `google.auth.exceptions.DefaultCredentialsError: Your default credentials were not found.`
- timestamp: 2026-07-21T10:28+07 — Container env: `GOOGLE_CLOUD_PROJECT=your-project-id` (placeholder from .env.example)
- timestamp: 2026-07-21T10:28+07 — Host has no `%APPDATA%/gcloud/application_default_credentials.json`

## Eliminated

- hypothesis: Supabase insert failure — eliminated; failure occurs before `get_sink().insert()` (stack stops at Gemini auth).
- hypothesis: Rate limiting — eliminated; would return 429, not 502.
- hypothesis: Missing description/image validation — eliminated; would return 422.

## Resolution

root_cause: Backend analyze path requires Vertex AI (Gemini) via Application Default Credentials. Docker container has neither ADC mounted nor a valid `GOOGLE_CLOUD_PROJECT` (still `your-project-id`).
fix: |
  1. Set `GOOGLE_CLOUD_PROJECT` to your real GCP project in `backend/.env`.
  2. Authenticate locally: `gcloud auth application-default login` (Vertex AI User role on project).
  3. Mount ADC into Docker backend (add to docker-compose.yml):
     volumes:
       - ${APPDATA}/gcloud:/home/citymind/.config/gcloud:ro
     environment:
       - GOOGLE_APPLICATION_CREDENTIALS=/home/citymind/.config/gcloud/application_default_credentials.json
  4. `docker compose up -d --build backend` and retry report submit.
verification: POST analyze returns 200 with `report_id`, `analysis`, and `access_token`; no DefaultCredentialsError in backend logs.
files_changed: []
