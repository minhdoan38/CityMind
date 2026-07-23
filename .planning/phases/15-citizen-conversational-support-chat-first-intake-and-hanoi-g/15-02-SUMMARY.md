---
phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
plan: "02"
subsystem: api
tags: [intake, chat, token-auth, triage, nextjs]

requires:
  - phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
    plan: "01"
    provides: Hanoi v5.2 triage classifier wired for sync dispatch on submit
provides:
  - Token-scoped intake session APIs (start, messages, submit)
  - citizen-chat-intake service with facilitator AI conversation
  - Dedicated intake rate limiter separate from coach
  - public.intake EN/VI copy keys for Wave 3 UI
affects:
  - 15-03 ChatIntakePanel citizen UX
  - 15-04 phase15:gate contract tests

tech-stack:
  added: []
  patterns:
    - "Intake facilitator prompt collects fields only — no classification"
    - "startIntakeSession creates pending report + token on first boundary"
    - "finalizeIntakeSubmit updates report then dispatchTriageAndWait with enqueue fallback"

key-files:
  created:
    - src/server/services/citizen-chat-intake.ts
    - src/server/services/citizen-chat-intake.test.ts
    - src/server/ai/intake-facilitator.ts
    - src/app/api/public/reports/intake/start/route.ts
    - src/app/api/public/reports/intake/messages/route.ts
    - src/app/api/public/reports/intake/submit/route.ts
  modified:
    - src/server/security/rate-limit.ts
    - messages/en.json
    - messages/vi.json

key-decisions:
  - "Facilitator AI extracted to intake-facilitator.ts mirroring coach.ts module boundary"
  - "Intake rate limit uses separate intakeLimiter bucket keyed intake:{reportId}:{ip}"
  - "Submit supports JSON and multipart/form-data for evidence parity with ReportForm"

patterns-established:
  - "handleIntakeStartRequest / handleIntakeMessagesRequest / handleIntakeSubmitRequest HTTP delegation"
  - "assertIntakeEligible gates chat to triage_status pending only"

requirements-completed: []

duration: 8min
completed: 2026-07-23
---

# Phase 15 Plan 02: Chat Intake API Summary

**Token-scoped chat-first intake backend with facilitator conversation, chat_messages persistence, and sync triage on finalize**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T02:11:00Z
- **Completed:** 2026-07-23T02:19:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- `POST /api/public/reports/intake/start` creates pending report + access token + persisted welcome message
- `GET/POST /api/public/reports/intake/messages` requires valid token, persists user/assistant turns via facilitator AI
- `POST /api/public/reports/intake/submit` finalizes description/location/evidence, runs `dispatchTriageAndWait`, returns citizen outcome projection
- `public.intake` EN/VI keys added with parity for Wave 3 `ChatIntakePanel`

## Task Commits

Each task was committed atomically:

1. **Task 1: citizen-chat-intake service core** - `23d1fe6` (feat)
2. **Task 2: Intake API routes** - `06bb8b9` (feat)
3. **Task 3: Intake submit + i18n keys** - `3e94fb8` (feat)

## Files Created/Modified

- `src/server/services/citizen-chat-intake.ts` - Intake orchestration (start, messages, submit handlers)
- `src/server/ai/intake-facilitator.ts` - Facilitator system prompt and OpenAI-compatible reply generation
- `src/server/services/citizen-chat-intake.test.ts` - Auth, start, message exchange, submit, AI health tests
- `src/app/api/public/reports/intake/start/route.ts` - Session start endpoint
- `src/app/api/public/reports/intake/messages/route.ts` - Token-scoped chat CRUD
- `src/app/api/public/reports/intake/submit/route.ts` - Finalize + triage dispatch
- `src/server/security/rate-limit.ts` - `enforceIntakeRateLimit` with dedicated bucket
- `messages/en.json`, `messages/vi.json` - `public.intake` namespace

## Decisions Made

- Facilitator AI lives in `intake-facilitator.ts` (not inline) so tests can mock like `citizen-coach.test.ts`
- Submit handler accepts JSON (no image) or multipart (with image) matching `ReportForm` evidence validation
- Full submit implemented in Task 1 service (not stubbed) to keep single cohesive module

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extracted intake-facilitator.ts for testability**
- **Found during:** Task 1 (unit test setup)
- **Issue:** Mocking `generateFacilitatorReply` inside same module as tests breaks vitest hoisting
- **Fix:** Moved facilitator AI to `src/server/ai/intake-facilitator.ts` per coach pattern
- **Files modified:** `src/server/ai/intake-facilitator.ts`, `src/server/services/citizen-chat-intake.ts`
- **Verification:** `npm run test:unit -- src/server/services/citizen-chat-intake.test.ts` — 7 passed
- **Committed in:** `23d1fe6`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for test coverage; no scope change.

## Issues Encountered

None beyond deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 3 (15-03) can wire `ChatIntakePanel` to `/api/public/reports/intake/*` endpoints
- PUB-07 remains partial until chat-first UI ships in 15-03
- `phase15:gate` legacy contract test for intake APIs deferred to 15-04

## Self-Check: PASSED

- FOUND: src/server/services/citizen-chat-intake.ts
- FOUND: src/app/api/public/reports/intake/start/route.ts
- FOUND: src/app/api/public/reports/intake/messages/route.ts
- FOUND: src/app/api/public/reports/intake/submit/route.ts
- FOUND: 23d1fe6
- FOUND: 06bb8b9
- FOUND: 3e94fb8

---
*Phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g*
*Completed: 2026-07-23*
