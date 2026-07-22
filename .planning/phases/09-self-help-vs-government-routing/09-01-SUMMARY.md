---
phase: 09-self-help-vs-government-routing
plan: "01"
subsystem: database
tags: [routing, supabase, policy, postgres]
requires: []
provides:
  - routing_* audit columns on reports
  - escalate_report_to_government RPC
  - evaluateRoutingPolicy pure module
  - graffiti category in CategorySchema
affects: [09-02, 09-03, 09-04]
tech-stack:
  added: []
  patterns: [deterministic routing policy semver, SQL contract gate]
key-files:
  created:
    - supabase/migrations/20260722130001_routing_columns.sql
    - supabase/tests/09_routing_contract.sql
    - src/server/routing/policy.ts
    - src/server/routing/policy.test.ts
  modified:
    - src/server/domain/report-analysis.ts
    - src/server/officer/filters.ts
key-decisions:
  - "ROUTING_POLICY_VERSION 1.0.0 persisted on every routing decision"
  - "manual_review/failed always route government before eligibility checks"
requirements-completed: [ROUT-01, ROUT-02, ROUT-03, ROUT-08]
duration: 25min
completed: 2026-07-22
---

# Phase 9 Plan 01: Routing Schema and Policy Summary

**Deterministic routing policy module with routing audit columns migration and SQL contract — live DB push blocked on SUPABASE_DB_URL.**

## Performance

- **Duration:** ~25 min (Tasks 1 and 3)
- **Tasks:** 2 of 3 complete (Task 2 blocked)
- **Files modified:** 6

## Accomplishments

- Migration adds `routing_destination`, `routing_reason`, `routing_policy_version`, `routed_at` plus `escalate_report_to_government` RPC
- `evaluateRoutingPolicy` unit tests cover D-21..D-24 with `ROUTING_POLICY_VERSION`
- `graffiti` added to `CategorySchema` and `VALID_CATEGORIES`

## Task Commits

1. **Task 1: Routing schema migration and SQL contract** - `74d8a67` (test)
2. **Task 2: Push routing schema** - BLOCKED — requires `SUPABASE_DB_URL` in `.env.local`
3. **Task 3: Routing policy module and unit tests** - `ed3b1bb` (feat)

## Auth Gates / User Setup

**Task 2 (blocking checkpoint):** Operator must set `SUPABASE_DB_URL` (direct Postgres URL) in `frontend/.env.local`, then run:

```bash
node scripts/run-supabase-sql.mjs supabase/migrations/20260722130001_routing_columns.sql
node scripts/run-supabase-sql.mjs supabase/tests/09_routing_contract.sql
```

Downstream integration against live DB remains blocked until this passes.

## Deviations from Plan

None for completed tasks — Task 2 deferred per human-action checkpoint.

## Next Phase Readiness

- Policy module and migration files ready for worker hook (09-02) and APIs (09-03/09-04)
- Live schema push still required before SQL contract gate and production routing columns

## Self-Check: PASSED

---
*Phase: 09-self-help-vs-government-routing*
*Completed: 2026-07-22*
