---
phase: 10
slug: shadow-rollout-production-evaluation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Maps TRIAGE-08 behaviors to automated Nyquist gates.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + node:test legacy |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm run test:unit -- src/server/evals/metrics.test.ts` |
| **Eval mock pipeline** | `npm run eval:mock && npm run eval:gate` |
| **Full suite command** | `npm run test` |
| **SQL contract** | `node scripts/run-supabase-sql.mjs supabase/tests/10_shadow_eval_contract.sql` |
| **Estimated runtime** | ~45 seconds (unit + legacy); eval:mock ~10s |

---

## Sampling Rate

- **After every task commit:** Run task-scoped `<automated>` verify from PLAN.md
- **After Plan 10-01 complete:** `npm run eval:mock && npm run eval:gate && npm run test:unit -- src/server/evals`
- **After Plan 10-02 Task 2:** SQL contract green (requires `SUPABASE_DB_URL`)
- **After Plan 10-02 complete:** `npm run test` + SQL contract
- **Before `/gsd-verify-work`:** Full suite + eval:mock + eval:gate + operator eval:live (manual)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | TRIAGE-08 | T-10-01 | Metrics pure; gold is_critical drives under-triage | unit | `npm run test:unit -- src/server/evals/metrics.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-01b | 01 | 1 | TRIAGE-08 | — | Dataset loader Zod validation | unit | `npm run test:unit -- src/server/evals/load-dataset.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-01c | 01 | 1 | TRIAGE-08 | — | shadow-compare diff booleans | unit | `npm run test:unit -- src/server/evals/shadow-compare.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | TRIAGE-08 | T-10-03 | Aggregate thresholds all-pass logic | unit | `npm run test:unit -- src/server/evals/aggregate.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02b | 01 | 1 | TRIAGE-08 | — | Mock eval CLI end-to-end | integration | `node scripts/eval-suite.mjs --mock` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | TRIAGE-08 | T-10-02 | Outage intake survives provider down | unit | `npm run test:unit -- src/server/services/report-service.test.ts` | ✅ extend | ⬜ pending |
| 10-01-03b | 01 | 1 | TRIAGE-08 | T-10-03 | Gate script exit codes | integration | `npm run eval:mock && npm run eval:gate` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | TRIAGE-08 | T-10-05 | Shadow insert does not mutate reports | unit | `npm run test:unit -- src/server/evals/shadow-service.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | TRIAGE-08 | T-10-05 | Shadow table invariants | SQL | `node scripts/run-supabase-sql.mjs supabase/tests/10_shadow_eval_contract.sql` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 2 | TRIAGE-08 | T-10-05 | Worker shadow hook non-mutating | unit | `npm run test:unit -- src/server/triage/service.test.ts` | ✅ extend | ⬜ pending |
| 10-02-03b | 02 | 2 | TRIAGE-08 | T-10-06 | Officer shadow badge in table | legacy | `npm run test:legacy -- tests/dashboard-table.test.mjs` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/server/evals/types.ts`, `load-dataset.ts`, `metrics.ts`, `aggregate.ts`, `shadow-compare.ts` + Vitest tests
- [ ] `evals/datasets/urban-incidents-v1.jsonl` (50 EN/VI cases)
- [ ] `evals/datasets/injection-adversarial.jsonl`
- [ ] `evals/manifests/phase10-baseline-vs-candidate.json`
- [ ] `scripts/eval-suite.mjs`, `scripts/verify-eval-gate.mjs`
- [ ] `supabase/migrations/20260722140001_triage_shadow.sql`
- [ ] `supabase/tests/10_shadow_eval_contract.sql`
- [ ] `src/server/evals/shadow-service.ts` + tests
- [ ] Extend `src/server/triage/service.test.ts`, `report-service.test.ts`, `tests/dashboard-table.test.mjs`
- [ ] `package.json` scripts: `eval:mock`, `eval:live`, `eval:gate`

---

## Requirement → Behavior Coverage (TRIAGE-08)

| TRIAGE-08 dimension | Automated coverage | Manual fallback |
|---------------------|-------------------|-----------------|
| Under-triage | metrics.test.ts isUnderTriage + gate missed_critical_count | — |
| Grounding | validateAnalysisPolicy in metrics + injection suite | — |
| EN/VI parity | localeParityDelta in aggregate + gate | — |
| Failure rate | eval results failure_rate vs baseline in verify-eval-gate | — |
| Shadow rollout gate | eval:gate + shadow SQL contract + service.test.ts | Operator eval:live |
| Model lineage reproducibility | manifest pins model/prompt/routing versions in results JSON | Manifest human review |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live 50×5 eval | TRIAGE-08 | Cost + API key; not CI | Run `npm run eval:live` with privacy approval; then `npm run eval:gate` |
| Shadow observation window | TRIAGE-08 | Needs live worker + traffic | Set TRIAGE_SHADOW_MODE=compare; run triage:worker; submit reports; check dashboard filter |
| Production AI_MODEL cutover | TRIAGE-08 | Operator env change | After eval:gate PASS + shadow review, swap AI_MODEL; restart worker |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies listed
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references in task map
- [ ] eval:live excluded from CI and npm test
- [ ] Feedback latency < 60s for unit/legacy gates
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 complete

**Approval:** pending
