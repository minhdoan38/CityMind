---
phase: 07-google-free-self-hosted-platform
plan: "05"
subsystem: api
tags: [officer-read, supabase-rls, dashboard, geo-pins, vitest]

requires:
  - phase: 07-04
    provides: Citizen submission slice and evidence storage
provides:
  - Officer read repository with user-scoped Supabase client injection
  - GET /api/v1/reports/{recent,summary,geo/pins,:id,status-history,image} Next.js handlers
  - Dashboard queue/detail Server Components via direct repository calls (no self-fetch)
  - Officer BFF geo/image routes delegate to local handlers
affects: [07-06, 07-07, 07-15]

key-files:
  created:
    - frontend/src/server/officer/cursor.ts
    - frontend/src/server/officer/filters.ts
    - frontend/src/server/officer/guard.ts
    - frontend/src/server/services/officer-read.ts
    - frontend/src/server/services/officer-dashboard.ts
    - frontend/src/server/repositories/reports.test.ts
    - frontend/src/app/api/v1/reports/recent/route.ts
    - frontend/src/app/api/v1/reports/summary/route.ts
    - frontend/src/app/api/v1/reports/geo/pins/route.ts
    - frontend/src/app/api/v1/reports/[reportId]/route.ts
    - frontend/src/app/api/v1/reports/[reportId]/status-history/route.ts
    - frontend/src/app/api/v1/reports/[reportId]/image/route.ts
  modified:
    - frontend/src/server/repositories/reports.ts
    - frontend/src/app/dashboard/page.tsx
    - frontend/src/app/dashboard/reports/[reportId]/page.tsx
    - frontend/src/app/api/officer/reports/geo/pins/route.ts
    - frontend/src/app/api/officer/reports/[reportId]/image/route.ts
    - frontend/tests/dashboard-table.test.mjs
    - frontend/tests/dashboard-geo-params.test.mjs
    - frontend/tests/officer-auth.test.mjs

requirements-completed: [SELFHOST-01]

duration: 65min
completed: 2026-07-21
---

# Phase 7 Plan 05 Summary

**Officer queue, map pins, detail, evidence, and history as a Next.js-only vertical slice with RLS-scoped Supabase reads**

## Task Status

| Task | Status |
|------|--------|
| 1 — Officer read contracts + API routes | **Complete** |
| 2 — Dashboard direct module reads | **Complete** |

## Verification

| Command | Result |
|---------|--------|
| `npm run test:unit` | **76/76 pass** |
| `npm run test:legacy` (dashboard + officer suites) | **PASS** |

## Deviations

- Cursor decode uses last-colon split (JS `split` limit differs from Python `maxsplit`; compatible with ISO timestamps in sort values)
- Legacy contract tests updated to expect `loadDashboardBundle` / local `handleGeoPinsRequest` instead of `officerFetch` self-fetch

## Self-Check: PASSED
