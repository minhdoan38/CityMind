---
phase: 08-async-triage-platform-refactor
plan: "04"
subsystem: database
tags: [audit, triage-runs, triage-attempts, lineage]

requires:
  - phase: 08-02
    provides: runTriageForReport orchestration
provides:
  - triage_runs and triage_attempts audit tables
  - complete_triage_report RPC for atomic finalize
  - Audit writer wired into triage service
affects: [10-shadow-rollout-production-evaluation]

tech-stack:
  added: []
  patterns:
    - "Every provider call records triage_attempts row with raw output and validation errors"
    - "complete_triage_report RPC atomically updates report + audit"

key-files:
  created:
    - supabase/migrations/20260722120002_async_triage_audit.sql
    - src/server/triage/audit.ts
  modified:
    - src/server/triage/service.ts
    - supabase/tests/08_async_triage_contract.sql

key-decisions:
  - "Audit tables in separate migration from intake schema (08-01 boundary)"
  - "Service calls startTriageRun / recordTriageAttempt / finishTriageRun around provider"

patterns-established:
  - "D-24 lineage: model, prompt version, latency, disposition per attempt"

requirements-completed: [TRIAGE-06]

duration: 25min
completed: 2026-07-22
---

# Phase 8 Plan 04: Triage Audit Lineage Summary

**triage_runs/triage_attempts tables with complete_triage_report RPC and service audit wiring**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/3 complete (Task 2 checkpoint pending)
- **Files modified:** 5

## Accomplishments

- Migration `20260722120002_async_triage_audit.sql` adds audit tables and `complete_triage_report` RPC
- `audit.ts` provides `startTriageRun`, `recordTriageAttempt`, `finishTriageRun`
- `service.ts` records full lineage per provider call
- SQL contract section 6 covers audit table assertions

## Task Commits

1. **Task 1: Audit tables migration and complete_triage_report RPC** - `15e5076` (feat)
2. **Task 2: [BLOCKING] Push audit migration and re-run SQL contract** - **CHECKPOINT PENDING** (SUPABASE_DB_URL missing)
3. **Task 3: Audit writer module and wire into triage service** - `15e5076` (feat)

## Files Created/Modified

- `supabase/migrations/20260722120002_async_triage_audit.sql` - Audit schema
- `src/server/triage/audit.ts` - Audit writer module
- `src/server/triage/service.ts` - Wired audit calls
- `supabase/tests/08_async_triage_contract.sql` - Section 6 audit assertions

## Decisions Made

- Audit insert bundled with report finalization via `complete_triage_report` RPC for atomicity

## Deviations from Plan

None - plan executed as written; Task 2 blocked on operator env.

## Issues Encountered

**Task 2 blocked:** Same `SUPABASE_DB_URL` gap as 08-01. Audit migration not applied to live Postgres.

## User Setup Required

After 08-01 migration applied:
```
node scripts/run-supabase-sql.mjs supabase/migrations/20260722120002_async_triage_audit.sql
node scripts/run-supabase-sql.mjs supabase/tests/08_async_triage_contract.sql
```

## Next Phase Readiness

- Audit code ready for Phase 10 eval gate
- Live audit persistence blocked on schema push

---
*Phase: 08-async-triage-platform-refactor*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260722120002_async_triage_audit.sql
- FOUND: src/server/triage/audit.ts
- FOUND: commit 15e5076
