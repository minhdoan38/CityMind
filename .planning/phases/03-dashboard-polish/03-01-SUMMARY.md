---
phase: 03-dashboard-polish
plan: "01"
subsystem: api
tags: [fastapi, supabase, keyset-pagination, export, xlsxwriter, actor_id]

requires:
  - phase: 01-supabase-foundation
    provides: Supabase reports/status_events schema, officer JWT auth, ReportSink
  - phase: 02-public-experience
    provides: Officer dashboard shell and Bearer officerFetch patterns
provides:
  - "Additive migration current_status + status_events.actor_id + indexes"
  - "OfficerPrincipal with actor_id from JWT sub"
  - "Keyset cursor list_recent with opaque next_cursor"
  - "Filtered summary matching list filters"
  - "Streaming CSV/XLSX export via /api/v1/reports/export"
  - "Status PATCH note gate for resolved/rejected + actor_id persistence"
affects:
  - 03-02 dashboard table UI
  - 03-03 detail resolve Dialog
  - 03-04 export button/BFF

tech-stack:
  added: [XlsxWriter==3.2.9]
  patterns:
    - "OfficerPrincipal replaces raw JWT string at Depends(require_officer)"
    - "Keyset ordering (sort_key, report_id) with opaque next_cursor"
    - "StreamingResponse for export — no full-result memory buffer"
    - "Note required in FastAPI before sink for resolved/rejected"

key-files:
  created:
    - supabase/migrations/20260720_000002_dashboard_polish.sql
    - backend/tests/test_export.py
  modified:
    - backend/requirements.txt
    - backend/app/security.py
    - backend/app/services/supabase.py
    - backend/app/api/reports.py
    - backend/tests/test_reports.py
    - backend/tests/test_security.py
    - backend/tests/test_supabase.py

key-decisions:
  - "Local Supabase: apply 20260720_000002 via local migration (`supabase migration up` / `db reset`), not remote `supabase db push`"
  - "XlsxWriter==3.2.9 Keep after SUS checkpoint — pinned in requirements.txt"
  - "actor_id always from JWT sub — never body-supplied"

patterns-established:
  - "Register /export before /{report_id} so path does not shadow export"
  - "update_status sets reports.current_status denorm + inserts status_events.actor_id"

requirements-completed: [DATA-04, DATA-05, DATA-06, DATA-07]

duration: prior-session
completed: 2026-07-20
status: complete
---

# Phase 3 Plan 01: Track A Dashboard API Summary

**Additive schema + OfficerPrincipal + keyset list/filtered summary + streaming CSV/XLSX export with JWT actor and note-gated status — closed out from existing commits (local Supabase, no remote db push).**

## Performance

- **Duration:** prior session + close-out
- **Completed:** 2026-07-20
- **Tasks:** 3/3 (code complete; remote push N/A for local Supabase)
- **Files modified:** 8+

## Accomplishments

- Migration `20260720_000002_dashboard_polish.sql`: `reports.current_status`, `status_events.actor_id`, backfill, indexes.
- `OfficerPrincipal.actor_id` from JWT `sub`; resolve/reject blank note → 422.
- `/recent` returns opaque `next_cursor`; `/summary` respects list filters; `/export` streams CSV/XLSX with officer auth.
- XlsxWriter==3.2.9 pinned after SUS checkpoint.

## Task Commits

1. **Task 1 (checkpoint) + Task 2 RED:** `347398b` — test(03-01): failing tests for actor_id and note gate
2. **Task 2 GREEN:** `f3d5e4a` — feat(03-01): schema actor_id/current_status, Principal, note gate
3. **Task 3 RED:** `3e35fa4` — test(03-01): failing tests for cursor, summary filters, export
4. **Task 3 GREEN:** `b3b06c8` — feat(03-01): keyset list, filtered summary, streaming CSV/XLSX export

**Plan metadata:** close-out SUMMARY (this commit)

## Files Created/Modified

- `supabase/migrations/20260720_000002_dashboard_polish.sql` — additive schema
- `backend/app/security.py` — OfficerPrincipal
- `backend/app/services/supabase.py` — keyset list, filtered summary, export iterators, actor_id
- `backend/app/api/reports.py` — cursor list, summary filters, /export, note gate
- `backend/tests/test_export.py` — export auth + content-type coverage
- `backend/requirements.txt` — XlsxWriter==3.2.9

## Decisions Made

- **Local Supabase ops:** Remote `supabase db push --linked` is not used. Apply migration locally (`supabase migration up` or `supabase db reset` against local stack). Developer owns local apply before Wave 2 UI hits live schema columns.
- XlsxWriter Keep at 3.2.9 after human SUS approval (package present in requirements).

## Deviations from Plan

### Known deviation — remote push skipped (environment)

**1. [Environment] Local Supabase instead of remote db push**
- **Found during:** Safe-resume close-out
- **Issue:** Plan Task 2 automated verification required `supabase db push --linked` with remote project credentials.
- **Fix:** Document local migration apply path; do not block close-out on remote push.
- **Verification:** Migration SQL present in repo; code paths use `current_status` / `actor_id`.
- **Impact:** Officer must run local migrate before exercising filtered list against real DB.

**Total deviations:** 1 environment adaptation  
**Impact on plan:** No scope creep — Track A code deliverables intact.

## Issues Encountered

- Prior session left commits without SUMMARY — closed out via safe-resume gate rather than re-execute.
- STATE previously flagged remote MCP/db push timeouts; moot for localhost Supabase.

## User Setup Required

**Local only:** From repo root, with local Supabase running:

```bash
supabase migration up
# or: supabase db reset   # if full local reset is acceptable
```

Confirm columns exist: `reports.current_status`, `status_events.actor_id`.

## Next Phase Readiness

Wave 2 (03-02) can consume cursor list + filtered summary APIs. Export UI (03-04) can stream from `/export`.

## Self-Check: PASSED (close-out)

- [x] Key artifacts from commits present on disk
- [x] SUMMARY written; ROADMAP/STATE to be updated by orchestrator
- [x] Remote db push explicitly out of scope for local Supabase
