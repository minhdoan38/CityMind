# Phase 13 — Context (planner-synthesized)

**Synthesized:** 2026-07-22  
**Source:** 13-RESEARCH.md, live codebase verification, Phase 11 CONTEXT supersession  
**Discuss-phase:** Not run — decisions locked from research + implemented code

## Goal

Run evaluator-spec triage **synchronously** on every citizen submit, then show immediate self-help guidance or government-queue messaging on a redesigned success page.

## Locked Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| **D-13-01** | Citizen submit path uses `dispatchTriageAndWait` as **primary** triage dispatch | Success page receives terminal outcome in one POST round-trip |
| **D-13-02** | `SuccessTriagePanel` poll remains **fallback only** when sync returns `pending`/`processing` or dispatch throws | Supersedes Phase 11 **D-02** (poll-primary on success) for happy path |
| **D-13-03** | `enqueueTriageDispatch` runs only on sync triage failure — intake never blocks | Preserves Phase 8 outage contract |
| **D-13-04** | Officer/internal async push dispatch unchanged | Phase 13 scope is citizen hot path only |
| **D-13-05** | Phase 13 is **verification/hardening** — no greenfield rebuild of coach API or evaluator schema | Implementation already in working tree |
| **D-13-06** | TRIAGE-12 citizen intake: sync-primary; push dispatch is failure fallback | Officer path still uses `POST /internal/triage/{report_id}` |

## Superseded (do not re-implement)

| Prior | Superseded by |
|-------|----------------|
| Phase 11 D-02 — poll on success until terminal | D-13-02 — immediate `CitizenTriageOutcome` when sync completes |
| Phase 11 D-09 — push triage on intake (citizen) | D-13-01 — sync wait on intake |
| `ai-logic.md` push-primary intake diagram | Phase 13-03 doc update |

## Deferred Ideas

None — all research items mapped to plans 13-01..13-03.

## Claude's Discretion

- Whether `13_phase13_contract.sql` asserts only `retry` claim eligibility or also sync-intake smoke — optional in 13-02
- Exact legacy contract assertions in `citizen-success-triage.test.mjs` — follow 13-UI-SPEC branches
- Human UAT checklist format — append to `13-VALIDATION.md` in 13-03
