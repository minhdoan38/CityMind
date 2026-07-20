---
phase: 04-citizen-status
plan: "01"
subsystem: api
tags: [fastapi, supabase, sha256, rate-limit, citizen-status, access-tokens]

requires:
  - phase: 01-supabase-foundation
    provides: access_tokens table and hash-at-rest issuance
  - phase: 02-public-experience
    provides: plaintext token shown once at submission success
provides:
  - "POST /api/v1/reports/status with SHA-256 hash verify and uniform 401"
  - "CitizenStatusResponse allowlist (status, summary, history without actor_id)"
  - "Separate status_limiter keyed status:{ip} (CIT-04)"
affects:
  - 04-citizen-status
  - 04-02 BFF/UI status page
  - 04-03 officer copy-link

tech-stack:
  added: []
  patterns:
    - "Uniform HTTP 401 + identical detail for all citizen verify failures (never 404)"
    - "Separate SlidingWindowLimiter instance per public surface (analyze vs status)"
    - "token_hash PK lookup then secrets.compare_digest on report_id"

key-files:
  created:
    - backend/tests/test_citizen_status.py
  modified:
    - backend/app/schemas.py
    - backend/app/services/tokens.py
    - backend/app/services/supabase.py
    - backend/app/api/reports.py
    - backend/app/security.py
    - backend/app/config.py
    - backend/.env.example
    - backend/tests/test_security.py

key-decisions:
  - "Generic 401 detail: We could not verify that report and token."
  - "Citizen history projection selects status/note/created_at only (no actor_id)"
  - "status_rate_limit_per_minute defaults to 0 locally; prod guidance ~30"

patterns-established:
  - "Citizen verify helper raises one shared HTTPException(401) for miss/expire/mismatch"
  - "Rate-limit key prefix status: isolates citizen lookup from analyze limiter"

requirements-completed: [CIT-02, CIT-03, CIT-04]

coverage:
  - id: D1
    description: "POST /status returns allowlisted status/summary/history newest-first without actor_id or AI internals"
    requirement: CIT-02
    verification:
      - kind: unit
        ref: "backend/tests/test_citizen_status.py#test_status_dto_strips_sensitive_fields"
        status: pass
    human_judgment: false
  - id: D2
    description: "Missing/wrong/expired/mismatched token verification returns identical HTTP 401 detail (no existence leak)"
    requirement: CIT-03
    verification:
      - kind: unit
        ref: "backend/tests/test_citizen_status.py#test_uniform_401_no_existence_leak"
        status: pass
      - kind: unit
        ref: "backend/tests/test_citizen_status.py#test_report_id_binding"
        status: pass
    human_judgment: false
  - id: D3
    description: "Separate status rate limiter with status:{ip} keys; 429 Retry-After 60; does not share report_limiter"
    requirement: CIT-04
    verification:
      - kind: unit
        ref: "backend/tests/test_citizen_status.py#test_status_rate_limit_separate_from_analyze"
        status: pass
      - kind: unit
        ref: "backend/tests/test_security.py#test_status_rate_limiter_uses_status_prefix_and_xff"
        status: pass
      - kind: unit
        ref: "backend/tests/test_security.py#test_status_and_report_limiters_do_not_share_events"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-20
status: complete
---

# Phase 4 Plan 01: Citizen Status API Summary

**Public `POST /api/v1/reports/status` with SHA-256 hash verify, uniform 401 anti-enumeration, citizen DTO stripping, and a separate IP rate limiter.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-20T14:07:34Z
- **Completed:** 2026-07-20T14:10:00Z
- **Tasks:** 3/3
- **Files modified:** 9

## Accomplishments

- Delivered Track A backend vertical slice for CIT-02/03/04: hash-bound status lookup with allowlisted DTO.
- All verify failures share one 401 detail (`We could not verify that report and token.`) — never officer-style 404.
- Status rate limiting uses a distinct `status_limiter` keyed `status:{ip}` via existing XFF peel; analyze limiter untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing pytest for citizen status** - `d12e96b` (test)
2. **Task 2: POST /status hash verify + citizen DTO** - `03cdce9` (feat)
3. **Task 3: Separate status rate limiter + settings** - `5a16dd3` (feat)

**Plan metadata:** `5599abd` (docs: complete plan)

## Files Created/Modified

- `backend/tests/test_citizen_status.py` — CIT-02/03/04 automated coverage
- `backend/app/schemas.py` — CitizenStatusRequest/Response/HistoryItem allowlist DTOs
- `backend/app/services/tokens.py` — `hash_access_token` + `token_binds_report` (compare_digest + expiry)
- `backend/app/services/supabase.py` — `get_access_token_by_hash` + `get_citizen_status` projection
- `backend/app/api/reports.py` — public `POST /status` with uniform 401 helper
- `backend/app/security.py` — `status_limiter` + `enforce_status_rate_limit`
- `backend/app/config.py` — `status_rate_limit_per_minute`
- `backend/.env.example` — `STATUS_RATE_LIMIT_PER_MINUTE` (prod ~30 guidance)
- `backend/tests/test_security.py` — status limiter isolation + XFF prefix tests

## Decisions Made

- Used plan/PATTERNS generic verify failure copy: `We could not verify that report and token.`
- Empty/malformed request bodies still return FastAPI/Pydantic **422** (min_length validation); verify-path failures are uniform **401**. Existence anti-enumeration applies to token/report proof outcomes, not schema shape errors.
- History notes remain plain text when present; `actor_id` never selected for citizen projection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. Set `STATUS_RATE_LIMIT_PER_MINUTE` (~30) in production when deploying.

## Next Phase Readiness

Ready for **04-02** (Next BFF + `/status` UI). Backend contract is stable: JSON `{report_id, token}` → 200 allowlist / 401 generic / 429 with `Retry-After: 60`. Do not implement 04-02/04-03 in this plan.

## TDD Gate Compliance

1. RED: `d12e96b` — `test(04-01): add failing test for citizen status API`
2. GREEN: `03cdce9` — happy-path + uniform 401
3. GREEN: `5a16dd3` — rate limiter completes remaining red cases

## Self-Check: PASSED

- `backend/tests/test_citizen_status.py` — FOUND
- Commits `d12e96b`, `03cdce9`, `5a16dd3` — FOUND in git log
- `pytest tests/test_citizen_status.py tests/test_access_tokens.py` — 6 passed (citizen + DATA-03 regression)

---
*Phase: 04-citizen-status*
*Completed: 2026-07-20*
