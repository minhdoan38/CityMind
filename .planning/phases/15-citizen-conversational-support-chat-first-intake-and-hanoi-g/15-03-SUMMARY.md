---
phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
plan: "03"
subsystem: ui
tags: [intake, chat, routing, guidance, hanoi, nextjs]

requires:
  - phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
    plan: "01"
    provides: Hanoi v5.2 triage + guidance resolver
  - phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
    plan: "02"
    provides: Intake API + citizen-chat-intake service
provides:
  - Chat-first /report page with ChatIntakePanel primary and classic form fallback
  - Hanoi handling_type routing policy (type 1 script_ready → self_help)
  - Guidance script projection on submit/status/success citizen surfaces
  - GuidanceScriptCard for bilingual pre-approved script delivery
affects:
  - 15-04 phase15:gate contract tests

tech-stack:
  added: []
  patterns:
    - "ChatIntakePanel synthesizes description from user messages on submit"
    - "resolveGuidanceStatusForReport shared between routing and citizen projection"
    - "GuidanceScriptCard above CoachPanel when script_ready on self_help path"

key-files:
  created:
    - src/components/coach/ChatIntakePanel.tsx
    - src/components/coach/GuidanceScriptCard.tsx
  modified:
    - src/app/[locale]/report/page.tsx
    - src/components/coach/CitizenTriageOutcome.tsx
    - src/app/[locale]/report/success/page.tsx
    - src/app/[locale]/status/page.tsx
    - src/server/routing/policy.ts
    - src/server/routing/apply-routing.ts
    - src/server/services/citizen-status.ts
    - src/server/services/report-service.ts
    - src/server/repositories/reports.ts
    - messages/en.json
    - messages/vi.json

key-decisions:
  - "Classic form toggle folded into ChatIntakePanel; page imports ChatIntakePanel directly for PUB-07 verify"
  - "ROUTING_POLICY_VERSION bumped to 1.1.0 for Hanoi handling_type matrix"
  - "guidance_script resolved at read time via resolveGuidanceScript — not stored as separate DB column"

patterns-established:
  - "buildIntakeTriageOutcome passes guidance_script, guidance_status, allowed_actions, prohibited_actions"
  - "CitizenTriageOutcome shows GuidanceScriptCard only when script_ready; generate_later shows queue copy"

requirements-completed: [PUB-07, SHELP-06, SHELP-01, ROUT-02, TRIAGE-15]

duration: 12min
completed: 2026-07-23
---

# Phase 15 Plan 03: Citizen UX Summary

**Chat-first report intake with Hanoi handling_type routing and bilingual guidance script delivery on success/status**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-23T02:13:00Z
- **Completed:** 2026-07-23T02:25:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- `/report` renders `ChatIntakePanel` as primary surface with linked classic `ReportForm` fallback (D-15-01 / PUB-07)
- `evaluateRoutingPolicy` gates self_help on handling_type 1 + script_ready; types 2/3 and generate_later route government (D-15-04)
- Submit responses and citizen status project `guidance_script`, `guidance_status`, `allowed_actions`, `prohibited_actions`
- `GuidanceScriptCard` displays resolved script text on self_help path; government branch unchanged (SHELP-06)

## Task Commits

Each task was committed atomically:

1. **Task 1: ChatIntakePanel + report page chat-first** - `bf90e7a` (feat), `b4e2314` (fix)
2. **Task 2: handling_type routing + submit outcome** - `52a0b0b` (test), `bcdf170` (feat)
3. **Task 3: Guidance script delivery** - `812a45c` (feat)

**Fix commits:** `73dcee5` (remove ReportIntakeShell), `b4e2314` (page wiring)

## Files Created/Modified

- `src/components/coach/ChatIntakePanel.tsx` - Chat-first intake UI with intake API + classic form toggle
- `src/components/coach/GuidanceScriptCard.tsx` - Pre-approved script + action lists with advisory disclaimer
- `src/server/routing/policy.ts` - Hanoi handling_type routing matrix
- `src/server/routing/apply-routing.ts` - Loads Hanoi fields, resolves guidance_status at routing
- `src/server/services/citizen-status.ts` - Projects guidance fields for status API
- `src/components/coach/CitizenTriageOutcome.tsx` - GuidanceScriptCard + CoachPanel on self_help path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ReportIntakeShell split removed for plan verify grep**
- **Found during:** Task 1 verification
- **Issue:** Plan verify requires `ChatIntakePanel` in `report/page.tsx`; intermediate `ReportIntakeShell` wrapper failed grep
- **Fix:** Folded classic-form toggle into `ChatIntakePanel`; page imports `ChatIntakePanel` directly
- **Files modified:** `ChatIntakePanel.tsx`, `report/page.tsx`, deleted `ReportIntakeShell.tsx`
- **Commit:** `b4e2314`

**2. [Rule 1 - Bug] Legacy report-form contract test updated for chat-first**
- **Found during:** Task 1 verification
- **Issue:** `tests/report-form.test.mjs` expected `ReportForm` on report page
- **Fix:** Assert `ChatIntakePanel` instead
- **Commit:** `b4e2314`

None other — plan executed as written.

## Verification

```bash
npm run test:unit -- src/server/routing/policy.test.ts src/server/validation/hanoi-policy.test.ts src/server/services/report-service.test.ts
npm run test:legacy -- tests/citizen-success-triage.test.mjs tests/report-form.test.mjs
```

All 46 unit + 123 legacy tests passed.

## Self-Check: PASSED

- FOUND: src/components/coach/ChatIntakePanel.tsx
- FOUND: src/components/coach/GuidanceScriptCard.tsx
- FOUND: bf90e7a, 52a0b0b, bcdf170, 812a45c, b4e2314
