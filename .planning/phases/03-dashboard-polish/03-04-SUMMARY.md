---
phase: 03-dashboard-polish
plan: "04"
subsystem: ui
tags: [export, csv, xlsx, streaming, bff, nextjs, shadcn, i18n]

requires:
  - phase: 03-dashboard-polish
    provides: "FastAPI /export streaming CSV/XLSX (03-01) + URL-synced filters (03-02)"
provides:
  - "ExportButton with CSV/Excel and preparing/error states"
  - "Authenticated BFF stream proxy /api/officer/reports/export"
  - "Sidebar Export → /dashboard?focus=export focus wiring"
  - "EN/VI export catalog keys (DASH-06 / DASH-07)"
affects:
  - phase-03-verification
  - officer-ops-export

tech-stack:
  added: []
  patterns:
    - "getClaims-gated BFF stream proxy (image-route analog) with Content-Disposition passthrough"
    - "Client ExportButton builds filter query via buildReportsQuery; no SheetJS"

key-files:
  created:
    - frontend/src/components/reports/ExportButton.tsx
    - frontend/src/app/api/officer/reports/export/route.ts
    - frontend/tests/dashboard-export.test.mjs
  modified:
    - frontend/src/app/dashboard/page.tsx
    - frontend/src/app/dashboard/layout.tsx
    - frontend/src/components/DashboardSidebar.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json
    - frontend/tests/dashboard-table.test.mjs

key-decisions:
  - "Export uses fetch+blob download for error Alert UX; BFF still streams from FastAPI (no client SheetJS)"
  - "Sidebar Export active state via useSearchParams; Suspense wrapper in dashboard layout"
  - "Additive EN/VI export keys only — preserved 03-03 detail/resolve catalog"

patterns-established:
  - "Officer download BFF: getClaims → officerFetch → Response(body) with Content-Type + Content-Disposition"
  - "focus=export focuses ExportButton on mount (scrollIntoView + focus)"

requirements-completed: [DASH-06, DASH-07]

duration: 10min
completed: 2026-07-20
---

# Phase 03 Plan 04: Track B Export UI/BFF Summary

**Filtered CSV/Excel download via getClaims-gated streaming BFF, ExportButton with preparing/error states, and sidebar `?focus=export` focus wiring**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-20T16:10:28Z
- **Completed:** 2026-07-20T16:20:00Z
- **Tasks:** 1 (TDD RED + GREEN)
- **Files modified:** 10

## Accomplishments

- Officers export the current filtered report set as CSV or Excel from the Reports toolbar.
- Next BFF proxies FastAPI `/api/v1/reports/export` with session gate and header passthrough (no JSON body parse).
- Sidebar Export routes to `/dashboard?focus=export` and focuses the Export control; EN/VI UI-SPEC copy shipped.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing export smoke** - `07b4984` (test)
2. **Task 1 (GREEN): Export UI/BFF + focus wiring** - `0dba051` (feat)

**Plan metadata:** _(see docs commit after this SUMMARY)_

_TDD: test → feat_

## Files Created/Modified

- `frontend/src/components/reports/ExportButton.tsx` — CSV/XLSX dropdown, preparing/disabled, failure Alert, focus=export
- `frontend/src/app/api/officer/reports/export/route.ts` — getClaims + officerFetch stream proxy
- `frontend/src/app/dashboard/page.tsx` — mount ExportButton with current filters + focus flag
- `frontend/src/app/dashboard/layout.tsx` — Suspense around sidebar for useSearchParams
- `frontend/src/components/DashboardSidebar.tsx` — Export url `/dashboard?focus=export`
- `frontend/messages/en.json` / `vi.json` — additive export keys
- `frontend/tests/dashboard-export.test.mjs` — smoke assertions
- `frontend/tests/dashboard-table.test.mjs` — expect ExportButton (03-04 ownership)
- `.planning/phases/03-dashboard-polish/deferred-items.md` — reconfirmed ReportStarterBar build block

## Decisions Made

- Prefer fetch + blob for download so failures show UI-SPEC Alert; avoid client-side SheetJS / full JSON materialization.
- Wrap `DashboardSidebar` in `Suspense` so `useSearchParams` for Export active state is Next-safe.
- Only add export catalog keys; leave 03-03 detail/resolve strings untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Suspense for sidebar useSearchParams**
- **Found during:** Task 1 (GREEN)
- **Issue:** `useSearchParams` in `DashboardSidebar` requires a Suspense boundary for Next App Router.
- **Fix:** Wrapped sidebar in `<Suspense fallback={null}>` in dashboard layout.
- **Files modified:** `frontend/src/app/dashboard/layout.tsx`
- **Verification:** Lint clean for changed files; smoke tests pass
- **Committed in:** `0dba051`

**2. [Rule 3 - Blocking] Flip 03-02 ExportButton negative assertion**
- **Found during:** Task 1 (GREEN)
- **Issue:** `dashboard-table.test.mjs` forbade `ExportButton` (03-02 scope). Adding ExportButton would fail that suite.
- **Fix:** Assert ExportButton is present (owned by 03-04).
- **Files modified:** `frontend/tests/dashboard-table.test.mjs`
- **Verification:** `node --test tests/dashboard-table.test.mjs` passes
- **Committed in:** `0dba051`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Necessary for Next correctness and suite consistency. No scope creep.

## Issues Encountered

- `npm run build` still fails on pre-existing missing `@/components/ReportStarterBar` (public Home). Same blocker as 03-03; reconfirmed in `deferred-items.md`. Export smoke + lint pass; production build remains blocked until that file is restored.

## TDD Gate Compliance

- RED: `07b4984` — `test(03-04): add failing smoke for export UI/BFF`
- GREEN: `0dba051` — `feat(03-04): wire filtered CSV/Excel export UI and BFF`
- REFACTOR: none

## Threat Flags

None — export BFF matches plan threat model T-03-06 (getClaims gate + officer-only FastAPI forward).

## Known Stubs

None — export control is wired to live BFF/FastAPI path (runtime depends on backend + auth).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03 plans 01–04 complete at code level; ready for phase verification / UAT (filter → Export CSV; sidebar Export focuses control).
- Unblock `next build` by restoring `ReportStarterBar` (deferred).
- Schema push concern from 03-01 remains for live export against remote Supabase if not already applied locally.

## Self-Check: PASSED

- FOUND: ExportButton.tsx, export/route.ts, dashboard-export.test.mjs, 03-04-SUMMARY.md
- FOUND: commits 07b4984, 0dba051

---
*Phase: 03-dashboard-polish*
*Completed: 2026-07-20*
