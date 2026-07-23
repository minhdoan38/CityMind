---
phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
phase_number: 15
updated: 2026-07-23
---

# Phase 15 — Validation Commands

**Phase:** Citizen conversational support — chat-first intake and Hanoi guidance  
**Updated:** 2026-07-23

Run from repository root. SQL gates require `SUPABASE_DB_URL` (skip locally if unset — document in SUMMARY).

---

## Per-plan gates

### 15-01 — Hanoi classifier + resolver (Wave 1)

```bash
npm run test:unit -- src/server/domain/guidance-resolver.test.ts src/server/validation/hanoi-policy.test.ts
npm run test:unit -- src/server/ai/openai-compatible.test.ts
```

### 15-02 — Chat intake service + API (Wave 2)

```bash
npm run test:unit -- src/server/services/citizen-chat-intake.test.ts
```

### 15-03 — Citizen UX + routing (Wave 3)

```bash
npm run test:legacy -- tests/chat-intake-contract.test.mjs
npm run test:legacy -- tests/citizen-success-triage.test.mjs
```

### 15-04 — Gate, SQL contract, traceability (Wave 3)

```bash
grep "PUB-07" .planning/REQUIREMENTS.md
grep "TRIAGE-15" .planning/REQUIREMENTS.md
grep "SHELP-06" .planning/REQUIREMENTS.md
npm run phase15:gate
```

---

## Phase gate

```bash
npm run phase15:gate
```

**Expected composition:**

1. Unit: `guidance-resolver.test.ts`, `citizen-chat-intake.test.ts`, `hanoi-policy.test.ts`, `openai-compatible.test.ts` (TRIAGE-15 empty-content gating)
2. Legacy: `chat-intake-contract.test.mjs`, `citizen-success-triage.test.mjs` (SHELP-04 escalate CTA + SHELP-05 bilingual/poll regression)
3. SQL: `supabase/tests/15_phase15_contract.sql` (Hanoi columns including `allowed_actions`/`prohibited_actions` + chat_messages FK)

---

## Requirement traceability

| Req ID | Automated | Manual |
|--------|-----------|--------|
| PUB-07 | `chat-intake-contract.test.mjs` (ChatIntakePanel wiring) | UAT-1, UAT-2 |
| SHELP-06 | `guidance-resolver.test.ts`, contract asserts GuidanceScriptCard | UAT-3, UAT-4 |
| TRIAGE-15 | `hanoi-policy.test.ts`, `openai-compatible.test.ts`, SQL contract | UAT-5 |
| TRIAGE-01 (extended) | `citizen-chat-intake.test.ts` start returns id+token | UAT-2 |
| SHELP-04 (regression) | `citizen-success-triage.test.mjs` (escalate CTA on coach + government paths) | UAT-4, UAT-6 |
| SHELP-05 (regression) | `citizen-success-triage.test.mjs` (formAnalyzing, EN/VI parity); `report-form.test.mjs` optional | UAT-6 |
| SHELP-01..03 (regression) | `citizen-success-triage.test.mjs` | UAT-6 |
| CIT-02 (partial) | intake token auth tests | UAT-7 |
| D-15-04 handling routing | `policy.ts` unit tests in hanoi-policy or routing test | UAT-3, UAT-4 |

---

## Human UAT checklist

### UAT-1 — Chat-first report page
Open `/en/report` → `ChatIntakePanel` is primary surface → "Use classic form" link reveals legacy `ReportForm`.

### UAT-2 — Conversational intake to submit
Send intake messages → receive facilitator replies → provide incident description → submit → redirect to success with `report_id` + access token → status link works.

### UAT-3 — Self-guidance script delivery (handling type 1)
Submit low-severity litter scenario → triage completes → success shows pre-approved guidance script (not raw AI JSON) → optional coach available.

### UAT-4 — Government handoff (type 2/3 / generate_later)
Submit high-severity or public-infrastructure scenario → success shows government queue messaging (no coach-first) → escalate CTA present.

### UAT-5 — Hanoi classifier persistence
Officer views report in dashboard → category/severity/handling_type/guidance_code populated → agent console shows Hanoi config_version in triage run metadata.

### UAT-6 — Phase 13 regression
Classic form submit still works → `CitizenTriageOutcome` branches unchanged for form path.

### UAT-7 — Token privacy
Intake/coach message APIs reject wrong token (401) → no cross-report message leakage.

---

## Phase complete checklist

| Check | Command / action |
|-------|------------------|
| Unit tests | `npm run phase15:gate` (unit leg) |
| Legacy contracts | `npm run phase15:gate` (legacy leg) |
| SQL contract | `npm run phase15:gate` (SQL leg, needs `SUPABASE_DB_URL`) |
| Requirements traceable | PUB-07, SHELP-06, TRIAGE-15 marked in REQUIREMENTS.md |
| Human UAT | UAT-1..7 in 15-04-SUMMARY.md |
