---
phase: 10-shadow-rollout-production-evaluation
verified: 2026-07-22
status: passed
---

# Phase 10 Verification

## Goal (from ROADMAP)

Shadow-deploy the provider-neutral triage pipeline, evaluate against baseline, and gate production cutover on under-triage, grounding, EN/VI parity, failure rate, and model-lineage reproducibility.

## Automated Gates

| Gate | Command | Result |
|------|---------|--------|
| Eval unit tests | `npm run test:unit -- src/server/evals` | ✅ green |
| Mock eval pipeline | `npm run eval:mock && npm run eval:gate` | ✅ PASS (56 cases) |
| Shadow service | `shadow-service.test.ts` | ✅ 5/5 |
| Triage worker hook | `triage/service.test.ts` | ✅ 7/7 |
| Full suite | `npm run test` | ✅ 197 unit + 87 legacy |
| Shadow SQL contract | `supabase/tests/10_shadow_eval_contract.sql` | ✅ passed (Supabase SQL Editor, 2026-07-22) |
| Phase 9 routing SQL | `09_routing_contract.sql` | ✅ passed |

## Must-Haves (goal-backward)

| Truth | Evidence | Status |
|-------|----------|--------|
| Offline eval suite with EN/VI gold labels | `evals/`, `src/server/evals/*` | ✅ |
| Threshold gate before cutover | `verify-eval-gate.mjs`, `npm run eval:gate` | ✅ |
| Shadow dual-run without mutating production | `shadow-service.ts`, worker hook | ✅ |
| Officer disagreement visibility | `ShadowMismatchBadge`, filter, detail panel | ✅ |
| Intake survives provider outage | `report-service.test.ts` | ✅ |
| TRIAGE-08 | Plans 10-01 + 10-02 | ✅ |

## Pre-cutover operator steps (not blocking verification)

1. `npm run eval:live` with live AI credentials + privacy approval
2. `TRIAGE_SHADOW_MODE=compare`, `AI_MODEL_CANDIDATE`, restart triage worker
3. Observe disagreement rate; swap `AI_MODEL` only after `eval:gate` PASS on live results

## Verdict

**Passed** — code, mock eval gate, and SQL contracts green. Live eval + shadow observation remain pre-production cutover steps.
