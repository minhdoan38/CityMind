---
phase: 7
slug: nextjs-only-google-free-platform
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Existing Node `.mjs` contract tests plus Vitest 4.x after human package verification |
| **Config file** | `frontend/vitest.config.mts` — Wave 0 installs/configures |
| **Quick run command** | `cd frontend && npm run test:unit -- --run` |
| **Full suite command** | `cd frontend && npm test && npm run lint && npm run build` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted Vitest file plus any affected existing `.mjs` contract test.
- **After every plan wave:** Run `cd frontend && npm test && npm run lint`.
- **Before `$gsd-verify-work`:** Run a clean `npm ci`, the full suite, production build/start smoke, live data reconciliation, backup/restore drill, and Google-exit audit.
- **Max feedback latency:** 180 seconds for automated checks; live migration/provider/restore checkpoints are separately gated.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SELFHOST-01 | T-07-01 / T-07-02 | Service-role secrets remain server-only; officer routes require valid role claims | unit + contract | `cd frontend && npm run test:unit -- tests/contracts tests/server` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | SELFHOST-02 | T-07-03 / T-07-04 | Provider URL is environment-only, output is schema-validated, errors and keys are redacted | unit + mocked contract | `cd frontend && npm run test:unit -- tests/server/ai` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | SELFHOST-03 | T-07-05 | Migration is non-destructive until inventory, reconciliation, backup, and rollback gates pass | SQL + migration | `cd frontend && npm run test:unit -- tests/migration/postgres-analytics.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | SELFHOST-04 | T-07-05 / T-07-06 | Evidence remains private and every migrated object is reconciled by size and SHA-256 | unit + integration | `cd frontend && npm run test:unit -- tests/server/evidence tests/migration/evidence` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 3 | SELFHOST-05 | T-07-07 | Runtime binds loopback unless an approved TLS proxy exists; secrets are not exposed | production smoke | `cd frontend && npm run build && npm run smoke:production` | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 4 | SELFHOST-06 | T-07-01 / T-07-08 | Forbidden Google/FastAPI/Python/Docker artifacts are absent with only the Google Fonts allowlist | static + build + runtime audit | `cd frontend && npm run audit:google-exit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Human-verify the official `vitest` package identity/version before installation; record approval in the execution summary.
- [ ] `frontend/vitest.config.mts` and `test:unit` script — executable TypeScript unit tests.
- [ ] `frontend/tests/contracts/fastapi-golden/` — sanitized legacy request/response/status/header fixtures captured before backend removal.
- [ ] `frontend/src/server/domain/report-analysis.test.ts` — Pydantic-to-Zod parity and JSON Schema snapshot.
- [ ] `frontend/src/server/ai/openai-compatible.test.ts` — timeout, invalid JSON/schema, refusal/error, image, redaction, and lineage cases.
- [ ] `frontend/src/server/repositories/*.test.ts` — RLS client selection, filters/cursors, token privacy, and status atomicity.
- [ ] `frontend/tests/migration/reconciliation.test.ts` — canonical hashing, conflicts, counts, and object reconciliation.
- [ ] `frontend/scripts/smoke-production.mjs` and `frontend/scripts/google-exit-audit.mjs`.
- [ ] Supabase SQL tests for transactional RPCs, analytics parity, RLS, and legacy-column cutover.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BigQuery/GCS retained-data inventory and signed reconciliation | SELFHOST-03, SELFHOST-04 | Google ADC/CLI is unavailable in the current environment | Obtain read-only credentials; export source inventories; compare primary keys, timestamps, null distributions, canonical row hashes, aggregate totals, object sizes/MIME/SHA-256; sign the manifest before deletion |
| Configured AI endpoint capability and privacy smoke | SELFHOST-02 | Depends on the selected external endpoint and real credentials | Run authenticated text and image fixtures; verify strict schema behavior, actual model lineage, timeout/error mapping, and provider retention/privacy terms |
| Windows startup and restart behavior | SELFHOST-05 | Requires the target laptop and Windows Task Scheduler | Register the task, reboot/log on, confirm loopback bind and readiness, terminate the process, and verify automatic restart without secret leakage |
| Database and Storage restore drill | SELFHOST-03, SELFHOST-04, SELFHOST-05 | Requires access to the existing self-hosted Supabase backup system | Restore a database dump and Storage backup into an isolated target; compare manifests and execute representative citizen/officer reads |
| Network exposure/TLS boundary | SELFHOST-05 | Public exposure intent and reverse-proxy ownership are not yet approved | Keep loopback-only by default; if public access is required, document the approved TLS reverse proxy and verify direct HTTP is unreachable externally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s for automated checks
- [ ] All high-severity threats have explicit mitigations and tests
- [ ] Live BigQuery/GCS inventory and reconciliation are complete before Google deletion
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
