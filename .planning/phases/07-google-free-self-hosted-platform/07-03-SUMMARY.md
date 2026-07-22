---
phase: 07-google-free-self-hosted-platform
plan: "03"
subsystem: api
tags: [citizen-status, supabase, access-tokens, rate-limit, server-only, vitest, privacy]

requires:
  - phase: 07-02
    provides: Vitest runner, server-only stubs, golden contract fixtures
provides:
  - Server-only Supabase admin client with explicit repository injection
  - SHA-256 access token verification with constant-time report binding
  - Isolated status/report/stats rate limiters with trusted XFF hop selection
  - Citizen-safe report repository projection (no actor_id, evidence, or AI fields)
  - FastAPI-compatible POST /api/v1/reports/status Next.js handler
  - Browser BFF delegating to local handler (no FastAPI hop)
affects: [07-04, 07-05, 07-06, 07-14]

tech-stack:
  added: []
  patterns:
    - server-only admin client with persistSession/autoRefreshToken disabled
    - explicit SupabaseClient injection in repositories (no hidden singleton in repo layer)
    - uniform 401 citizen verification failures with allowlisted JSON projection
    - shared handleCitizenStatusRequest for v1 compatibility and public BFF routes

key-files:
  created:
    - frontend/src/lib/supabase/admin.ts
    - frontend/src/server/security/access-tokens.ts
    - frontend/src/server/security/access-tokens.test.ts
    - frontend/src/server/security/rate-limit.ts
    - frontend/src/server/security/rate-limit.test.ts
    - frontend/src/server/repositories/reports.ts
    - frontend/src/server/repositories/reports.test.ts
    - frontend/src/server/http/errors.ts
    - frontend/src/server/services/citizen-status.ts
    - frontend/src/server/services/citizen-status.test.ts
    - frontend/src/app/api/v1/reports/status/route.ts
  modified:
    - frontend/src/app/api/public/reports/status/route.ts
    - frontend/tests/citizen-status.test.mjs
    - frontend/.env.example
    - frontend/vitest.config.mts

key-decisions:
  - "Shared handleCitizenStatusRequest powers both /api/v1/reports/status and /api/public/reports/status to avoid self-fetch and duplicate logic"
  - "Rate-limit settings read directly from process.env with STATUS_RATE_LIMIT_PER_MINUTE default 0 for local dev parity with Python"
  - "Admin client cached via getAdminClient but repositories still require explicit client parameter for testability and boundary enforcement"

patterns-established:
  - "Citizen status vertical slice: rate limit → Zod validation → hash lookup → token binding → citizen projection"
  - "Import-boundary scan forbids admin client and SUPABASE_SERVICE_ROLE_KEY in components, locale pages, and officer handlers"

requirements-completed: [SELFHOST-01]

duration: 25min
completed: 2026-07-21
---

# Phase 7 Plan 03 Summary

**Citizen status as a complete Next.js → Supabase vertical slice with SHA-256 token binding, uniform 401 failures, isolated rate limiting, and FastAPI-compatible `/api/v1/reports/status` without a Python hop**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-21T21:40:00+07:00
- **Completed:** 2026-07-21T21:45:00+07:00
- **Tasks:** 2/2 complete
- **Files modified:** 15

## Accomplishments

- Ported token hashing, constant-time report binding, and expiry checks from `backend/app/services/tokens.py`
- Added process-local sliding-window limiters with separate `status:`, analyze, and `stats:` keyspaces and `Retry-After: 60`
- Implemented citizen-safe repository projection omitting actor_id, evidence, AI, and token metadata
- Created `/api/v1/reports/status` compatibility route and rewired public BFF to delegate locally (no `backendEndpoint`)
- Added import-boundary tests blocking admin client imports from components, locale pages, and officer handlers

## Task Commits

Changes are uncommitted per operator preference.

## Files Created/Modified

- `frontend/src/lib/supabase/admin.ts` — server-only service-role client, session persistence disabled
- `frontend/src/server/security/access-tokens.ts` — SHA-256 hash + constant-time `tokenBindsReport`
- `frontend/src/server/security/rate-limit.ts` — XFF-aware client IP + three isolated limiters
- `frontend/src/server/repositories/reports.ts` — explicit-client token lookup and citizen status projection
- `frontend/src/server/http/errors.ts` — uniform 401/429/502 error mapping
- `frontend/src/server/services/citizen-status.ts` — shared handler orchestrating limit → validate → lookup
- `frontend/src/app/api/v1/reports/status/route.ts` — FastAPI-compatible citizen status endpoint
- `frontend/src/app/api/public/reports/status/route.ts` — browser BFF now delegates to shared handler
- `frontend/tests/citizen-status.test.mjs` — updated BFF contract tests for local delegation
- `frontend/.env.example` — documented `STATUS_RATE_LIMIT_PER_MINUTE` and `TRUSTED_PROXY_COUNT`
- `frontend/vitest.config.mts` — added `@/` path alias for server module tests

## Decisions Made

- Extracted `handleCitizenStatusRequest` into `server/services/citizen-status.ts` (not listed in plan file manifest but required to satisfy “no self-fetch / shared service” acceptance criteria without duplicating route logic)
- Kept AI env vars optional for this slice — citizen status only requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` at runtime

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added shared citizen-status service module**
- **Found during:** Task 2
- **Issue:** Plan requires BFF and v1 route to share server logic without `backend.ts` or self-fetch; plan file list did not include a service module
- **Fix:** Created `frontend/src/server/services/citizen-status.ts` with `handleCitizenStatusRequest` and tests
- **Files modified:** `frontend/src/server/services/citizen-status.ts`, `citizen-status.test.ts`, both route handlers

None otherwise — plan executed as written.

## Issues Encountered

None blocking. Pre-existing `eslint` error in `DateRangeToolbar.tsx` remains out of scope.

## User Setup Required

Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `frontend/.env` (or runtime env). Optional production tuning: `STATUS_RATE_LIMIT_PER_MINUTE=30`, `TRUSTED_PROXY_COUNT=1`.

## Next Phase Readiness

- Citizen status is ready for live Supabase verification once operator points env at `http://citymind-supa.minhmice.com`
- 07-04 analyze slice can follow the same explicit-client + shared-handler pattern
- FastAPI status endpoint remains in backend for rollback until full phase gate (per plan rollback conditions)

## Self-Check: PASSED

- All listed created files exist on disk
- Unit tests: 53 passed (`npm run test:unit`)
- Targeted tests: 26 passed (access-tokens, rate-limit, reports, citizen-status, golden-contracts)
- Legacy tests: 78 passed including updated `citizen-status.test.mjs`
- Lint: no new errors in 07-03 files (pre-existing DateRangeToolbar error unchanged)

---
*Phase: 07-google-free-self-hosted-platform*
*Completed: 2026-07-21*
