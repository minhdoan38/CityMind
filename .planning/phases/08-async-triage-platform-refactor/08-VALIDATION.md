---
phase: 8
slug: async-triage-platform-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + node:test legacy contracts |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm run test:unit -- src/server/triage` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** `npm run test:unit -- <touched-module>.test.ts`
- **After every plan wave:** `npm run test`
- **Before `/gsd:verify-work`:** Full suite + `node scripts/run-supabase-sql.mjs supabase/tests/08_async_triage_contract.sql`

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01 | 01 | 1 | TRIAGE-01 | T-8-01 | Intake returns token before AI | unit | `npm run test:unit -- src/server/services/report-service.test.ts -t submit` | ❌ W0 | ⬜ pending |
| 08-01 | 01 | 1 | TRIAGE-01 | T-8-02 | `/analyze` returns 410 | legacy | `npm run test:legacy -- tests/report-form.test.mjs` | ❌ W0 | ⬜ pending |
| 08-01 | 01 | 1 | TRIAGE-02 | T-8-03 | Lifecycle transitions | SQL | `node scripts/run-supabase-sql.mjs supabase/tests/08_async_triage_contract.sql` | ❌ W0 | ⬜ pending |
| 08-03 | 03 | 2 | TRIAGE-05 | T-8-04 | Worker claims due rows only | unit | `npm run test:unit -- src/server/triage/claim.test.ts` | ❌ W0 | ⬜ pending |
| 08-04 | 04 | 3 | TRIAGE-06 | T-8-05 | Audit rows per attempt | unit | `npm run test:unit -- src/server/triage/audit.test.ts` | ❌ W0 | ⬜ pending |
| 08-02 | 02 | 2 | TRIAGE-07 | T-8-06 | Policy → manual_review | unit | `npm run test:unit -- src/server/validation/analysis-policy.test.ts` | ✅ | ⬜ pending |
| 08-05 | 05 | 3 | TRIAGE-03 | T-8-07 | Citizen hides AI when pending | unit | `npm run test:unit -- src/server/services/citizen-status.test.ts` | ❌ W0 | ⬜ pending |
| 08-05 | 05 | 3 | TRIAGE-04 | T-8-08 | Officer elevated sort | unit | `npm run test:unit -- src/server/repositories/reports.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/08_*_async_triage.sql` — schema + claim RPCs
- [ ] `supabase/tests/08_async_triage_contract.sql` — claim, reclaim, audit
- [ ] `src/server/triage/*.test.ts` — worker, claim, audit, disposition
- [ ] `src/server/services/report-service.test.ts` — submitReport + 410
- [ ] `tests/report-form.test.mjs` — retarget to `/api/public/reports`
- [ ] `package.json` — `triage:worker` script; `pg` dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-terminal dev flow | TRIAGE-05 | Process orchestration | Run `npm run dev` + `npm run triage:worker`; submit report; observe triage completes |
| Task Scheduler worker | TRIAGE-05 | Windows ops | Register worker via Task Scheduler; reboot; verify triage still runs |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
