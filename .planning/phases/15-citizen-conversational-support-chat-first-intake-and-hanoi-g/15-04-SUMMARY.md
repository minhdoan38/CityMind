---
phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
plan: "04"
subsystem: testing
tags: [gate, contract-tests, sql, hanoi, intake, phase15]

requires:
  - phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
    plan: "01"
    provides: Hanoi v5.2 classifier + guidance resolver unit tests
  - phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
    plan: "02"
    provides: citizen-chat-intake service tests
  - phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
    plan: "03"
    provides: ChatIntakePanel + GuidanceScriptCard UI wiring
provides:
  - phase15:gate composite npm script (unit + legacy + SQL)
  - chat-intake-contract.test.mjs static wiring regression
  - 15_phase15_contract.sql Hanoi column + chat_messages FK assertions
affects:
  - Phase 15 completion (pending human UAT-1..7)

tech-stack:
  added: []
  patterns:
    - "phase15:gate mirrors phase13/14 gate composition (vitest + legacy + SQL)"
    - "chat-intake-contract excludes officer/agent-console scope"

key-files:
  created:
    - tests/chat-intake-contract.test.mjs
    - supabase/tests/15_phase15_contract.sql
  modified:
    - package.json

key-decisions:
  - "REQUIREMENTS.md and ROADMAP.md already trace PUB-07, SHELP-06, TRIAGE-15 — no doc drift"
  - "SQL contract leg skipped locally when SUPABASE_DB_URL unset; file created for CI"

patterns-established:
  - "Legacy contract asserts intake API paths and GuidanceScriptCard gating without officer scope"

requirements-completed: []

duration: 8min
completed: 2026-07-23
status: checkpoint-pending-uat
---

# Phase 15 Plan 04: Gate + Traceability Summary

**phase15:gate composite script with chat-intake legacy contract and Hanoi SQL schema assertions — human UAT pending**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T02:19:00Z
- **Completed:** 2026-07-23T02:28:00Z (automated tasks only; UAT checkpoint open)
- **Tasks:** 2/3 (checkpoint Task 3 pending)
- **Files modified:** 3

## Accomplishments

- `tests/chat-intake-contract.test.mjs` covers ChatIntakePanel intake API wiring, GuidanceScriptCard on self_help path, Hanoi v5.2 prompt reference, and SHELP-04/05 regression pointers (PUB-07, SHELP-06)
- `npm run phase15:gate` chains unit (4 files), legacy (2 files), and SQL contract per 15-VALIDATION.md
- `supabase/tests/15_phase15_contract.sql` asserts Hanoi columns on `reports` and `chat_messages.report_id` FK
- REQUIREMENTS.md and ROADMAP.md traceability verified — no updates required

## Task Commits

1. **Task 1: chat-intake-contract.test.mjs** - `ddc2c7d` (test)
2. **Task 2: SQL contract, phase15:gate, docs traceability** - `e3a3bb7` (feat)

**Task 3 (checkpoint:human-verify):** Pending — UAT-1..7 not yet executed

## Test Results

| Leg | Command | Result |
|-----|---------|--------|
| Unit | `npm run test:unit -- guidance-resolver citizen-chat-intake hanoi-policy openai-compatible` | **PASS** (39 tests) |
| Legacy | `npm run test:legacy -- chat-intake-contract citizen-success-triage` | **PASS** (131 tests total in legacy runner) |
| SQL | `node scripts/run-supabase-sql.mjs -f supabase/tests/15_phase15_contract.sql` | **SKIPPED** — `SUPABASE_DB_URL` not set locally |

`npm run phase15:gate` passes unit + legacy legs; SQL leg requires `SUPABASE_DB_URL` in CI or local `.env.local`.

## Files Created/Modified

- `tests/chat-intake-contract.test.mjs` — Static contract for chat-first intake and guidance wiring
- `supabase/tests/15_phase15_contract.sql` — Hanoi column + chat_messages FK contract
- `package.json` — Added `phase15:gate` script

## Decisions Made

- None beyond plan — REQUIREMENTS/ROADMAP already aligned with 15-VALIDATION.md

## Deviations from Plan

None - plan executed exactly as written for Tasks 1-2.

## Human UAT (Pending)

| UAT ID | Scenario | Status |
|--------|----------|--------|
| UAT-1 | Chat-first report page — ChatIntakePanel primary, classic form link | **Pending** |
| UAT-2 | Conversational intake → submit → success with report_id + token | **Pending** |
| UAT-3 | Self-guidance script delivery (handling type 1) | **Pending** |
| UAT-4 | Government handoff (type 2/3 / generate_later) + escalate CTA | **Pending** |
| UAT-5 | Hanoi classifier persistence in officer dashboard + agent console metadata | **Pending** |
| UAT-6 | Phase 13 regression — classic form submit + CitizenTriageOutcome branches | **Pending** |
| UAT-7 | Token privacy — wrong token rejected (401), no cross-report leakage | **Pending** |

**Resume signal:** Type `approved` or list failing UAT IDs after completing verification per 15-VALIDATION.md.

## Issues Encountered

- SQL contract not executed locally — `SUPABASE_DB_URL` unset; contract file created and wired into gate for environments with DB access

## Next Phase Readiness

- Automated gate foundation complete; Phase 15 blocked on human UAT-1..7
- Officer agent console regression (Phase 14) should be verified read-only during UAT-5

## Self-Check: PASSED

- FOUND: tests/chat-intake-contract.test.mjs
- FOUND: supabase/tests/15_phase15_contract.sql
- FOUND: package.json phase15:gate
- FOUND: commit ddc2c7d
- FOUND: commit e3a3bb7

---
*Phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g*
*Automated tasks completed: 2026-07-23 — UAT checkpoint open*
