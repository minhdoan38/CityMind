---
phase: 02-public-experience
plan: "05"
subsystem: dashboard
tags: [officer-dashboard, ReportCard, Bearer-JWT, officerFetch, AUTH-04, D-16]

requires:
  - phase: 02-public-experience
    provides: proxy.ts getClaims gate + Supabase session (02-03)
provides:
  - D-16 recent report card list under /dashboard
  - Bearer JWT officerFetch to FastAPI recent/detail
  - Detail under /dashboard/reports/[reportId] with legacy redirect
affects:
  - Phase 3 dashboard polish (data table, export, resolve)

tech-stack:
  added: []
  patterns:
    - "officerFetch Authorization Bearer from getSessionToken (not X-CityMind-Officer-Key)"
    - "ReportCard D-16 list with text Priority/Status badges"
    - "Legacy /reports/[reportId] redirects into AUTH-04 gated path"

key-files:
  created:
    - frontend/src/components/dashboard/ReportCard.tsx
    - frontend/src/app/reports/[reportId]/page.tsx
  modified:
    - frontend/src/app/dashboard/page.tsx
    - frontend/tests/officer-auth.test.mjs

key-decisions:
  - "Inline EN dashboard copy outside [locale] (avoid Wave 2 catalog conflicts)"
  - "Text Priority:/Status: badges — not color-only"
  - "Keep existing detail page; add legacy redirect rather than delete-only"

patterns-established:
  - "Dashboard list = ReportCard map over officerFetch /reports/recent"
  - "Officer detail always under /dashboard/reports/* for proxy matcher"

requirements-completed: [AUTH-04]

coverage:
  - id: D1
    description: Authenticated dashboard shows simple recent ReportCard list (category, priority, status, summary) linking to /dashboard/reports/[reportId]
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: frontend/tests/officer-auth.test.mjs#dashboard lists recent reports as ReportCard list (D-16)
        status: pass
      - kind: unit
        ref: frontend/tests/officer-auth.test.mjs#officerFetch sends Bearer JWT from getSessionToken (T-02-08)
        status: pass
    human_judgment: false
  - id: D2
    description: Report detail lives under /dashboard/reports/[reportId]; legacy /reports/[reportId] redirects into gated path
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: frontend/tests/officer-auth.test.mjs#report detail lives under /dashboard/reports so proxy matcher covers it
        status: pass
      - kind: other
        ref: cd frontend && npm run build
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-20
status: complete
---

# Phase 2 Plan 05: Dashboard Report Cards Summary

**D-16 ReportCard list on /dashboard with Bearer JWT officerFetch and detail under /dashboard/reports/[reportId]**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-20T12:16:04Z
- **Completed:** 2026-07-20T12:19:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extracted `ReportCard` with category, Priority:/Status: text badges, summary, and link to gated detail
- Confirmed `officerFetch` sends `Authorization: Bearer` from Supabase `getSessionToken` (T-02-08)
- Locked detail under `/dashboard/reports/[reportId]` and added legacy `/reports/[reportId]` redirect
- Kept Phase 3 table/export/resolve chrome out of Phase 2 definition of done

## Task Commits

Each task was committed atomically:

1. **Task 1: Bearer officerFetch and simple dashboard report cards**
   - `df76c32` (test) — failing ReportCard / Bearer contracts
   - `5c1edd4` (feat) — ReportCard + simplified dashboard page
2. **Task 2: Relocate report detail under /dashboard/reports**
   - `6568acd` (test) — failing detail-route relocation contracts
   - `faed916` (feat) — legacy `/reports/[reportId]` redirect into dashboard

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `frontend/src/components/dashboard/ReportCard.tsx` — D-16 card with text badges + detail link
- `frontend/src/app/dashboard/page.tsx` — recent card list + UI-SPEC empty copy (inline EN)
- `frontend/src/app/reports/[reportId]/page.tsx` — redirect into `/dashboard/reports/[reportId]`
- `frontend/tests/officer-auth.test.mjs` — Bearer, D-16, detail-route contracts
- `frontend/src/lib/backend.ts` — already Bearer-wired from prior work; verified, no edit needed
- `frontend/src/app/dashboard/layout.tsx` — already present from prior work; verified, no edit needed
- `frontend/src/app/dashboard/reports/[reportId]/page.tsx` — already relocated; preserved fields/fetch

## Decisions Made

- Use inline EN on dashboard (outside `[locale]`) instead of `getTranslations` to avoid parallel 02-04 message-catalog conflicts
- Prefer text-labeled Priority/Status chips over color-only badges
- Add an explicit legacy redirect page rather than delete-only (plan allowed either)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scoped lint around parallel 02-04 failures**
- **Found during:** Task 1 verify
- **Issue:** `npm run lint` failed on unrelated `[locale]/report/success` and `ReportForm` files owned by parallel Plan 02-04
- **Fix:** Verified lint clean on 02-05 scoped files only; left 02-04 files untouched
- **Files modified:** none (out of scope)
- **Verification:** `npx eslint` on dashboard/ReportCard/backend/officer-auth paths — clean
- **Committed in:** n/a (no code change)

**2. [Rule 2 - Missing Critical] Documented pre-existing Bearer + detail relocation**
- **Found during:** Task 1/2 read_first
- **Issue:** `officerFetch` Bearer wiring and `/dashboard/reports/[reportId]` detail already existed from earlier work
- **Fix:** Locked contracts in tests; extracted ReportCard; added legacy redirect for AUTH-04 continuity
- **Files modified:** ReportCard, dashboard page, legacy redirect, tests
- **Verification:** officer-auth 13/13 pass; build lists `/dashboard/reports/[reportId]` and `/reports/[reportId]`
- **Committed in:** `5c1edd4`, `faed916`

---

**Total deviations:** 2 auto-fixed (1 blocking scope, 1 missing-critical continuity)
**Impact on plan:** No scope creep into Phase 3 table/export; parallel 02-04 files left alone

## Issues Encountered

None blocking. Parallel 02-04 unstaged ReportForm/package/message changes were left unstaged.

## User Setup Required

None - no external service configuration required beyond existing Supabase Auth + FastAPI JWKS from Phase 1.

## Next Phase Readiness

- AUTH-04 officer UX complete for Phase 2 (gate + cards + Bearer + gated detail)
- Phase 3 can add data table, filters, export, and resolve-note polish on this foundation
- Manual smoke recommended: sign in → `/dashboard` cards → open detail under `/dashboard/reports/...`

## Self-Check: PASSED

- `frontend/src/components/dashboard/ReportCard.tsx` FOUND
- `frontend/src/app/dashboard/page.tsx` FOUND with ReportCard + "No reports yet"
- `frontend/src/app/dashboard/reports/[reportId]/page.tsx` FOUND
- `frontend/src/app/reports/[reportId]/page.tsx` FOUND (redirect)
- `frontend/src/lib/backend.ts` FOUND with Bearer + getSessionToken
- Commits `df76c32`, `5c1edd4`, `6568acd`, `faed916` FOUND in `git log`
- `node --test tests/officer-auth.test.mjs` — 13/13 pass
- `npm run build` — routes include `/dashboard/reports/[reportId]`

---
*Phase: 02-public-experience*
*Completed: 2026-07-20*
