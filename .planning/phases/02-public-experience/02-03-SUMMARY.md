---
phase: 02-public-experience
plan: "03"
subsystem: auth
tags: [supabase-auth, proxy.ts, getClaims, returnUrl, next-intl, AUTH-04]

requires:
  - phase: 02-public-experience
    provides: locale-only proxy.ts next-intl seam (02-02)
provides:
  - Supabase Auth login with safe returnUrl (D-15)
  - proxy.ts dashboard getClaims gate composed with locale middleware (AUTH-04 / D-17)
affects:
  - 02-05 (dashboard cards / officerFetch)
  - Phase 3 dashboard polish

tech-stack:
  added: []
  patterns:
    - "supabase.auth.getClaims() for authorization (not getSession alone)"
    - "safeReturnUrl same-origin path allowlist (T-02-09)"
    - "proxy.ts composes next-intl then /dashboard getClaims gate"

key-files:
  created:
    - frontend/src/lib/safe-return-url.ts
  modified:
    - frontend/src/lib/auth.ts
    - frontend/src/app/login/page.tsx
    - frontend/src/app/api/session/login/route.ts
    - frontend/src/proxy.ts
    - frontend/tests/officer-auth.test.mjs
    - frontend/tests/public-shell.test.mjs

key-decisions:
  - "Authorize via supabase.auth.getClaims + app_metadata.role (officer|admin)"
  - "AUTH-04 protects /dashboard/:path* only — never public Home (D-17 path correction)"
  - "Login EN copy inline outside [locale] to avoid Wave 2 catalog conflicts with 02-04"

patterns-established:
  - "safeReturnUrl helper shared by login page, login route, and consumers"
  - "Dashboard auth runs in proxy.ts before NextResponse.next; locale routes keep intlMiddleware"

requirements-completed: [AUTH-04]

coverage:
  - id: D1
    description: Officers sign in with Supabase email/password and land on safe returnUrl (default /dashboard)
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: frontend/tests/officer-auth.test.mjs#login route uses signInWithPassword and safe returnUrl (D-15)
        status: pass
      - kind: unit
        ref: frontend/tests/officer-auth.test.mjs#safeReturnUrl rejects open redirects (T-02-09)
        status: pass
      - kind: unit
        ref: frontend/tests/officer-auth.test.mjs#login page honors returnUrl and stays outside [locale]
        status: pass
    human_judgment: false
  - id: D2
    description: Unauthenticated /dashboard redirects to /login?returnUrl= via proxy.ts getClaims gate; public locale routes stay open
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: frontend/tests/officer-auth.test.mjs#proxy.ts gates /dashboard with getClaims + returnUrl (AUTH-04 / D-15 / D-17)
        status: pass
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#proxy.ts composes next-intl with dashboard getClaims gate (D-17 / AUTH-04)
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-20
status: complete
---

# Phase 2 Plan 03: Officer Auth Gate Summary

**Supabase Auth login with safe returnUrl plus proxy.ts getClaims gate on /dashboard (AUTH-04 / D-15 / D-17)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-20T12:09:54Z
- **Completed:** 2026-07-20T12:14:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Replaced HMAC officer cookie path with Supabase `signInWithPassword` + `safeReturnUrl` (D-15 / T-02-09)
- Switched `auth.ts` authorization to `supabase.auth.getClaims()` reading `app_metadata.role`
- Composed `/dashboard` getClaims gate onto the Plan 02-02 next-intl `proxy.ts` seam without protecting public `/` or `[locale]` routes
- Kept `/login` and `/dashboard` outside `[locale]` with inline EN login copy

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace HMAC login with Supabase Auth and returnUrl**
   - `e787955` (test) — failing officer auth returnUrl contracts
   - `9586fe1` (feat) — Supabase login + safeReturnUrl + getClaims auth helpers
2. **Task 2: Gate /dashboard in proxy.ts with getClaims**
   - `5218e35` (test) — failing dashboard getClaims proxy contracts
   - `f9ba277` (feat) — compose getClaims dashboard gate on proxy.ts

**Plan metadata:** `ed58b1e` (docs: complete Track C auth gate plan)

## Files Created/Modified

- `frontend/src/lib/safe-return-url.ts` — same-origin path allowlist (default `/dashboard`)
- `frontend/src/lib/auth.ts` — `getClaims()` via `supabase.auth.getClaims()`
- `frontend/src/app/login/page.tsx` — email/password + hidden returnUrl; EN inline copy
- `frontend/src/app/api/session/login/route.ts` — `signInWithPassword` + safe redirect
- `frontend/src/app/api/session/logout/route.ts` — already `signOut` (unchanged this plan)
- `frontend/src/proxy.ts` — next-intl + dashboard getClaims + returnUrl redirect
- `frontend/tests/officer-auth.test.mjs` — AUTH-04 / D-15 / D-17 contracts
- `frontend/tests/public-shell.test.mjs` — updated for composed auth+locale proxy

## Decisions Made

- Use JWT `getClaims()` (not `getUser()` / `getSession()` alone) for both RSC helpers and proxy gate
- Role gate requires `app_metadata.role` in `{officer, admin}` — matches FastAPI JWKS checks
- AUTH-04 wording correction documented in tests: protect `/dashboard`, never public Home
- Login stays outside locale catalogs during Wave 2 to avoid 02-04 message-file conflicts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated public-shell proxy contract for auth composition**
- **Found during:** Task 2
- **Issue:** Plan 02-02 `public-shell.test.mjs` asserted proxy must not contain `getClaims`
- **Fix:** Rewrote assertion to require composed next-intl + getClaims dashboard gate
- **Files modified:** `frontend/tests/public-shell.test.mjs`
- **Verification:** `node --test tests/public-shell.test.mjs` pass
- **Committed in:** `f9ba277`

**2. [Rule 1 - Bug] Login-route contract keyed off shared helper default**
- **Found during:** Task 2 verify (parallel login-route polish removed `/dashboard` literal)
- **Issue:** Test expected `/dashboard` string inside login route after default moved to `safeReturnUrl`
- **Fix:** Assert `safeReturnUrl` import + default lives in helper
- **Files modified:** `frontend/tests/officer-auth.test.mjs`
- **Verification:** officer-auth suite pass
- **Committed in:** `f9ba277`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Necessary for green suite under parallel Wave 2 edits; no scope creep into ReportForm/02-04

## Issues Encountered

None blocking. Parallel 02-04 work touched unrelated ReportForm/package files — left unstaged.

## User Setup Required

None - no external service configuration required beyond existing Supabase Auth env vars from Phase 1.

## Next Phase Readiness

- Ready for Plan 02-05 dashboard cards / Bearer officerFetch (depends on this auth gate)
- Plan 02-04 may continue in parallel (form) — proxy locale seam preserved
- Manual smoke recommended: unauthenticated `/dashboard` → `/login?returnUrl=…`; authenticated officer lands on returnUrl

## Self-Check: PASSED

- `frontend/src/lib/safe-return-url.ts` FOUND
- `frontend/src/proxy.ts` FOUND with `auth.getClaims` + `returnUrl`
- `frontend/src/app/login/page.tsx` FOUND outside `[locale]`
- Commits `e787955`, `9586fe1`, `5218e35`, `f9ba277` FOUND in `git log`
- `node --test tests/officer-auth.test.mjs` — 10/10 pass
- No `middleware.ts` created

---
*Phase: 02-public-experience*
*Completed: 2026-07-20*
