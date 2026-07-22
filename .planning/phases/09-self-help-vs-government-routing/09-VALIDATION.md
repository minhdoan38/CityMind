---
phase: 9
slug: self-help-vs-government-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + node:test legacy |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm run test:unit -- src/server/routing/policy.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -- src/server/routing/policy.test.ts` (or task-scoped path)
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite + `09_routing_contract.sql` green (requires `SUPABASE_DB_URL`)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | D-17,D-18 | T-09-01 | Routing policy deterministic; version stored | unit | `npm run test:unit -- src/server/routing/policy.test.ts` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | D-18 | — | Schema columns + constraints | SQL | `node scripts/run-supabase-sql.mjs supabase/tests/09_routing_contract.sql` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | D-20,D-21..D-24 | T-09-02 | Worker applies routing on terminal triage | unit | `npm run test:unit -- src/server/triage/service.test.ts` | ❌ extend | ⬜ pending |
| 09-03-01 | 03 | 2 | D-05..D-12 | T-09-03 | Escalate 401 uniform; token binding | unit | `npm run test:unit -- src/server/services/citizen-status.test.ts` | ❌ extend | ⬜ pending |
| 09-04-01 | 04 | 3 | D-13..D-16 | T-09-04 | Default filter excludes self_help | unit | `npm run test:unit -- src/server/repositories/reports.test.ts` | ❌ extend | ⬜ pending |
| 09-04-02 | 04 | 3 | D-09,D-10,D-11 | — | Status page playbook + escalate CTA | legacy | `npm run test:legacy -- tests/citizen-status.test.mjs` | ❌ extend | ⬜ pending |
| 09-04-03 | 04 | 3 | D-15 | — | Destination badge in table | legacy | `npm run test:legacy -- tests/dashboard-table.test.mjs` | ❌ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/server/routing/policy.ts` + `policy.test.ts` — D-21..D-24 matrix
- [ ] `supabase/migrations/20260722130001_routing_columns.sql`
- [ ] `supabase/tests/09_routing_contract.sql`
- [ ] Extend `src/server/triage/service.test.ts`
- [ ] Extend `src/server/services/citizen-status.test.ts`
- [ ] Extend `src/server/repositories/reports.test.ts`
- [ ] Extend `tests/citizen-status.test.mjs`, `tests/dashboard-table.test.mjs`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live escalate flow | D-11 | Needs DB + triage complete row | Submit report, wait for triage, open status, click escalate, confirm officer queue |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
