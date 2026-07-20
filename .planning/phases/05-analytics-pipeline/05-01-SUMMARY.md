---
phase: 05-analytics-pipeline
plan: "01"
subsystem: infra
tags: [bigquery, etl, supabase, privacy, watermarks, analytics]

requires:
  - phase: 01-supabase-foundation
    provides: Supabase ops SoT (reports, status_events); BigQuery analytics-only destination
provides:
  - Analytics-safe BigQuery DDL (reports_analytics, status_events_analytics, etl_watermarks)
  - Four analytics views (volume, category, SLA, hotspot)
  - Dual-watermark privacy-projected ETL CLI (python -m app.jobs.etl_supabase_to_bigquery)
  - Pytest coverage for privacy allowlist, watermark ordering, SLA/range helpers
  - Cloud Run Job + Scheduler USER-SETUP deploy checklist
affects:
  - 05-04 officer analytics API
  - 05-03 dashboard Analytics UI
  - 05-02 public stats strip

tech-stack:
  added: []
  patterns:
    - Dual-watermark incremental ETL (reports created_at + status-driven MERGE; events append by event_id)
    - Allowlist-only column projection (D-16) enforced in code + tests
    - Load+MERGE into *_analytics tables (no ops CRUD via BQ)
    - Watermark advance only after confirmed load (D-03)

key-files:
  created:
    - backend/app/jobs/etl_supabase_to_bigquery.py
    - backend/app/jobs/__init__.py
    - infra/bigquery/reports_analytics.sql
    - infra/bigquery/status_events_analytics.sql
    - infra/bigquery/etl_watermarks.sql
    - infra/bigquery/analytics_views.sql
    - scripts/deploy_etl_job.md
    - backend/tests/test_etl_privacy.py
    - backend/tests/test_etl_watermarks.py
    - backend/tests/test_analytics_views.py
  modified:
    - backend/app/services/supabase.py
    - backend/app/services/bigquery.py

key-decisions:
  - "New *_analytics BQ tables (not in-place DROP of legacy reports columns)"
  - "Dual watermarks because reports has no updated_at"
  - "SLA open = report created_at; close = MIN(resolved/rejected) per report_id"
  - "GCP project/region/SA left as USER-SETUP placeholders in deploy_etl_job.md"

patterns-established:
  - "ETL entry: python -m app.jobs.etl_supabase_to_bigquery [--full-reload] [--dry-run]"
  - "BigQueryAnalyticsWarehouse implements WatermarkStore get/set + load MERGE"
  - "Pure-Python aggregation helpers mirror view semantics for unit tests"

requirements-completed: [ANLY-01, ANLY-02]

duration: 15min
completed: 2026-07-20
---

# Phase 5 Plan 01: Analytics Warehouse ETL Summary

**Privacy-projected dual-watermark Supabase→BigQuery ETL with analytics-safe DDL/views and daily Job/Scheduler ops checklist**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-20T16:23:06Z
- **Completed:** 2026-07-20T16:38:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Wave 0 Nyquist stubs (privacy, watermarks, view helpers) then green implementation
- Analytics-safe BigQuery tables + `v_volume_daily`, `v_category_mix`, `v_sla_closed`, `v_hotspot_category`
- Incremental ETL with `--full-reload` / `--dry-run`; watermarks advance only after successful load
- Ops checklist for Cloud Run Job + `0 6 * * *` Asia/Ho_Chi_Minh Scheduler (no live GCP create)

## Task Commits

1. **Task 1: Wave 0 failing stubs** - `b8466e2` (test)
2. **Task 2: Analytics DDL/views + ETL job** - `d671b92` (feat)

**Plan metadata:** `ade6773` (docs: complete plan)

## Files Created/Modified

- `backend/app/jobs/etl_supabase_to_bigquery.py` — CLI ETL, allowlists, aggregation helpers, `run_etl`
- `backend/app/services/supabase.py` — `extract_analytics_batch` (projected select; no access_tokens)
- `backend/app/services/bigquery.py` — `BigQueryAnalyticsWarehouse` (watermarks + MERGE load)
- `infra/bigquery/reports_analytics.sql` / `status_events_analytics.sql` / `etl_watermarks.sql` / `analytics_views.sql`
- `scripts/deploy_etl_job.md` — USER-SETUP Job/Scheduler/env checklist
- `backend/tests/test_etl_privacy.py` / `test_etl_watermarks.py` / `test_analytics_views.py`

## Decisions Made

- Prefer new `*_analytics` tables over mutating legacy `citymind.reports` ops-shaped schema
- Dual-watermark path because Supabase `reports` lacks `updated_at`
- Hotspots = category volume ranks only (no maps / Phase 6)
- Live GCP Job/Scheduler creation deferred to ops via placeholders

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- No project `.venv` on host — created local `backend/.venv` (gitignored) with pytest for verification; production image still uses Docker Python deps

## User Setup Required

**External GCP/Supabase configuration required** before daily sync runs in cloud. See [scripts/deploy_etl_job.md](../../../scripts/deploy_etl_job.md):

| Step | Detail |
|------|--------|
| Env | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (service_role, Job only), `GOOGLE_CLOUD_PROJECT` |
| BigQuery DDL | Apply analytics SQL under `infra/bigquery/` (replace `PROJECT_ID`) — localhost Supabase does not replace this |
| Cloud Run Job | `citymind-etl` entry `python -m app.jobs.etl_supabase_to_bigquery` |
| Scheduler | `0 6 * * *` timezone `Asia/Ho_Chi_Minh`, OAuth SA with `run.invoker` |
| Observability | Non-zero exit + `etl_failure` JSON logs; optional log-based alert |

Do **not** invent project/region/SA names — ops fills them from the live GCP project.

## Next Phase Readiness

- Warehouse Track A ready for Plan **05-04** (officer `GET /api/v1/analytics` — not implemented here)
- Views and ETL contracts available for Tracks B/C consumers
- Officer API must not be assumed deployed until 05-04

## TDD Gate Compliance

1. RED: `b8466e2` — `test(05-01): add Wave 0 failing stubs...`
2. GREEN: `d671b92` — `feat(05-01): analytics-safe BQ DDL/views and dual-watermark ETL job`

## Self-Check: PASSED

- FOUND: `backend/app/jobs/etl_supabase_to_bigquery.py`
- FOUND: `infra/bigquery/analytics_views.sql`
- FOUND: `scripts/deploy_etl_job.md`
- FOUND: commits `b8466e2`, `d671b92`
- FOUND: pytest 11 passed (`test_etl_privacy`, `test_etl_watermarks`, `test_analytics_views`)

---
*Phase: 05-analytics-pipeline*
*Completed: 2026-07-20*
