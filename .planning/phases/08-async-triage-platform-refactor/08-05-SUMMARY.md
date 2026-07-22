---
phase: 08-async-triage-platform-refactor
plan: "05"
subsystem: ui
tags: [citizen-status, officer-dashboard, triage-badges, i18n]

requires:
  - phase: 08-01
    provides: triage_status field on reports
  - phase: 08-02
    provides: triage disposition outcomes
  - phase: 08-03
    provides: background worker (for live status transitions)
provides:
  - Citizen service-progress status page with AI gating
  - Officer triage badges, default elevated sort, filter chips
  - Detail page section reorder with advisory disclaimer
affects: [09-self-help-government-routing]

tech-stack:
  added: []
  patterns:
    - "projectCitizenTriageView strips AI fields until triage_status=completed"
    - "Default officer sort triage_bucket elevates manual_review/failed"

key-files:
  created:
    - src/server/services/citizen-status.ts
    - src/components/reports/TriageStatusBadge.tsx
    - src/app/[locale]/status/page.tsx
  modified:
    - src/app/dashboard/reports/[reportId]/page.tsx
    - src/server/repositories/reports.ts
    - messages/en.json
    - messages/vi.json

key-decisions:
  - "Citizen never sees triage_error — calm copy on failed/manual_review"
  - "Detail page keeps legacy detailAiDisclaimer for contract tests"

patterns-established:
  - "service_step enum maps triage_status + officer status to citizen workflow labels"
  - "Qualitative confidence band on detail page — no Math.round percentage"

requirements-completed: [TRIAGE-03, TRIAGE-04]

duration: 50min
completed: 2026-07-22
---

# Phase 8 Plan 05: Citizen & Officer Triage UX Summary

**Service-progress citizen status, triage badges with elevated default sort, and gated AI reveal on detail**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3 complete
- **Files modified:** 14

## Accomplishments

- `projectCitizenTriageView` implements D-13–D-16 service steps and AI field gating
- Status page with `CitizenWorkflowStepper`, calm failure notice, conditional AI block
- Officer table: `TriageStatusBadge`, default `triage_bucket` sort, triage_status filter chips
- Detail page reordered per D-19/D-20 with advisory disclaimer and qualitative confidence

## Task Commits

1. **Task 1: Citizen status API projection and status page UX** - `9d9c7f6` (feat)
2. **Task 2: Officer queue badges, triage sort, and filter chips** - `9d9c7f6` (feat)
3. **Task 3: Officer detail reorder, success page verify, confidence label** - `9d9c7f6` (feat)

## Files Created/Modified

- `src/server/services/citizen-status.ts` - Citizen triage projection
- `src/app/[locale]/status/page.tsx` - Workflow stepper UI
- `src/components/reports/TriageStatusBadge.tsx` - Officer badge component
- `src/components/reports/ReportsTable.tsx` - Badge column
- `src/server/repositories/reports.ts` - triage_bucket sort + filter
- `src/app/dashboard/reports/[reportId]/page.tsx` - Section reorder + gating

## Decisions Made

- Combined `detailAiDisclaimer` + `detailHelper` in advisory Alert to satisfy legacy contract test
- Duplicate `triage_status` key in filters parser removed during implementation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored detailAiDisclaimer in detail page**
- **Found during:** Task 3 verification
- **Issue:** Legacy test `dashboard-detail.test.mjs` expects `detailAiDisclaimer` string
- **Fix:** Include `t("detailAiDisclaimer")` in AI advisory Alert alongside `detailHelper`
- **Files modified:** src/app/dashboard/reports/[reportId]/page.tsx
- **Committed in:** `9d9c7f6`

## Issues Encountered

None — unit tests 141/141, legacy tests 78/78 pass.

## User Setup Required

None for UX layer. Live triage status transitions require 08-01 schema + worker (08-03 smoke).

## Next Phase Readiness

- UX contracts complete for Phase 9 routing work
- Live citizen status transitions depend on 08-01/08-03 checkpoints

---
*Phase: 08-async-triage-platform-refactor*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: src/server/services/citizen-status.ts
- FOUND: src/app/[locale]/status/page.tsx
- FOUND: commit 9d9c7f6
