---
phase: 09-self-help-vs-government-routing
plan: "04"
subsystem: ui
tags: [routing, dashboard, status-page, officer]
requires:
  - phase: 09-02
    provides: routing_destination on reports after triage
  - phase: 09-03
    provides: citizen escalate API and playbook projection
provides:
  - officer government-default queue filter and destination badges
  - officer routing override API and detail actions
  - citizen status self-help playbook UI and escalate CTA
affects: [10]
tech-stack:
  added: []
  patterns: [government-default officer filter, self-help 3-step workflow]
key-files:
  created:
    - src/components/reports/RoutingDestinationBadge.tsx
    - src/components/RoutingOverrideActions.tsx
    - src/app/api/officer/reports/[reportId]/routing/route.ts
    - src/server/services/officer-write.test.ts
  modified:
    - src/server/officer/filters.ts
    - src/server/repositories/reports.ts
    - src/server/services/officer-write.ts
    - src/components/reports/ReportsTable.tsx
    - src/components/reports/ReportsFilters.tsx
    - src/app/[locale]/status/page.tsx
    - src/app/dashboard/reports/[reportId]/page.tsx
    - messages/en.json
    - messages/vi.json
    - tests/citizen-status.test.mjs
    - tests/dashboard-table.test.mjs
key-decisions:
  - "Default officer list excludes self_help unless Include self-help chip (routing_destination=all)"
requirements-completed: [ROUT-03, ROUT-04, ROUT-05, ROUT-06, ROUT-07]
duration: 25min
completed: 2026-07-22
---

# Phase 9 Plan 04: Routing UX Summary

**Officer government-default queue with destination badges, self-help override actions, and citizen status playbook panel with escalate CTA.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Officer list defaults to `routing_destination IS NULL OR government`; optional Include self-help widens to all
- `RoutingDestinationBadge` column in reports table; officer detail shows override actions for self_help
- Status page renders 3-step self-help workflow, playbook steps from i18n, and escalate dialog — AI block hidden on self_help path

## Task Commits

1. **Task 1: Officer filter, badges, repository tests** - `db14faf` (feat)
2. **Task 2: Officer routing override API** - `1182444` (feat)
3. **Task 3: Citizen status page self-help UI** - `3496dad` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run test` — 170 unit + 81 legacy tests pass

## Self-Check: PASSED

---
*Phase: 09-self-help-vs-government-routing*
*Completed: 2026-07-22*
