---
phase: 02-public-experience
plan: "01"
subsystem: api
tags: [access-tokens, rate-limiting, filetype, x-forwarded-for, fastapi, supabase]

requires:
  - phase: 01-foundation
    provides: access_tokens table + SupabaseReportSink service-role insert patterns
provides:
  - "AnalyzeResponse.access_token plaintext once; SHA-256 hash + expires_at at rest"
  - "XFF-aware client_ip rate limiting with TRUSTED_PROXY_COUNT"
  - "Public analyze BFF forwards X-Forwarded-For / X-Real-IP"
  - "filetype magic-byte JPEG/PNG/WebP allowlist before Gemini/storage"
  - "Generic 502 analyze errors with logging.exception"
affects:
  - 02-04-public-experience
  - citizen status tracking

tech-stack:
  added: [filetype==1.2.0]
  patterns:
    - "issue-once access token: secrets.token_urlsafe(32) → SHA-256 hex; plaintext only in JSON"
    - "Rate limit key = Nth XFF hop from right (trusted_proxy_count, default 1)"
    - "Magic-byte sniff over Content-Type for evidence uploads"

key-files:
  created:
    - backend/app/services/tokens.py
    - backend/tests/test_access_tokens.py
  modified:
    - backend/app/api/reports.py
    - backend/app/services/supabase.py
    - backend/app/schemas.py
    - backend/app/security.py
    - backend/app/config.py
    - backend/requirements.txt
    - backend/tests/test_analyze.py
    - backend/tests/test_security.py
    - frontend/src/app/api/public/reports/analyze/route.ts

key-decisions:
  - "Kept WIP reconcile: finished gaps vs must_haves rather than rewriting partial Phase 2 edits"
  - "trusted_proxy_count defaults to 1 (rightmost hop); higher N selects hops[-N]"
  - "Renamed helper to issue_access_token for plan key_link alignment"
  - "Task 1 filetype==1.2.0 package checkpoint pre-approved by user — installed/pinned as planned"

patterns-established:
  - "DATA-03: hash-at-rest access tokens issued after report insert (FK order)"
  - "DATA-08: BFF forwards platform XFF; FastAPI keys limiter on trusted hop"
  - "DATA-09/10: magic-byte 415 + generic 502 with server-side exception logging"

requirements-completed: [DATA-03, DATA-08, DATA-09, DATA-10]

coverage:
  - id: D1
    description: Successful analyze returns plaintext access_token once; only SHA-256 hash stored with expires_at
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "backend/tests/test_access_tokens.py#test_issue_access_token_hashes_plaintext_and_sets_ttl"
        status: pass
      - kind: unit
        ref: "backend/tests/test_analyze.py#test_analyze_returns_access_token"
        status: pass
    human_judgment: false
  - id: D2
    description: Rate limiting keys on trusted XFF hop; BFF forwards X-Forwarded-For
    requirement: DATA-08
    verification:
      - kind: unit
        ref: "backend/tests/test_security.py#test_xff_rate_limiter_uses_rightmost_hop"
        status: pass
      - kind: unit
        ref: "backend/tests/test_security.py#test_xff_trusted_proxy_count_peels_rightmost"
        status: pass
      - kind: other
        ref: "rg X-Forwarded-For frontend/src/app/api/public/reports/analyze/route.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: Evidence uploads accepted only when filetype magic bytes are JPEG/PNG/WebP
    requirement: DATA-09
    verification:
      - kind: unit
        ref: "backend/tests/test_analyze.py#test_unsupported_image_mime_returns_415"
        status: pass
      - kind: unit
        ref: "backend/tests/test_analyze.py#test_forged_content_type_rejected_by_magic_bytes"
        status: pass
    human_judgment: false
  - id: D4
    description: Analyze failures return generic 502 detail without raw exception text
    requirement: DATA-10
    verification:
      - kind: unit
        ref: "backend/tests/test_analyze.py#test_critical_service_failure_returns_502"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-20
status: complete
---

# Phase 2 Plan 01: Access Token + Analyze Hardening Summary

**Hashed one-time access tokens on analyze, trusted-XFF rate limiting, filetype magic-byte uploads, and generic 502 errors — Track A contract for Plan 02-04.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-20T12:04:14Z
- **Completed:** 2026-07-20T12:07:08Z
- **Tasks:** 3/3 (Task 1 checkpoint pre-approved)
- **Files modified:** 11

## Accomplishments

- Analyze returns `access_token` once; `access_tokens` rows store only SHA-256 `token_hash` + `expires_at` (365d TTL).
- Rate limiter keys on trusted XFF hop (`client_ip` + optional `TRUSTED_PROXY_COUNT`); public BFF forwards XFF / X-Real-IP.
- Evidence path uses `filetype.guess` allowlist (JPEG/PNG/WebP) with 415 on forged Content-Type; analyze exceptions log via `logging.exception` and return fixed `"Report analysis failed"`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Approve filetype==1.2.0 package identity** - _(checkpoint)_ human-approved before install — no code commit
2. **Task 2: Issue hashed access tokens on successful analyze** - `67d073c` (feat)
3. **Task 3: Harden analyze with XFF rate limit, magic bytes, and generic errors** - `98b1c4e` (feat)

**Plan metadata:** `9276673` (docs: complete plan)

## Files Created/Modified

- `backend/app/services/tokens.py` - `issue_access_token` plaintext + hash + expires_at
- `backend/app/services/supabase.py` - `insert_access_token` service-role write
- `backend/app/schemas.py` - `AnalyzeResponse.access_token`
- `backend/app/api/reports.py` - issue/persist token; filetype sniff; generic 502
- `backend/app/security.py` - `client_ip` + XFF-aware rate limit
- `backend/app/config.py` - `trusted_proxy_count` setting
- `backend/requirements.txt` - `filetype==1.2.0` pin
- `backend/tests/test_access_tokens.py` - DATA-03 unit coverage
- `backend/tests/test_security.py` - XFF / TRUSTED_PROXY_COUNT coverage
- `backend/tests/test_analyze.py` - token hash, magic-byte, generic 502 coverage
- `frontend/src/app/api/public/reports/analyze/route.ts` - forward XFF / X-Real-IP

## Decisions Made

- Reconciled existing WIP instead of rewriting; closed gaps against must_haves.
- `trusted_proxy_count` default `1` selects rightmost hop; `N>1` selects `hops[-N]`.
- Helper named `issue_access_token` to match plan key_link pattern.
- Task 1 package legitimacy already approved — proceeded to install/pin without re-pausing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Added Settings.trusted_proxy_count**
- **Found during:** Task 3
- **Issue:** Plan required optional `TRUSTED_PROXY_COUNT` but Settings had no field; WIP only used rightmost hop inline.
- **Fix:** Added `trusted_proxy_count: int = 1` and extracted `client_ip()`.
- **Files modified:** `backend/app/config.py`, `backend/app/security.py`, `backend/tests/test_security.py`
- **Verification:** `pytest tests/test_security.py` — XFF tests pass
- **Committed in:** `98b1c4e`

**2. [Rule 1 - Bug] Corrected TRUSTED_PROXY_COUNT test expectation**
- **Found during:** Task 3
- **Issue:** Test expected peel-skip semantics (`hops[-(N+1)]`) but implementation correctly uses Nth-from-right (`hops[-N]`).
- **Fix:** Aligned test to `hops[-2]` for count=2.
- **Files modified:** `backend/tests/test_security.py`
- **Verification:** 27 backend tests pass for plan suite
- **Committed in:** `98b1c4e`

### WIP reconcile notes

- Task 2 commit included analyze wiring that already contained Task 3 filetype + generic-error paths (pre-existing WIP). Task 3 commit landed XFF/BFF/requirements/tests deltas. Documented — no rewrite.

---

**Total deviations:** 2 auto-fixed (1× Rule 2, 1× Rule 1)
**Impact on plan:** Required for DATA-08 correctness; no scope creep.

## Authentication Gates

None.

## Issues Encountered

None — pytest suite green (`27 passed` for `test_access_tokens` + `test_security` + `test_analyze`).

## User Setup Required

None - no external service configuration required. Optional env: `TRUSTED_PROXY_COUNT` (maps to `trusted_proxy_count`, default 1).

## Next Phase Readiness

- Soft A→B contract ready: Plan 02-04 can consume `AnalyzeResponse.access_token`.
- No new Supabase migration required.
- Ready for remaining Phase 2 plans (02-02 parallel may already be in progress); prefer 02-01 green before live success smoke on 02-04.

## Self-Check: PASSED

- FOUND: `backend/app/services/tokens.py`
- FOUND: `backend/tests/test_access_tokens.py`
- FOUND: `frontend/src/app/api/public/reports/analyze/route.ts`
- FOUND: commits `67d073c`, `98b1c4e`

---
*Phase: 02-public-experience*
*Completed: 2026-07-20*
