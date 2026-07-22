---
phase: 10-shadow-rollout-production-evaluation
plan: "02"
subsystem: triage
tags: [shadow, eval, officer-dashboard, feature-flag, postgres]

requires:
  - phase: 10-shadow-rollout-production-evaluation
    plan: "01"
    provides: shadow-compare.ts, verify-eval-gate.mjs
provides:
  - triage_shadow_comparisons table migration + SQL contract
  - shadow-service compareShadowTriage insert-only persistence
  - TRIAGE_SHADOW_MODE worker hook on completed triage
  - Officer shadow badge, filter, detail comparison panel
affects:
  - production cutover operator workflow

tech-stack:
  added: []
  patterns:
    - Shadow dual-run after production completed path only
    - Admin client reads for officer shadow UX (service_role table)
    - TRIAGE_SHADOW_MODE off|compare with AI_MODEL_CANDIDATE gate

key-files:
  created:
    - supabase/migrations/20260722140001_triage_shadow.sql
    - supabase/tests/10_shadow_eval_contract.sql
    - src/server/evals/shadow-service.ts
    - src/server/evals/shadow-service.test.ts
    - src/components/reports/ShadowMismatchBadge.tsx
  modified:
    - src/server/config/env.ts
    - src/server/triage/service.ts
    - src/server/triage/service.test.ts
    - src/server/repositories/reports.ts
    - src/server/officer/filters.ts
    - src/server/services/officer-dashboard.ts
    - src/components/reports/ReportsTable.tsx
    - src/components/reports/ReportsFilters.tsx
    - src/app/dashboard/reports/[reportId]/page.tsx
    - tests/dashboard-table.test.mjs

key-decisions:
  - "Shadow reads use getAdminClient in officer-dashboard; table remains service_role write-only"
  - "compareShadowTriage never updates reports; candidate failures stored with error metadata"
  - "TRIAGE_SHADOW_MODE compare no-ops when AI_MODEL_CANDIDATE unset"

requirements-completed: [TRIAGE-08]

duration: 6min
completed: 2026-07-22
---

# Phase 10 Plan 02: Shadow Rollout Summary

**Non-mutating shadow dual-run behind TRIAGE_SHADOW_MODE, officer disagreement badge/filter/panel, and eval-gated cutover protocol — SQL migration blocked pending SUPABASE_DB_URL**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-22T00:58:00Z
- **Completed:** 2026-07-22T01:04:00Z
- **Tasks:** 3 (Task 2 checkpoint — DB URL missing)
- **Files modified:** 18

## Accomplishments

- `triage_shadow_comparisons` migration + `10_shadow_eval_contract.sql` assert reports analysis unchanged on shadow insert
- `shadow-service.ts` runs candidate analyze with env overlay; insert-only persistence; swallows candidate failures
- Worker hook after production `completed` + `applyTerminalRouting`; skips failed/manual_review paths
- `TRIAGE_SHADOW_MODE` (default `off`), `AI_MODEL_CANDIDATE`, `AI_BASE_URL_CANDIDATE`, `EVAL_MANIFEST_PATH` in `env.ts`
- Officer table badge (`ShadowMismatchBadge`), filter chip (`shadow_disagreement=true`), detail side-by-side panel
- Cutover protocol: `npm run eval:live && npm run eval:gate` → enable shadow → observe → swap `AI_MODEL` only after gate PASS

## Task Commits

1. **Task 1: Shadow table migration, shadow-service, SQL contract** - `b139c11` (feat)
2. **Task 2: [BLOCKING] Push shadow migration** - CHECKPOINT (SUPABASE_DB_URL missing)
3. **Task 3: Shadow worker hook, env flags, officer UX** - `e25a7f7` (feat)

## Verification Results

| Command | Result |
|---------|--------|
| `npm run test:unit -- src/server/evals/shadow-service.test.ts` | PASS (5 tests) |
| `npm run test:unit -- src/server/triage/service.test.ts` | PASS (7 tests) |
| `npm run test:legacy -- tests/dashboard-table.test.mjs` | PASS (shadow badge + filter gates) |
| `npm run test` | PASS (197 unit + 87 legacy) |
| `node scripts/run-supabase-sql.mjs supabase/migrations/20260722140001_triage_shadow.sql` | BLOCKED — missing `SUPABASE_DB_URL` |
| `node scripts/run-supabase-sql.mjs supabase/tests/10_shadow_eval_contract.sql` | BLOCKED — missing `SUPABASE_DB_URL` |

## Checkpoint: Task 2 (SUPABASE_DB_URL)

**Status:** BLOCKED — awaiting operator action

**What was built:** Migration `20260722140001_triage_shadow.sql` and contract `10_shadow_eval_contract.sql` committed; not applied to live Postgres.

**How to unblock:**

1. Set `SUPABASE_DB_URL` in `.env.local` (see `.env.example` template locally)
2. Ensure Phase 8–9 migrations applied
3. `node scripts/run-supabase-sql.mjs supabase/migrations/20260722140001_triage_shadow.sql`
4. `node scripts/run-supabase-sql.mjs supabase/tests/10_shadow_eval_contract.sql`

Until Task 2 passes, shadow rows will not persist in production DB (unit tests and code paths are ready).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Officer shadow reads via admin client**
- **Found during:** Task 3
- **Issue:** `triage_shadow_comparisons` grants service_role only; user-scoped officer client cannot query shadow table
- **Fix:** `officer-dashboard.ts` uses `getAdminClient()` for shadow flag enrichment and detail comparison behind `requireOfficerSession`
- **Files modified:** `src/server/services/officer-dashboard.ts`
- **Committed in:** `e25a7f7`

**2. [Rule 1 - Bug] Filter unit tests after shadow_disagreement field**
- **Found during:** Task 3 verification (`npm run test`)
- **Issue:** `parseReportFilters` now includes `shadow_disagreement: false` by default
- **Fix:** Updated `reports.test.ts` expectations
- **Committed in:** `e25a7f7`

### Other Notes

- `.env.example` updated locally with shadow env vars but file is gitignored (`.gitignore` `.env*`); operators should add:
  - `TRIAGE_SHADOW_MODE=off`
  - `AI_MODEL_CANDIDATE=`
  - `AI_BASE_URL_CANDIDATE=`
  - `EVAL_MANIFEST_PATH=evals/manifests/phase10-baseline-vs-candidate.json`

## Cutover Protocol (Operator)

1. `npm run eval:live && npm run eval:gate`
2. Set `TRIAGE_SHADOW_MODE=compare` and `AI_MODEL_CANDIDATE` in `.env.local`; restart triage worker
3. Observe shadow disagreement rate via dashboard filter
4. Swap `AI_MODEL` to candidate only after gate PASS + acceptable disagreement rate

## Self-Check: PASSED

- `supabase/migrations/20260722140001_triage_shadow.sql` — FOUND
- `src/server/evals/shadow-service.ts` — FOUND
- `src/components/reports/ShadowMismatchBadge.tsx` — FOUND
- Commits `b139c11`, `e25a7f7` — FOUND

---
*Phase: 10-shadow-rollout-production-evaluation*
*Completed: 2026-07-22*
