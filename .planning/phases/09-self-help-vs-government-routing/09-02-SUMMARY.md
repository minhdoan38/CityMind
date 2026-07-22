---
phase: 09-self-help-vs-government-routing
plan: "02"
subsystem: api
tags: [routing, triage, worker]
requires:
  - phase: 09-01
    provides: evaluateRoutingPolicy and routing columns schema
provides:
  - applyRoutingForReport persistence module
  - triage worker routing hook on terminal dispositions
affects: [09-04]
tech-stack:
  added: []
  patterns: [post-triage routing hook, injectable applyRoutingForReport deps]
key-files:
  created:
    - src/server/routing/apply-routing.ts
    - src/server/routing/apply-routing.test.ts
  modified:
    - src/server/triage/service.ts
    - src/server/triage/service.test.ts
key-decisions:
  - "Routing runs only after terminal triage — never on retry"
requirements-completed: [ROUT-01, ROUT-02, ROUT-08]
duration: 15min
completed: 2026-07-22
---

# Phase 9 Plan 02: Triage Worker Routing Hook Summary

**applyRoutingForReport persists routing decisions after every terminal triage disposition; retry paths skip routing.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `applyRoutingForReport` updates `routing_destination`, `routing_reason`, `routing_policy_version`, `routed_at`
- `runTriageForReport` calls routing on completed, manual_review, and failed — not retry
- Unit tests mock Supabase update chain and assert disposition-specific payloads

## Task Commits

1. **Task 1: applyRoutingForReport service module** - `6287c82` (feat)
2. **Task 2: Hook into runTriageForReport** - `e7ff616` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run test:unit -- src/server/routing/apply-routing.test.ts` — pass
- `npm run test:unit -- src/server/triage/service.test.ts` — pass

## Self-Check: PASSED

---
*Phase: 09-self-help-vs-government-routing*
*Completed: 2026-07-22*
