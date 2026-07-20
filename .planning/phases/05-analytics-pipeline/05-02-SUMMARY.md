---
phase: 05-analytics-pipeline
plan: "02"
subsystem: api
tags: [fastapi, nextjs, bigquery, analytics, rate-limit, k-anonymity, i18n]

requires:
  - phase: 05-analytics-pipeline
    provides: Analytics warehouse views and officer API from 05-01/05-04; dashboard.analytics catalogs from 05-03
provides:
  - GET /api/v1/public/stats with k≥3 category filter and dedicated stats:{ip} rate limiter
  - Next BFF GET /api/public/stats with X-Forwarded-For and Retry-After propagation
  - PublicStatsStrip on locale Home (SSR, graceful hide on failure)
  - EN/VI public.stats message catalogs
affects:
  - Phase 6 maps (no lat/lng in public strip — category concentration only)

tech-stack:
  added: []
  patterns:
    - Public stats via unauthenticated GET /api/v1/public/stats; server-side k-anonymity before response
    - public_stats_limiter with stats:{ip} keys separate from status/analyze limiters
    - SSR PublicStatsStrip calls backend directly (no browser BQ creds); BFF available for client path
    - Home strip returns null on fetch failure — page render never blocked (D-12)

key-files:
  created:
    - backend/tests/test_public_stats.py
    - frontend/src/app/api/public/stats/route.ts
    - frontend/src/components/analytics/PublicStatsStrip.tsx
    - frontend/tests/public-stats.test.mjs
  modified:
    - backend/app/api/analytics.py
    - backend/app/services/analytics.py
    - backend/app/schemas.py
    - backend/app/security.py
    - backend/app/config.py
    - backend/app/main.py
    - backend/.env.example
    - frontend/src/app/[locale]/page.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json

key-decisions:
  - "k≥3 enforced in AnalyticsService._public_top_categories before API response — never UI-only (D-17)"
  - "Public strip SSR uses backendEndpoint directly; BFF mirrors status proxy for optional client fetch (D-13)"
  - "Degrade closed: return null on stats failure — no unavailable placeholder on Home (UI-SPEC hidden path)"

patterns-established:
  - "GET /api/v1/public/stats → { total_last_30d, top_categories[{category,count}] } last 30d UTC window"
  - "Home [locale]/page.tsx inserts <PublicStatsStrip /> after #instructions, before #about/#contact"

requirements-completed: [ANLY-02]

duration: 20min
completed: 2026-07-21
---

# Phase 5 Plan 02: Public Home Stats Strip Summary

**Rate-limited GET /api/v1/public/stats with server-side k≥3 filtering, Next BFF proxy, and bilingual Home Community snapshot strip that hides on failure**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-21T09:56:00Z
- **Completed:** 2026-07-21T10:16:00Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Wave 0 RED tests for k-anonymity, allowlist payload, stats:{ip} rate limit, and frontend degrade contract
- Public aggregate API + dedicated `public_stats_limiter` + BFF with XFF/Retry-After passthrough
- `PublicStatsStrip` SSR on EN/VI Home after Instructions with 300s revalidate and null-on-error degrade
- Officer analytics tab unchanged (`test_analytics_api.py` 5 passed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing tests for public stats k-anonymity and rate limit** — `99bc864` (test)
2. **Task 2: Public aggregate API + BFF with k≥3 and dedicated rate limiter** — `d7c84f4` (feat)
3. **Task 3: Home PublicStatsStrip SSR with EN/VI and graceful degrade** — `ad0d185` (feat)

**Plan metadata:** `118bf6e` (docs: complete plan)

## Files Created/Modified

- `backend/app/api/analytics.py` — `public_router` GET `/stats` with rate limit Depends
- `backend/app/services/analytics.py` — `fetch_public_stats`, `_query_total_reports`, `_public_top_categories`
- `backend/app/schemas.py` — `PublicStatsResponse`, `PublicCategoryStat`
- `backend/app/security.py` — `public_stats_limiter`, `enforce_public_stats_rate_limit`
- `backend/app/config.py` — `public_stats_rate_limit_per_minute`
- `backend/app/main.py` — mount `/api/v1/public`
- `frontend/src/app/api/public/stats/route.ts` — GET BFF proxy
- `frontend/src/components/analytics/PublicStatsStrip.tsx` — SSR strip component
- `frontend/src/app/[locale]/page.tsx` — insert strip after instructions
- `frontend/messages/en.json`, `frontend/messages/vi.json` — `public.stats` catalogs
- `backend/tests/test_public_stats.py`, `frontend/tests/public-stats.test.mjs` — k-anonymity + smoke

## Decisions Made

- k-anonymity applied in service layer (`PUBLIC_STATS_K_MIN = 3`, cap top 2 categories)
- SSR strip fetches FastAPI directly via `backendEndpoint` (server-only); BFF retained for client/rate-limit parity
- Failure path returns `null` (hidden) per UI-SPEC rather than unavailable copy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Home placement smoke test import false positive**
- **Found during:** Task 3 (green frontend tests)
- **Issue:** `public-stats.test.mjs` matched `PublicStatsStrip` in import line — failed placement assertion
- **Fix:** Assert on `<PublicStatsStrip` JSX usage instead of bare string
- **Files modified:** `frontend/tests/public-stats.test.mjs`
- **Committed in:** `ad0d185`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Test precision only; no behavior change

## Known Stubs / Pre-existing Gaps

| File | Issue | Notes |
|------|-------|-------|
| `frontend/src/components/ReportStarterBar.tsx` | Missing component file | Pre-existing Home import; out of 05-02 scope — does not block stats strip |

## Issues Encountered

None blocking. Local pytest requires `backend/.venv` (system Python missing `pydantic_settings`).

## User Setup Required

None — reuses `ENABLE_BIGQUERY`, `PUBLIC_STATS_RATE_LIMIT_PER_MINUTE` (default 0 local). Set prod limit ~60/min as needed.

## Next Phase Readiness

- Phase 5 Track B complete — all four analytics plans executed
- Manual UAT: visit `/en` and `/vi` Home with warehouse data; verify strip shows/hides; stop API to confirm Home still loads
- Phase 6 maps can proceed; public strip intentionally excludes lat/lng

## Self-Check: PASSED

- FOUND: `backend/tests/test_public_stats.py`
- FOUND: `frontend/src/components/analytics/PublicStatsStrip.tsx`
- FOUND: `frontend/src/app/api/public/stats/route.ts`
- FOUND: `frontend/tests/public-stats.test.mjs`
- FOUND: commit `99bc864`
- FOUND: commit `d7c84f4`
- FOUND: commit `ad0d185`

---
*Phase: 05-analytics-pipeline*
*Completed: 2026-07-21*
