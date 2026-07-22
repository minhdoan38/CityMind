---
phase: 08-async-triage-platform-refactor
plan: "01"
subsystem: database
tags: [supabase, postgres, intake, triage, skip-locked]

requires: []
provides:
  - Async triage intake schema with claim/reclaim RPCs
  - POST /api/public/reports intake without AI blocking
  - 410 Gone on legacy /analyze endpoints
affects: [08-02, 08-03, 08-04, 08-05]

tech-stack:
  added: []
  patterns:
    - "Intake RPC creates report with NULL AI columns and triage_status=pending"
    - "claim_triage_report uses FOR UPDATE SKIP LOCKED"

key-files:
  created:
    - supabase/migrations/20260722120001_async_triage_intake.sql
    - supabase/tests/08_async_triage_contract.sql
    - src/app/api/public/reports/route.ts
  modified:
    - src/server/services/report-service.ts
    - src/components/ReportForm.tsx

key-decisions:
  - "Intake returns ReportSubmissionResponse only — no AI fields in citizen response"
  - "Legacy /analyze returns 410 with migration message per D-07"

patterns-established:
  - "submitReport never calls provider.analyze"
  - "SQL contract gate in supabase/tests/08_async_triage_contract.sql"

requirements-completed: [TRIAGE-01, TRIAGE-02]

duration: 45min
completed: 2026-07-22
---

# Phase 8 Plan 01: Async Intake Schema & API Summary

**Token-first citizen intake with triage_status=pending, SKIP LOCKED claim RPCs, and 410 on legacy /analyze**

## Performance

- **Duration:** ~45 min (partial — schema push blocked)
- **Started:** 2026-07-22T00:00:00Z
- **Completed:** 2026-07-22T00:45:00Z
- **Tasks:** 2/3 complete (Task 2 checkpoint pending)
- **Files modified:** 12

## Accomplishments

- Migration adds triage lifecycle columns, `create_intake_report_with_access_token`, `claim_triage_report`, `reclaim_stuck_triage_reports`
- SQL contract scaffold covers pending→processing claim and 15-minute reclaim
- `submitReport` persists intake without AI; ReportForm posts to `/api/public/reports`
- Legacy `/analyze` routes return 410 Gone

## Task Commits

1. **Task 1: Add intake schema, claim RPCs, and SQL contract scaffold** - `0075514` (test)
2. **Task 2: [BLOCKING] Push schema and run async triage SQL contract** - **CHECKPOINT PENDING** (SUPABASE_DB_URL missing)
3. **Task 3: Intake API, 410 analyze removal, and ReportForm retarget** - `33297cb` (feat)

## Files Created/Modified

- `supabase/migrations/20260722120001_async_triage_intake.sql` - Triage columns and intake/claim RPCs
- `supabase/tests/08_async_triage_contract.sql` - Contract assertions for intake and claim
- `src/server/services/report-service.ts` - `submitReport` without provider.analyze
- `src/app/api/public/reports/route.ts` - POST intake handler
- `src/components/ReportForm.tsx` - Retargeted to intake endpoint

## Decisions Made

- Intake RPC mirrors token hashing from sync path but leaves AI columns NULL
- ReportSubmissionResponse shape per D-06 (report_id, access_token, intake_status, triage_status only)

## Deviations from Plan

None - plan executed as written; Task 2 blocked on operator env, not a deviation.

## Issues Encountered

**Task 2 blocked:** `SUPABASE_DB_URL` not set in `.env.local`. `node scripts/run-supabase-sql.mjs` cannot apply migration or run contract gate. Operator must add direct Postgres connection string before live schema verification.

## User Setup Required

Add to `.env.local`:
```
SUPABASE_DB_URL=postgresql://postgres:[password]@127.0.0.1:54322/postgres
```

Then run:
```
node scripts/run-supabase-sql.mjs supabase/migrations/20260722120001_async_triage_intake.sql
node scripts/run-supabase-sql.mjs supabase/tests/08_async_triage_contract.sql
```

## Next Phase Readiness

- Code complete for 08-02/08-03/08-05 unit tests
- Live DB claim RPCs unavailable until Task 2 checkpoint cleared

---
*Phase: 08-async-triage-platform-refactor*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: supabase/migrations/20260722120001_async_triage_intake.sql
- FOUND: commit 0075514
- FOUND: commit 33297cb
