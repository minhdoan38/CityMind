---
phase: 7
slug: nextjs-only-google-free-platform
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-21
updated: 2026-07-21
---

# Phase 7 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Existing Node contract tests plus human-approved Vitest 4.1.10 |
| Quick command | `cd frontend && rtk npm run test:unit` |
| Wave command | `cd frontend && rtk npm test && rtk npm run lint` |
| Final command | Plan 07-15 Task 2 exact live SQL, backup/restore, runtime, and audit command below |

## Sampling Contract

- Run the listed command after every task; no three-task verification gap exists.
- Every schema task orders edit → `rtk supabase db push` → exact linked SQL file → downstream tests.
- Inventory, backup, restore, approval, and decision checkpoints use signed machine-verifiable artifacts; unavailable evidence fails.
- After every wave run `cd frontend && rtk npm test && rtk npm run lint`.

## Complete Per-Task Verification Map

| Task ID | Wave | Requirement | Secure behavior | Automated command / fail-closed artifact gate |
|---|---:|---|---|---|
| 07-01-01 | 1 | SELFHOST-01 | Native Supabase CLI/psql versions signed PASS; no alternate or Docker | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker` |
| 07-01-02 | 1 | SELFHOST-01 | Vitest identity/version explicitly approved | `rtk powershell -NoProfile -Command "$a=ConvertFrom-Json (Get-Content -Raw frontend/test-approvals/vitest-4.1.10.json); if($a.package -ne 'vitest' -or $a.version -ne '4.1.10' -or $a.approved -ne $true -or -not $a.signer){exit 1}"` |
| 07-01-03 | 1 | SELFHOST-01 | Sanitized golden contracts | `cd frontend && rtk npm run test:unit -- tests/contracts/golden-contracts.test.ts && rtk npm run test:legacy` |
| 07-02-01 | 2 | SELFHOST-02 | Strict analysis/policy contract | `cd frontend && rtk npm run test:unit -- src/server/domain/report-analysis.test.ts src/server/validation/analysis-policy.test.ts` |
| 07-02-02 | 2 | SELFHOST-02 | SSRF/key/error/output hardening | `cd frontend && rtk npm run test:unit -- src/server/ai/openai-compatible.test.ts && rtk npm run lint` |
| 07-02-03 | 2 | SELFHOST-02 | Live strict-schema/image/lineage/privacy gate | `cd frontend && rtk node scripts/smoke-ai.mjs --require-strict-schema --require-image --require-lineage --require-privacy-approval` |
| 07-03-01 | 3 | SELFHOST-01 | Token binding, uniform 401, separate limiters | `cd frontend && rtk npm run test:unit -- src/server/security/access-tokens.test.ts src/server/security/rate-limit.test.ts src/server/repositories/reports.test.ts` |
| 07-03-02 | 3 | SELFHOST-01 | Citizen-safe Next.js status route | `cd frontend && rtk npm run test:unit -- src/server/repositories/reports.test.ts tests/contracts/golden-contracts.test.ts && rtk npm run test:legacy -- tests/citizen-status.test.mjs` |
| 07-04-01 | 4 | SELFHOST-01/04 | Atomic report/token and private evidence contract | `rtk powershell -NoProfile -Command "$s=Get-Content -Raw supabase/migrations/20260721130001_next_backend_contract.sql; if($s -notmatch 'create_report' -or $s -notmatch 'access_tokens' -or $s -notmatch 'security invoker'){exit 1}"` |
| 07-04-02 | 4 | SELFHOST-01/04 | Native tooling gate plus live RPC privilege/rollback | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker && rtk supabase db push && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_next_backend_contract.sql` |
| 07-04-03 | 4 | SELFHOST-01/02/04 | Synchronous submission parity after live schema | `cd frontend && rtk npm run test:unit -- src/server/services/report-service.test.ts src/server/services/evidence-service.test.ts tests/contracts/golden-contracts.test.ts && rtk npm run lint` |
| 07-05-01 | 5 | SELFHOST-01 | Officer claims + RLS reads | `cd frontend && rtk npm run test:unit -- src/server/repositories/reports.test.ts tests/contracts/golden-contracts.test.ts` |
| 07-05-02 | 5 | SELFHOST-01 | Dashboard direct-module wiring | `cd frontend && rtk npm run test:legacy -- tests/dashboard-map.test.mjs tests/dashboard-geo-params.test.mjs tests/dashboard-loading-list.test.mjs tests/dashboard-loading-detail.test.mjs && rtk npm run lint` |
| 07-07-01 | 5 | SELFHOST-03 | Postgres analytics schema contract | `rtk powershell -NoProfile -Command "$s=Get-Content -Raw supabase/migrations/20260721130002_postgres_analytics.sql; if($s -notmatch 'security invoker' -or $s -notmatch 'k' -or $s -notmatch 'sla'){exit 1}"` |
| 07-07-02 | 5 | SELFHOST-03 | Native tooling gate plus live analytics privileges/parity | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker && rtk supabase db push && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_postgres_analytics.sql` |
| 07-07-03 | 5 | SELFHOST-03 | Analytics UI/API direct Postgres wiring | `cd frontend && rtk npm run test:unit -- src/server/repositories/analytics.test.ts tests/contracts/golden-contracts.test.ts && rtk npm run test:legacy -- tests/analytics-shell.test.mjs && rtk npm run lint` |
| 07-06-01 | 6 | SELFHOST-01 | Atomic status schema and formula-safe export contract | `rtk powershell -NoProfile -Command "$s=Get-Content -Raw supabase/migrations/20260721130003_officer_operations.sql; if($s -notmatch 'security invoker' -or $s -notmatch 'status_events'){exit 1}"` |
| 07-06-02 | 6 | SELFHOST-01 | Native tooling gate plus live officer privilege/atomicity | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker && rtk supabase db push && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_officer_operations.sql && cd frontend && rtk npm run test:unit -- src/server/repositories/reports.test.ts src/server/exports/reports.test.ts && rtk npm run lint` |
| 07-08-01 | 7 | SELFHOST-03/04 | Signed inventory and two-part backup | `rtk powershell -NoProfile -Command "$g=ConvertFrom-Json (Get-Content -Raw frontend/migration-manifests/source-access-and-backup-gate.json); if(-not $g.signed -or $g.status -ne 'PASS' -or -not $g.read_only_inventory -or -not $g.db_backup_hash -or -not $g.storage_backup_hash){exit 1}"` |
| 07-08-02 | 7 | SELFHOST-03/04 | Native tooling; additive-stage evidence contract and reconcile | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker && rtk supabase db push && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_evidence_additive.sql && cd frontend && rtk npm run test:unit -- tests/migration/reconciliation.test.ts tests/migration/evidence-reconciliation.test.ts && rtk node scripts/reconcile-migration.mjs --require-pass --require-signed` |
| 07-09-01 | 8 | SELFHOST-03/04/05 | Native pg_dump/psql recovery wrapper invariants | `rtk supabase --version && rtk psql --version && rtk pg_dump --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --require-native-pg-dump --forbid-docker && rtk powershell -NoProfile -Command "$b=Get-Content -Raw frontend/scripts/backup-citymind.ps1; $r=Get-Content -Raw frontend/scripts/restore-citymind.ps1; if($b -notmatch 'Storage' -or $r -notmatch 'isolated'){exit 1}"` |
| 07-09-02 | 8 | SELFHOST-03/04/05 | Exact DB+Storage restore and app rollback | `rtk powershell -NoProfile -File frontend/scripts/backup-citymind.ps1 -Output frontend/migration-backups/pre-clean && rtk powershell -NoProfile -File frontend/scripts/restore-citymind.ps1 -Input frontend/migration-backups/pre-clean -Target isolated && rtk node frontend/scripts/compare-migration-manifests.mjs --source frontend/migration-manifests/reconciliation.json --target frontend/migration-manifests/restore.json --require-exact && rtk node frontend/scripts/verify-gate-artifacts.mjs --gate restore-and-rollback --require-signed --require-db-restore --require-storage-restore --require-manifest-match --require-application-rollback` |
| 07-10-01 | 9 | SELFHOST-05 | Safe liveness/readiness and loopback smoke | `cd frontend && rtk npm run test:unit -- src/server/health/readiness.test.ts && rtk npm run build && rtk npm run smoke:production` |
| 07-10-02 | 9 | SELFHOST-05 | Signed backup/exposure decision | `rtk node frontend/scripts/verify-gate-artifacts.mjs --file frontend/operations/operator-runtime-decision.json --require-signed --require-backup-command --require-restore-command --require-isolated-target --require-loopback-or-tls-proxy` |
| 07-10-03 | 9 | SELFHOST-05 | Startup/restart plus exact backup/restore proof | `rtk powershell -NoProfile -File frontend/scripts/register-citymind-task.ps1 -Verify && rtk powershell -NoProfile -File frontend/scripts/backup-citymind.ps1 -Output frontend/operations/backup && rtk powershell -NoProfile -File frontend/scripts/restore-citymind.ps1 -Input frontend/operations/backup -Target isolated && rtk node frontend/scripts/compare-migration-manifests.mjs --source frontend/migration-manifests/reconciliation.json --target frontend/migration-manifests/restore.json --require-exact && cd frontend && rtk npm run smoke:production` |
| 07-11-01 | 10 | SELFHOST-06 | Exact allowlist audit | `cd frontend && rtk npm run test:unit -- tests/google-exit-audit.test.ts` |
| 07-11-02 | 10 | SELFHOST-06 | Non-destructive cleanup manifest | `cd frontend && rtk npm run build && rtk npm run audit:google-exit -- --mode pre-clean --write-manifest` |
| 07-11-03 | 10 | SELFHOST-01..06 | Explicit signed local cleanup approval | `rtk node frontend/scripts/verify-gate-artifacts.mjs --file frontend/operations/local-cleanup-approval.json --require-signed --require-inventory --require-reconciliation --require-db-restore --require-storage-restore --require-application-rollback --require-explicit-local-cleanup-approval` |
| 07-12-01 | 11 | SELFHOST-04/06 | Native tooling, destructive assertions, durable final evidence contract | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker && rtk powershell -NoProfile -Command "$s=Get-Content -Raw supabase/migrations/20260721130005_remove_legacy_evidence.sql; $f=Get-Content -Raw supabase/tests/07_evidence_final.sql; if($s -notmatch 'image_gcs_uri' -or $s -notmatch 'evidence_path' -or $s -notmatch 'raise exception' -or $f -notmatch 'evidence_path' -or $f -match 'select.+image_gcs_uri'){exit 1}"` |
| 07-12-02 | 11 | SELFHOST-04/06 | Approval-gated removal then durable evidence/RLS proof | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker && rtk supabase db push && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_remove_legacy_evidence.sql && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_evidence_final.sql && rtk node frontend/scripts/verify-gate-artifacts.mjs --gate restore-and-rollback --require-signed --require-pass` |
| 07-13-01 | 12 | SELFHOST-01..06 | Approved legacy runtime/deployment cleanup | `cd frontend && rtk npm test && rtk npm run audit:google-exit -- --mode post-legacy-runtime-cleanup` |
| 07-14-01 | 13 | SELFHOST-01/02/05/06 | Frontend compatibility cleanup regression | `cd frontend && rtk npm ci && rtk npm test && rtk npm run lint && rtk npm run build && rtk npm run smoke:production && rtk npm run audit:google-exit -- --mode post-runtime-cleanup` |
| 07-15-01 | 14 | SELFHOST-05/06 | Active docs match target | `cd frontend && rtk npm run audit:google-exit -- --mode docs` |
| 07-15-02 | 14 | SELFHOST-01..06 | Final native-tooling, durable SQL, recovery, runtime, and audit gate | `rtk supabase --version && rtk psql --version && rtk node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-signed --require-native-supabase --supabase-range 2.48.3:3.0.0 --require-native-psql --psql-range 15:18 --forbid-docker && rtk supabase db push && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_next_backend_contract.sql && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_postgres_analytics.sql && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_officer_operations.sql && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_remove_legacy_evidence.sql && rtk psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/tests/07_evidence_final.sql && rtk powershell -NoProfile -File frontend/scripts/backup-citymind.ps1 -Output frontend/operations/final-backup && rtk powershell -NoProfile -File frontend/scripts/restore-citymind.ps1 -Input frontend/operations/final-backup -Target isolated && rtk node frontend/scripts/compare-migration-manifests.mjs --source frontend/migration-manifests/reconciliation.json --target frontend/migration-manifests/restore.json --require-exact && rtk node frontend/scripts/verify-gate-artifacts.mjs --gate restore-and-rollback --require-signed --require-db-restore --require-storage-restore --require-manifest-match --require-application-rollback && rtk node frontend/scripts/verify-gate-artifacts.mjs --file frontend/operations/local-cleanup-approval.json --require-signed --require-explicit-local-cleanup-approval && rtk powershell -NoProfile -File frontend/scripts/register-citymind-task.ps1 -Verify && cd frontend && rtk npm ci && rtk npm test && rtk npm run lint && rtk npm run build && rtk npm run smoke:production && rtk npm run audit:google-exit -- --mode final --require-all-signed-evidence` |

## Wave 0 Requirements

- [ ] Signed native Supabase CLI/psql installation decision and accepted version probes exist before schema work; refusal or absence fails closed and Docker is forbidden.
- [ ] Signed Vitest 4.1.10 approval exists before install.
- [ ] `frontend/vitest.config.mts`, unit/legacy scripts, and sanitized golden contracts are executable.
- [ ] Server behavior tests cover schemas, AI, tokens, rate limits, repositories, evidence, exports, analytics, migration, health, and audit.
- [ ] SQL tests cover anonymous/non-officer denial, officer/admin access, token privacy, atomic rollback, analytics parity, migration-stage additive evidence, destructive-drop gate, and durable post-cutover evidence/RLS behavior.
- [ ] Production, AI, reconciliation, gate-verification, backup/restore, manifest-compare, and Google-exit scripts exist before their consuming tasks.

## Manual External Gates with Automated Evidence

| Gate | Fail-closed evidence |
|---|---|
| Windows schema tooling | Signed native executable paths/version probes through approved non-Docker installs; no alternate branch |
| Vitest legitimacy | Signed exact package/version approval JSON |
| AI capability/privacy | Synthetic smoke requires schema, image, lineage, privacy flags |
| Google inventory | Signed read-only inventory plus DB and Storage backup hashes |
| Restore/application rollback | Signed isolated restore manifest match and Python-capable rollback PASS |
| Backup/exposure | Signed exact commands and loopback-or-approved-TLS decision |
| Local destructive cleanup | Explicit signed approval referencing all prior evidence hashes |

## Sign-Off

- [x] Every final task has an automated command or signed fail-closed artifact command.
- [x] No three consecutive tasks lack automated sampling.
- [x] Schema tasks enforce edit → push → live SQL → downstream verification.
- [x] High-severity inventory, restore, auth/RLS, evidence, upload, SSRF, export, leakage, exposure, and deletion threats have explicit gates.
- [x] No watch-mode commands.
- [x] `nyquist_compliant: true` reflects complete planning coverage; `wave_0_complete` remains false until execution.
