---
phase: 05-analytics-pipeline
plan: "04"
subsystem: api
tags: [fastapi, bigquery, analytics, jwt, officer-auth, pydantic]

requires:
  - phase: 05-analytics-pipeline
    provides: Analytics-safe BQ DDL/views (v_volume_daily, v_category_mix, v_sla_closed, v_hotspot_category) from 05-01
provides:
  - Officer GET /api/v1/analytics with require_officer JWT gate
  - Parameterized BigQuery analytics service (ScalarQueryParameter from/to)
  - Pydantic chart-ready DTOs with empty warehouse signal
  - Pytest coverage for 401 / 422 / empty / happy path
affects:
  - 05-03 dashboard Analytics UI (Track C)
  - 05-02 public stats (separate endpoint — not this plan)

tech-stack:
  added: []
  patterns:
    - Officer analytics via Depends(require_officer) + aliased from/to query params
    - ScalarQueryParameter for all date filters (no string interpolation)
    - empty:true when all series empty (D-10)
    - Lazy BigQuery client init so CI can mock without ADC

key-files:
  created:
    - backend/app/api/analytics.py
    - backend/app/services/analytics.py
    - backend/tests/test_analytics_api.py
  modified:
    - backend/app/schemas.py
    - backend/app/main.py
    - backend/app/config.py
    - backend/.env.example

key-decisions:
  - "Category/hotspot date filters query reports_analytics (views lack day column); volume/SLA use v_volume_daily / v_sla_closed"
  - "Max analytics span clamp of 366 days → 422"
  - "Response aliases from/to for UI URL parity; no evidence/token fields (D-16/D-18)"

patterns-established:
  - "GET /api/v1/analytics?from=&to= → AnalyticsResponse with volume, category_mix, sla, hotspots, empty"
  - "Mock get_analytics_service in api module for CI without live BQ"

requirements-completed: [ANLY-03]

duration: 15min
completed: 2026-07-20
---

# Phase 5 Plan 04: Officer Analytics API Summary

**Authenticated GET /api/v1/analytics returns chart-ready volume, category, SLA, and hotspot aggregates via parameterized BigQuery — no browser BQ credentials**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-20T16:30:24Z
- **Completed:** 2026-07-20T16:35:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Wave 0 Nyquist stubs (401 without JWT, 422 for from>to) then green implementation
- Officer analytics seam: schemas, AnalyticsService, FastAPI router under `/api/v1/analytics`
- Range validation (from≤to, span≤366) and `empty:true` when warehouse has no points (D-10)
- ENABLE_BIGQUERY documented as server-only (D-13); public `/stats` deferred to 05-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 failing stubs for officer analytics API** - `b082f46` (test)
2. **Task 2: Officer GET /api/v1/analytics read API** - `5da725e` (feat)

**Plan metadata:** `59641e5` (docs: complete plan)

## Files Created/Modified

- `backend/app/api/analytics.py` — GET handler with `require_officer` + range validation
- `backend/app/services/analytics.py` — parameterized view/table queries + SLA histogram
- `backend/app/schemas.py` — AnalyticsResponse DTOs (no evidence/tokens)
- `backend/app/main.py` — include_router analytics under `/api/v1/analytics`
- `backend/app/config.py` — ENABLE_BIGQUERY comment for analytics/ETL
- `backend/.env.example` — D-13 note (no frontend BQ keys)
- `backend/tests/test_analytics_api.py` — auth, range, empty, happy-path coverage

## Decisions Made

- Category mix and hotspots filter `reports_analytics` by `DATE(created_at)` because `v_category_mix` / `v_hotspot_category` have no day column; volume uses `v_volume_daily`, SLA uses `v_sla_closed` with closed-in-range semantics
- Lazy BQ client construction so service construction does not require ADC in tests
- Span > 366 days rejected with 422 (plan optional clamp)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical functionality] Lazy BigQuery client init**
- **Found during:** Task 2 (green tests)
- **Issue:** Eager `bigquery.Client()` in `__init__` caused 502 when ADC unavailable under default `enable_bigquery=True`
- **Fix:** Lazy `@property` client creation; tests mock `get_analytics_service` on the API module
- **Files modified:** `backend/app/services/analytics.py`, `backend/tests/test_analytics_api.py`
- **Verification:** `pytest tests/test_analytics_api.py` — 5 passed
- **Committed in:** `5da725e`

**2. [Rule 2 - Critical functionality] Date-filtered category/hotspot via base table**
- **Found during:** Task 2
- **Issue:** `v_category_mix` / `v_hotspot_category` aggregate all-time with no day column; API-layer from/to would be ineffective
- **Fix:** Query `reports_analytics` with the same SELECT as the views plus `DATE(created_at) BETWEEN @from_date AND @to_date`; keep view name constants for traceability
- **Files modified:** `backend/app/services/analytics.py`
- **Verification:** Service constants include all four view names; volume/SLA still hit views
- **Committed in:** `5da725e`

---

**Total deviations:** 2 auto-fixed (Rule 2 × 2)
**Impact on plan:** Correctness for date-range analytics and CI without live GCP; no scope creep (no public stats / no dashboard UI)

## Issues Encountered

- Incomplete local `.venv` (missing FastAPI) — installed pinned `requirements.txt` before pytest (existing deps only)

## User Setup Required

None - reuses existing `ENABLE_BIGQUERY` / `GOOGLE_CLOUD_PROJECT` / ADC. No new frontend env vars (D-13).

## Next Phase Readiness

- Track C (05-03) can call `GET /api/v1/analytics?from=&to=` via `officerFetch`
- Track B (05-02) public stats remains a separate endpoint — do not reuse this officer route

## Self-Check: PASSED

- FOUND: `backend/app/api/analytics.py`
- FOUND: `backend/app/services/analytics.py`
- FOUND: `backend/tests/test_analytics_api.py`
- FOUND: commit `b082f46`
- FOUND: commit `5da725e`

---
*Phase: 05-analytics-pipeline*
*Completed: 2026-07-20*
