---
phase: 13-immediate-citizen-triage-on-submit-with-evaluator-prompt-and
phase_number: 13
updated: 2026-07-22
---

# Phase 13 — Validation Commands

**Phase:** 13-immediate-citizen-triage-on-submit-with-evaluator-prompt-and  
**Updated:** 2026-07-22

Run from repository root (`CityMind/`). SQL gates require `SUPABASE_DB_URL`. Live AI optional for automated gates — mock provider in unit tests.

---

## Per-plan gates

### 13-01 — UI-SPEC + contract tests (Wave 1)

```bash
npm run test:legacy -- tests/citizen-success-triage.test.mjs tests/report-form.test.mjs
test -f .planning/phases/13-immediate-citizen-triage-on-submit-with-evaluator-prompt-and/13-UI-SPEC.md
```

### 13-02 — Service hardening + phase gate (Wave 2)

```bash
npm run test:unit -- src/server/triage/dispatch.test.ts src/server/services/report-service.test.ts
node scripts/run-supabase-sql.mjs -f supabase/tests/13_phase13_contract.sql
npm run phase13:gate
```

### 13-03 — Docs + traceability (Wave 3)

```bash
grep -E "dispatchTriageAndWait|synchronous|sync" .planning/codebase/ai-logic.md
grep "SHELP-01" .planning/REQUIREMENTS.md
grep "Phase 13" .planning/ROADMAP.md
```

---

## Phase gate

```bash
npm run phase13:gate
```

**Expected composition (after 13-02):**

1. Unit: `report-service.test.ts` (submit sync outcome, government path, async fallback)
2. Unit: `dispatch.test.ts` (`dispatchTriageAndWait` wait/force)
3. Legacy: `citizen-success-triage.test.mjs`, `report-form.test.mjs`
4. SQL: `supabase/tests/13_phase13_contract.sql` (skip if `SUPABASE_DB_URL` unset — document in SUMMARY)

Full regression (optional pre-release):

```bash
npm run test
npm run phase11:gate
npm run phase12:gate
```

---

## Requirement traceability

| Req ID | Automated | Manual |
|--------|-----------|--------|
| SHELP-01 | `citizen-success-triage.test.mjs` (CoachPanel vs government Alert) | Submit self_help + government scenarios |
| SHELP-02 | Phase 11 `citizen-coach.test.ts` (consumed) | Coach send on success page |
| SHELP-03 | Phase 11 `coach.test.ts` (consumed) | — |
| SHELP-04 | `citizen-success-triage.test.mjs` (escalate CTA presence) | Escalate flow |
| SHELP-05 | `report-form.test.mjs` EN/VI parity; `formAnalyzing` assertion | EN/VI visual review |
| TRIAGE-12 (citizen) | `report-service.test.ts` sync + fallback | — |
| TRIAGE-12 (officer) | Phase 11 internal dispatch tests | — |
| TRIAGE-13 | `citizen-status-contract.test.mjs` + success branching tests | Calm copy review |
| PUB-04 | `report-form.test.mjs` flash fields | Copy ID/token on success |
| PUB-06 | UI-SPEC a11y checklist | Keyboard + mobile check |
| CIT-02 | `citizen-status.test.ts` | — |

---

## Human UAT checklist (13-03)

Execute with `npm run dev` and configured AI provider.

### UAT-1 — Self-help immediate path

1. Open `/en/report` — submit low-severity waste/pothole description.
2. Submit button shows "Reviewing your report…" during POST.
3. Success page shows `CitizenTriageOutcome` immediately (no poll spinner).
4. Path badge "Try these steps first"; `CoachPanel` visible.
5. Send coach message — receive advisory reply.
6. Escalate CTA present.

**Pass:** Immediate outcome + coach without 120s poll.

### UAT-2 — Government immediate path

1. Submit high-severity or government-routing description.
2. Success shows government queue messaging — **no** coach-first.
3. Status link works with flashed token.

**Pass:** Government branch per SHELP-01.

### UAT-3 — Degraded sync fallback

1. Temporarily misconfigure AI key or mock outage.
2. Submit report — intake still succeeds (report ID + token).
3. Success shows `SuccessTriagePanel` polling OR calm unavailable after terminal failed state.

**Pass:** Intake never blocked; no provider error leakage.

### UAT-4 — Bilingual

1. Switch locale VI on report + success flows.
2. Verify `formAnalyzing`, `successOutcome`, coach copy render Vietnamese.

**Pass:** EN/VI parity per SHELP-05.

---

## Nyquist sampling

| Event | Command |
|-------|---------|
| Per task commit | Targeted test from plan `<verify>` |
| Wave merge | Per-plan gate above |
| Phase complete | `npm run phase13:gate` + UAT checklist |
