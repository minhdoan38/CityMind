---
phase: 03-dashboard-polish
plan: "02"
subsystem: ui
tags: [tanstack-table, shadcn, nextjs, filters, cursor-pagination, i18n]

requires:
  - phase: 03-dashboard-polish
    provides: Keyset /recent + filtered /summary API contract (Plan 03-01)
  - phase: 02-public-experience
    provides: Officer dashboard shell, officerFetch, next-intl dashboard catalogs
provides:
  - "TanStack/shadcn ReportsTable with manualPagination/manualSorting"
  - "Collapsible ReportsFilters with URL searchParams sync"
  - "Filtered ReportsMetrics strip from /summary"
  - "EN/VI list empty/error/filter copy per UI-SPEC"
affects:
  - 03-03 detail resolve Dialog
  - 03-04 export button/BFF

tech-stack:
  added: ["@tanstack/react-table@8.21.3", "shadcn table/checkbox/select/popover/collapsible"]
  patterns:
    - "RSC dashboard page fetches /recent + /summary with shared filter query string"
    - "Client islands mutate URL searchParams for filters/sort/cursor (no nuqs)"
    - "columnVisibility persisted under citymind.dashboard.columnVisibility; severity hidden by default"

key-files:
  created:
    - frontend/src/components/reports/ReportsTable.tsx
    - frontend/src/components/reports/ReportsFilters.tsx
    - frontend/src/components/reports/ReportsMetrics.tsx
    - frontend/src/components/reports/types.ts
    - frontend/src/components/ui/table.tsx
    - frontend/src/components/ui/checkbox.tsx
    - frontend/src/components/ui/select.tsx
    - frontend/src/components/ui/popover.tsx
    - frontend/src/components/ui/collapsible.tsx
    - frontend/tests/dashboard-table.test.mjs
  modified:
    - frontend/src/app/dashboard/page.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json
    - frontend/package.json
    - frontend/package-lock.json

key-decisions:
  - "Previous pagination clears cursor (return to first page) — API has next_cursor only"
  - "Column visibility via DropdownMenu checkboxes; severity false by default (D-01/D-05)"
  - "No ExportButton in this plan (owned by 03-04)"

patterns-established:
  - "Reports* components under frontend/src/components/reports/ for dashboard queue chrome"
  - "buildReportsQuery shared for list + summary filter parity"

requirements-completed: [DASH-02, DASH-03, DASH-07]

duration: 5min
completed: 2026-07-20
---

# Phase 3 Plan 02: Dashboard Table UI Summary

**Officer /dashboard now uses a compact TanStack + shadcn data table with collapsible URL-synced filters and a filtered metrics strip, replacing the Phase 2 ReportCard grid.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-20T15:55:25Z
- **Completed:** 2026-07-20T16:00:05Z
- **Tasks:** 1/1 (TDD RED + GREEN)
- **Files modified:** 15

## Accomplishments

- Installed `@tanstack/react-table@8.21.3` and shadcn `table` / `checkbox` / `select` / `popover` / `collapsible`.
- Replaced ReportCard list with `ReportsTable` (manualPagination/manualSorting, severity hidden + localStorage visibility), `ReportsFilters` (collapsible status/category/priority/severity/date + Clear), and `ReportsMetrics` (four filtered summary fields).
- Dashboard RSC reads `searchParams`, fetches `/api/v1/reports/recent` + `/summary` together via `officerFetch`, default `limit=25`, cursor Next via `next_cursor`.
- Extended EN/VI catalogs with UI-SPEC list/filter/empty/error copy; loading/empty/error states for list surface.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `a9b74e8` — test(03-02): add failing smoke test for dashboard table
2. **Task 1 GREEN:** `2ba91b7` — feat(03-02): ship filterable TanStack reports table on dashboard

**Plan metadata:** (this commit)

## Files Created/Modified

- `frontend/tests/dashboard-table.test.mjs` — smoke assertions for table/filter/metrics markers
- `frontend/src/components/reports/ReportsTable.tsx` — TanStack table island
- `frontend/src/components/reports/ReportsFilters.tsx` — collapsible filters + URL sync
- `frontend/src/components/reports/ReportsMetrics.tsx` — filtered metrics strip
- `frontend/src/components/reports/types.ts` — shared row/query helpers
- `frontend/src/app/dashboard/page.tsx` — RSC rewrite (no ReportCard)
- `frontend/messages/en.json` / `vi.json` — list chrome copy
- `frontend/src/components/ui/{table,checkbox,select,popover,collapsible}.tsx` — shadcn primitives
- `frontend/package.json` / `package-lock.json` — TanStack dependency

## Decisions Made

- **Previous = clear cursor:** Backend exposes opaque `next_cursor` only; Previous returns to the first page rather than inventing a reverse cursor stack.
- **No export UI:** Export button/BFF deferred to Plan 03-04 per plan scope.
- **Clinic Blue / flat table:** Border-only table surface; no ghost-card shadows under the grid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Shared query helper module**
- **Found during:** Task 1 (GREEN)
- **Issue:** List and summary must share identical filter query construction to satisfy D-08 / DATA-05 consumer parity.
- **Fix:** Added `frontend/src/components/reports/types.ts` with `buildReportsQuery` / `hasActiveFilters`.
- **Files modified:** `frontend/src/components/reports/types.ts`, consumers in page/table/filters
- **Verification:** Smoke test asserts both `/recent` and `/summary` fetches on dashboard page
- **Committed in:** `2ba91b7`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Small helper only — no scope creep; export/detail remain out of scope.

## Issues Encountered

- ESLint `react-hooks/incompatible-library` warning for `useReactTable` (expected with React Compiler + TanStack); non-blocking.

## User Setup Required

None - no external service configuration required. Local Supabase migration from 03-01 still needed for live filtered list against real schema.

## Next Phase Readiness

- Plan 03-03 can extend detail StatusActions with note Dialog.
- Plan 03-04 can add ExportButton beside existing filter chrome without rewriting the table.

## Self-Check: PASSED

- [x] `frontend/src/components/reports/ReportsTable.tsx` exists
- [x] `frontend/src/components/reports/ReportsFilters.tsx` exists
- [x] `frontend/src/components/reports/ReportsMetrics.tsx` exists
- [x] Commits `a9b74e8` and `2ba91b7` present
- [x] `node --test tests/dashboard-table.test.mjs` passes (6/6)
