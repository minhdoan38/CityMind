---
phase: 08-async-triage-platform-refactor
plan: "03"
subsystem: infra
tags: [pg, worker, skip-locked, task-scheduler, node]

requires:
  - phase: 08-01
    provides: claim_triage_report RPC (migration file)
  - phase: 08-02
    provides: runTriageForReport
provides:
  - Self-hosted pg poll worker with SKIP LOCKED claim
  - npm run triage:worker entrypoint
  - Windows Task Scheduler CityMind-Triage registration
affects: [08-05]

tech-stack:
  added: [pg@8.22.0, tsx]
  patterns:
    - "Direct pg Pool to claim RPCs — no loopback HTTP"
    - "worker-main.ts as TypeScript entry spawned by triage-worker.mjs"

key-files:
  created:
    - src/server/triage/claim.ts
    - src/server/triage/worker.ts
    - src/server/triage/worker-main.ts
    - scripts/triage-worker.mjs
  modified:
    - scripts/register-citymind-task.ps1
    - package.json

key-decisions:
  - "Worker uses direct Postgres connection via SUPABASE_DB_URL"
  - "tsx spawns worker-main.ts for dev/prod parity"

patterns-established:
  - "runWorkerTick: reclaim stuck → claim → runTriageForReport"
  - "15-minute reclaim interval per D-11"

requirements-completed: [TRIAGE-02, TRIAGE-05]

duration: 40min
completed: 2026-07-22
---

# Phase 8 Plan 03: Background Worker Summary

**pg SKIP LOCKED poll worker with tsx entrypoint, reclaim loop, and Task Scheduler registration**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3/4 complete (Task 3 smoke checkpoint pending)
- **Files modified:** 9

## Accomplishments

- `claimNextTriageReport` / `reclaimStuckTriageReports` pg wrappers
- `runWorkerLoop` poll tick with configurable interval
- `npm run triage:worker` → `scripts/triage-worker.mjs` → `worker-main.ts`
- Task Scheduler script registers `CityMind-Triage` alongside existing CityMind tasks

## Task Commits

1. **Task 0: Approve pg package install** - auto-approved (chain mode) in `f03492d`
2. **Task 1: Install pg and implement claim/reclaim wrappers** - `f03492d` + `69e2e44` (feat/refactor)
3. **Task 2: Worker poll loop, entry script, and Task Scheduler registration** - `f03492d` + `69e2e44` (feat/refactor)
4. **Task 3: Two-terminal triage smoke** - **CHECKPOINT PENDING** (requires live DB + SUPABASE_DB_URL)

## Files Created/Modified

- `src/server/triage/claim.ts` - Parameterized RPC wrappers
- `src/server/triage/worker.ts` - `runWorkerTick`, `runWorkerLoop`
- `src/server/triage/worker-main.ts` - pg Pool bootstrap and signal handling
- `scripts/triage-worker.mjs` - Env load + tsx spawn
- `scripts/register-citymind-task.ps1` - CityMind-Triage task

## Decisions Made

- TypeScript worker entry via local tsx rather than compiled JS bundle (laptop dev simplicity)
- Reclaim runs at start of each tick before claim

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added worker-main.ts TypeScript entry**
- **Found during:** Task 2
- **Issue:** Original mjs-only worker could not import TypeScript service modules cleanly
- **Fix:** `worker-main.ts` + tsx spawn from `triage-worker.mjs`
- **Files modified:** src/server/triage/worker-main.ts, scripts/triage-worker.mjs
- **Committed in:** `69e2e44`

## Issues Encountered

**Task 3 blocked:** Two-terminal smoke requires live Supabase with migration 08-01 applied. `SUPABASE_DB_URL` missing from operator `.env.local`.

## User Setup Required

1. Add `SUPABASE_DB_URL` to `.env.local`
2. Apply 08-01 migration (see 08-01-SUMMARY)
3. Terminal 1: `npm run dev`
4. Terminal 2: `npm run triage:worker`
5. Submit report → verify pending→completed triage flow

## Next Phase Readiness

- Worker code complete and unit-tested
- Live end-to-end triage blocked on 08-01 Task 2 checkpoint

---
*Phase: 08-async-triage-platform-refactor*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: src/server/triage/worker-main.ts
- FOUND: commit f03492d
- FOUND: commit 69e2e44
