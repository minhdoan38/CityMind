---
phase: 14-officer-agent-console-per-case-triage-run-and-attempt-log-vi
phase_number: 14
updated: 2026-07-22
---

# Phase 14 — Validation Commands

**Phase:** Officer agent console — per-case triage run and attempt log viewer  
**Updated:** 2026-07-22

Run from repository root. SQL gates require `SUPABASE_DB_URL` (skip locally if unset — document in SUMMARY).

---

## Per-plan gates

### 14-01 — Gates, tests, SQL contract (Wave 1)

```bash
npm run test:unit -- src/server/repositories/triage-console.test.ts src/server/services/officer-triage-console.test.ts
npm run test:legacy -- tests/agent-console-contract.test.mjs
node scripts/run-supabase-sql.mjs -f supabase/tests/14_phase14_contract.sql
```

### 14-02 — UI-SPEC polish (Wave 2)

```bash
test -f .planning/phases/14-officer-agent-console-per-case-triage-run-and-attempt-log-vi/14-UI-SPEC.md
npm run test:legacy -- tests/agent-console-contract.test.mjs
```

### 14-03 — Docs, traceability, UAT prep (Wave 3)

```bash
grep "DASH-11" .planning/REQUIREMENTS.md
grep "Phase 14" .planning/ROADMAP.md
npm run phase14:gate
```

---

## Phase gate

```bash
npm run phase14:gate
```

**Expected composition:**

1. Unit: `triage-console.test.ts`, `officer-triage-console.test.ts`
2. Legacy: `agent-console-contract.test.mjs`
3. SQL: `supabase/tests/14_phase14_contract.sql` (privilege deny on audit tables)

---

## Requirement traceability

| Req ID | Automated | Manual |
|--------|-----------|--------|
| DASH-11 | `agent-console-contract.test.mjs`, vitest service/repo tests | UAT-1..5 |
| TRIAGE-06 (viewer) | SQL privilege contract; repo grouping test | UAT-2 raw log |
| AUTH-03 (partial) | `officer-triage-console.test.ts` 401 | UAT-6 |
| AUTH-04 (partial) | `proxy.ts` dashboard gate (consumed) | UAT-6 redirect |
| DASH-07 (partial) | contract empty/loading strings | UAT-1 empty state |

---

## Human UAT checklist (14-03)

### UAT-1 — Recent feed landing
Open `/dashboard/agent-console` unfiltered → cases list populates → select case → runs and attempts visible.

### UAT-2 — Raw log inspection
Select attempt with validation_errors → warn block appears before raw output → expand truncated output shows full JSON.

### UAT-3 — Truncation notice
Unfiltered console shows notice that results are limited to the latest 50 runs (D-14-15).

### UAT-4 — Deep link
From report detail "View agent console log" → console opens filtered to that `report_id`.

### UAT-5 — Bilingual
Switch dashboard locale to VI → `dashboard.agentConsole` strings render Vietnamese.

### UAT-6 — Auth boundary
Logged-out visit to `/dashboard/agent-console` redirects to login with returnUrl.

**Phase complete:** `npm run phase14:gate` + UAT-1..6 approved.
