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

**Deterministic routing policy module with routing audit columns migration and SQL contract — live DB verified 2026-07-22.**

## Performance

- **Duration:** ~25 min (+ operator SQL apply)
- **Tasks:** 3/3 complete
- **Files modified:** 6 (+ corrective migrations 40002/40003)

## Accomplishments

- Migration adds `routing_destination`, `routing_reason`, `routing_policy_version`, `routed_at` plus `escalate_report_to_government` RPC
- `evaluateRoutingPolicy` unit tests cover D-21..D-24 with `ROUTING_POLICY_VERSION`
- `graffiti` added to `CategorySchema` and `VALID_CATEGORIES`

## Task Commits

1. **Task 1: Routing schema migration and SQL contract** - `74d8a67` (test)
2. **Task 2: Push routing schema** - applied via Supabase SQL Editor (2026-07-22); corrective `20260722140002`, `20260722140003`
3. **Task 3: Routing policy module and unit tests** - `ed3b1bb` (feat)

## Auth Gates / User Setup

**Task 2:** Applied via Supabase SQL Editor (2026-07-22). Follow-up corrective migrations:

- `20260722140002_fix_intake_rpc_evidence_path.sql` — drop `image_gcs_uri` from intake RPC (Phase 7 schema)
- `20260722140003_restrict_escalate_rpc_grants.sql` — revoke escalate RPC from anon/authenticated

Contract: `supabase/tests/09_routing_contract.sql` — PASS

## Deviations from Plan

Corrective migrations added after live apply exposed `image_gcs_uri` drift and SQL Editor grant-check behavior.

## Next Phase Readiness

- Live routing columns and escalate RPC verified; downstream plans unblocked

## Self-Check: PASSED

---
*Phase: 09-self-help-vs-government-routing*
*Completed: 2026-07-22*
