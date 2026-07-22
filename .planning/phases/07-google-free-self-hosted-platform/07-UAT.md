---
status: partial
phase: 07-google-free-self-hosted-platform
source: 07-01 through 07-15 SUMMARY.md, 07-VALIDATION.md
started: 2026-07-22T01:36:00+07:00
updated: 2026-07-22T01:42:00+07:00
---

## Current Test

[testing complete — automated pass; operator gates pending]

## Tests

### 1. Cold Start — Next.js production boot
expected: Clean `npm run build` then loopback `npm run smoke:production` serves `/api/health` 200 and `/en` 200 without secret leakage
result: pass
notes: Build can flake on rapid re-entry; `SMOKE_SKIP_BUILD=1` after successful build passes.

### 2. Legacy runtime removed
expected: No `backend/`, `docker-compose.yml`, `frontend/Dockerfile`, or `frontend/src/lib/backend.ts` on disk
result: pass

### 3. Automated test suite
expected: `npm run test:unit` and `npm run test:legacy` all pass
result: pass

### 4. Google-exit post-cleanup audits
expected: `post-legacy-runtime-cleanup`, `post-runtime-cleanup`, and `docs` modes return PASS with zero forbidden findings
result: pass

### 5. Live migration reconciliation
expected: `reconcile-migration.mjs --require-pass --require-signed` succeeds against live Supabase after legacy column drop
result: pass

### 6. Live SQL evidence contracts
expected: `07_remove_legacy_evidence.sql` and `07_evidence_final.sql` pass via `run-supabase-sql.mjs`
result: blocked
blocked_by: third-party
reason: `SUPABASE_DB_URL` missing from `frontend/.env.local` in agent shell (migration appears applied per live query error)

### 7. Signed restore-and-rollback gate
expected: `restore-and-rollback-gate.json` signed PASS with DB+Storage restore hashes and manifest match
result: blocked
blocked_by: prior-phase
reason: Gate file unsigned; isolated restore drill not completed in this session

### 8. Operator runtime decision
expected: `operator-runtime-decision.json` signed with backup/restore commands and loopback bind
result: blocked
blocked_by: prior-phase
reason: Unsigned template

### 9. Local cleanup approval
expected: `local-cleanup-approval.json` signed with explicit cleanup approval and evidence hashes
result: blocked
blocked_by: prior-phase
reason: Unsigned; cleanup already executed in execute-phase

### 10. Final google-exit audit
expected: `audit:google-exit --mode final --require-all-signed-evidence` returns PASS
result: issue
reported: "Fails closed: restore-and-rollback-gate missing signed PASS"
severity: major

### 11. Citizen submit flow (manual)
expected: Open `/en/report`, submit description + optional image, receive access token flash, status lookup works with token
result: pending

### 12. Officer dashboard flow (manual)
expected: Login at `/login`, dashboard loads reports, detail shows evidence when `evidence_path` set, status update works
result: pending

### 13. Officer analytics (manual)
expected: `/dashboard/analytics` loads charts with default 30d range; public stats strip on home when k≥3
result: pending

## Summary

total: 13
passed: 5
issues: 1
pending: 3
skipped: 0
blocked: 4

## Gaps

- truth: "Final google-exit audit passes with all signed safety evidence"
  status: failed
  reason: "Automated run: restore-and-rollback-gate missing signed PASS"
  severity: major
  test: 10
  root_cause: "Operator gate JSON files remain PENDING; isolated restore drill not signed"
  artifacts:
    - path: "frontend/migration-manifests/restore-and-rollback-gate.json"
      issue: "unsigned"
    - path: "frontend/operations/local-cleanup-approval.json"
      issue: "unsigned"
  missing:
    - "Sign restore gate after isolated backup/restore + manifest compare"
    - "Sign operator-runtime-decision.json"
    - "Sign local-cleanup-approval.json"
    - "Re-run audit:google-exit --mode final --require-all-signed-evidence"

- truth: "CLI SQL contract runner can execute post-migration evidence tests"
  status: failed
  reason: "SUPABASE_DB_URL not configured in frontend/.env.local for tooling scripts"
  severity: major
  test: 6
  root_cause: "Env key documented in .env.example but not loaded in operator .env.local; backend/.env removed"
  artifacts:
    - path: "frontend/.env.example"
      issue: "SUPABASE_DB_URL documented"
    - path: "frontend/scripts/run-supabase-sql.mjs"
      issue: "requires SUPABASE_DB_URL"
  missing:
    - "Add SUPABASE_DB_URL to frontend/.env.local"
    - "Run 07_remove_legacy_evidence.sql and 07_evidence_final.sql"
