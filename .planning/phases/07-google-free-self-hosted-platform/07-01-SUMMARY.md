---
phase: 07-google-free-self-hosted-platform
plan: "01"
subsystem: testing
tags: [vitest, supabase-cli, psql, contract-tests, golden-fixtures]

requires: []
provides:
  - Signed native Windows tooling decision (Supabase CLI 2.109.1, PostgreSQL 17 clients)
  - Human-approved vitest@4.1.10 install gate
  - Sanitized FastAPI golden contract fixtures and executable Vitest parity harness
  - npm test:unit / test:legacy / test scripts
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-12, 07-15]

tech-stack:
  added: [vitest@4.1.10, scoop, supabase-cli, postgresql-17-client]
  patterns:
    - Golden JSON fixtures under tests/contracts/fastapi-golden/
    - Fail-closed tooling verification via verify-tooling-decision.mjs
    - Package approval artifacts under test-approvals/

key-files:
  created:
    - frontend/operations/tooling-decision.json
    - frontend/scripts/verify-tooling-decision.mjs
    - frontend/test-approvals/vitest-4.1.10.json
    - frontend/vitest.config.mts
    - frontend/tests/contracts/fastapi-golden/analyze.json
    - frontend/tests/contracts/fastapi-golden/citizen-status.json
    - frontend/tests/contracts/fastapi-golden/officer-reports.json
    - frontend/tests/contracts/fastapi-golden/analytics.json
    - frontend/tests/contracts/golden-contracts.test.ts
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/tests/dashboard-loading-list.test.mjs
    - frontend/tests/officer-auth.test.mjs
    - frontend/tests/report-form.test.mjs

key-decisions:
  - "Native Supabase CLI via Scoop and PostgreSQL 17 via winget — no Docker/npx wrappers"
  - "vitest@4.1.10 approved after slopcheck SUS review"

patterns-established:
  - "Contract fixtures are sanitized JSON with explicit endpoint coverage or deferredToLaterSlices references"
  - "Tooling gate records executable paths, SHA-256 hashes, and live version probes"

requirements-completed: [SELFHOST-01]

duration: 45min
completed: 2026-07-21
---

# Phase 7 Plan 01 Summary

**Wave 0 parity harness: native schema tooling gate, Vitest runner, and sanitized FastAPI golden contracts runnable without Python**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-21T19:51:00+07:00
- **Completed:** 2026-07-21T21:34:00+07:00
- **Tasks:** 3/3
- **Files modified:** 12

## Accomplishments

- Installed Scoop and Supabase CLI 2.109.1 with signed tooling decision
- Operator later removed standalone PostgreSQL in favor of remote self-hosted Supabase via project env keys
- Operator-approved vitest@4.1.10 recorded; Vitest configured for non-watch Node tests
- Captured sanitized golden fixtures for analyze, citizen status, officer reports, and analytics endpoints
- `golden-contracts.test.ts` validates structure, endpoint coverage, and secret/PII scan

## Task Commits

Changes are uncommitted pending operator request.

1. **Task 1: Windows schema-tooling gate** — operator approved; tooling decision + verifier created
2. **Task 2: Vitest package approval** — vitest-4.1.10.json signed
3. **Task 3: Test runner + golden contracts** — fixtures, Vitest config, npm scripts

## Files Created/Modified

- `frontend/operations/tooling-decision.json` — signed PASS decision for native CLI tools
- `frontend/scripts/verify-tooling-decision.mjs` — fail-closed version/hash probe verifier
- `frontend/tests/contracts/fastapi-golden/*.json` — sanitized legacy API behavior fixtures
- `frontend/tests/contracts/golden-contracts.test.ts` — executable contract guard
- `frontend/vitest.config.mts` — Node environment Vitest config

## Decisions Made

- Followed approved non-Docker install routes (Scoop + winget) per 07-RESEARCH.md
- Deferred `GET /health`, `GET /api/v1/reports/geo/pins`, and `GET /api/v1/public/stats` to later slices with explicit references

## Deviations from Plan

### Auto-fixed Issues

**1. Legacy `.mjs` contract tests drifted from current dashboard UI**
- **Found during:** Task 3 verification (`npm run test:legacy`)
- **Issue:** Three source-string tests expected old ReportCard/loading/copy strings
- **Fix:** Updated assertions to match ReportsTable, surface-card skeleton, and current status link copy
- **Files modified:** `frontend/tests/dashboard-loading-list.test.mjs`, `frontend/tests/officer-auth.test.mjs`, `frontend/tests/report-form.test.mjs`
- **Verification:** `npm run test:legacy` — 77/77 pass

**2. Golden test fixture path resolution**
- **Found during:** Task 3 verification (`npm run test:unit`)
- **Issue:** `import.meta.dirname` resolved one level short of frontend root
- **Fix:** Adjusted ROOT to `../..` from `tests/contracts/`
- **Verification:** `npm run test:unit -- tests/contracts/golden-contracts.test.ts` — 6/6 pass

---

**Total deviations:** 2 auto-fixed (blocking verification)
**Impact on plan:** Required for plan verify gate; no scope creep.

## Issues Encountered

- Standalone PostgreSQL may require admin uninstall on Windows (`winget uninstall PostgreSQL.PostgreSQL.17`); project tooling no longer depends on it
- Add `SUPABASE_DB_URL` to `backend/.env` for migration/SQL gates (see `backend/.env.example`); REST keys alone are not a Postgres connection string

## User Setup Required

None beyond ensuring PATH includes the installed native tools in future terminals.

## Next Phase Readiness

- Wave 2 (07-02 OpenAI-compatible AI adapter) can proceed
- Golden fixtures provide baseline for all subsequent port slices

---
*Phase: 07-google-free-self-hosted-platform*
*Completed: 2026-07-21*
