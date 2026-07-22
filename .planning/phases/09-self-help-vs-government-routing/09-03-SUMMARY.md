---
phase: 09-self-help-vs-government-routing
plan: "03"
subsystem: api
tags: [routing, citizen-api, playbooks, escalate]
requires:
  - phase: 09-01
    provides: routing columns and escalate RPC
provides:
  - static bilingual playbooks catalog
  - self-help citizen status projection
  - POST /api/public/reports/escalate
affects: [09-04]
tech-stack:
  added: []
  patterns: [playbook_id server projection, token-bound escalate]
key-files:
  created:
    - src/server/routing/playbooks.ts
    - src/server/services/citizen-escalate.ts
    - src/server/services/citizen-escalate.test.ts
    - src/app/api/public/reports/escalate/route.ts
  modified:
    - src/server/services/citizen-status.ts
    - src/server/services/citizen-status.test.ts
    - src/server/repositories/reports.ts
    - messages/en.json
    - messages/vi.json
key-decisions:
  - "Citizen API hides AI fields when routing_destination is self_help"
  - "Escalate reuses status rate limiter and uniform 401"
requirements-completed: [ROUT-04, ROUT-05, ROUT-08]
duration: 20min
completed: 2026-07-22
---

# Phase 9 Plan 03: Citizen Routing Slice Summary

**Self-help citizen status projection with static playbooks and token-bound escalate API — no new access tokens on escalation.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `PLAYBOOK_BY_CATEGORY` maps four eligible categories; EN/VI copy under `public.routing.playbooks.*`
- `projectCitizenTriageView` returns `self_help_guidance`, `playbook_id`, `can_escalate` with AI fields nulled
- `POST /api/public/reports/escalate` validates token, rate-limits, calls `escalate_report_to_government`

## Task Commits

1. **Task 1: Playbook catalog and bilingual messages** - `edc6542` (feat)
2. **Task 2: Citizen status projection** - `2cade8b` (feat)
3. **Task 3: Citizen escalate API** - `48ef26a` (feat)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npm run test:unit -- src/server/services/citizen-status.test.ts` — pass
- `npm run test:unit -- src/server/services/citizen-escalate.test.ts` — pass

## Self-Check: PASSED

---
*Phase: 09-self-help-vs-government-routing*
*Completed: 2026-07-22*
