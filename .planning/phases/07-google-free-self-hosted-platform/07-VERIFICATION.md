---
status: human_needed
phase: 07-google-free-self-hosted-platform
phase_number: 7
verified: 2026-07-22T01:42:00+07:00
nyquist_compliant: partial
---

# Phase 7 — Verification Report

**Goal:** Next.js-only laptop runtime with self-hosted Supabase and provider-neutral AI; Google Fonts only exception.

**Verdict:** `human_needed` — automated code/runtime checks largely pass; operator gate signatures and live SQL runner env remain open.

## Automated Results (this session)

| Check | Command / artifact | Result | Notes |
|-------|-------------------|--------|-------|
| Unit tests | `npm run test:unit` | **PASS** | 116/116 |
| Legacy contracts | `npm run test:legacy` | **PASS** | 78/78 |
| Production build | `npm run build` | **PASS** | Intermittent worker flake on rapid re-build; clean build succeeds |
| Production smoke | `SMOKE_SKIP_BUILD=1 npm run smoke:production` | **PASS** | `/api/health`, `/api/ready`, `/en` on `127.0.0.1:4310` |
| Tooling decision | `verify-tooling-decision.mjs` | **PASS** | Signed native Supabase; Docker forbidden |
| Vitest approval | `test-approvals/vitest-4.1.10.json` | **PASS** | Signed 4.1.10 |
| Reconciliation live | `reconcile-migration.mjs --require-pass --require-signed` | **PASS** | After post-migration schema fix |
| Post-legacy audit | `audit:google-exit --mode post-legacy-runtime-cleanup` | **PASS** | |
| Post-runtime audit | `audit:google-exit --mode post-runtime-cleanup` | **PASS** | |
| Docs audit | `audit:google-exit --mode docs` | **PASS** | |
| Final audit | `audit:google-exit --mode final --require-all-signed-evidence` | **FAIL** | Unsigned restore/cleanup gates |
| Legacy paths absent | `backend/`, `docker-compose.yml`, `backend.ts` | **PASS** | Removed |
| Live SQL contracts | `run-supabase-sql.mjs` × evidence tests | **BLOCKED** | `SUPABASE_DB_URL` not in `frontend/.env.local` |
| Restore gate | `verify-gate-artifacts --gate restore-and-rollback` | **FAIL** | Unsigned |
| Runtime decision | `operator-runtime-decision.json` | **FAIL** | Unsigned |
| Local cleanup approval | `local-cleanup-approval.json` | **FAIL** | Unsigned |
| Task Scheduler verify | `register-citymind-task.ps1 -Verify` | **NOT RUN** | Requires registered task |

## Schema state

- Migration `20260721130005` appears **applied** (`image_gcs_uri` column absent; reconcile query confirms).
- Dual `DROP FUNCTION` overload fix present in migration file.

## Fixes applied during verification

1. Reconciliation scripts updated for post-migration schema (`evidence_path` only; normalized row hashes).
2. `smoke-production.mjs` supports `SMOKE_SKIP_BUILD=1` to avoid parallel build lock flake.
3. `run-supabase-sql.mjs` error message points to `frontend/.env.local`.

## Acknowledged Gaps

- Operator must sign `restore-and-rollback-gate.json`, `operator-runtime-decision.json`, `local-cleanup-approval.json`.
- Add `SUPABASE_DB_URL` to `frontend/.env.local` to run SQL contract tests from CLI.
- Isolated restore drill + Task Scheduler `-Verify` not executed in this session.
- ESLint reports 2 pre-existing errors (`DateRangeToolbar`, `reports.ts` any) — not Phase 7 regressions.

## Sign-off checklist (07-15-02)

- [x] `npm test` + build + smoke (with skip-build after clean build)
- [x] Post-cleanup google-exit audits
- [ ] Live SQL suite via `run-supabase-sql.mjs`
- [ ] Signed gate artifacts + isolated restore
- [ ] `audit:google-exit --mode final --require-all-signed-evidence`
