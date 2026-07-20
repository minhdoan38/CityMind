---
phase: 04-citizen-status
plan: "02"
subsystem: frontend
tags: [nextjs, bff, next-intl, citizen-status, clinic-blue, access-tokens]

requires:
  - phase: 04-citizen-status
    provides: "POST /api/v1/reports/status hash verify + citizen DTO + status rate limiter (04-01)"
  - phase: 02-public-experience
    provides: "Success flash token + public civic chrome + localePrefix always"
provides:
  - "Public BFF POST /api/public/reports/status with XFF + Retry-After passthrough"
  - "Bilingual /[locale]/status form with query prefill and one-shot auto-fetch"
  - "Locale-prefixed success statusPrepValue and unprefixed /status redirect"
affects:
  - 04-citizen-status
  - 04-03 officer copy-link

tech-stack:
  added: []
  patterns:
    - "JSON public BFF mirrors analyze XFF peel; forward Retry-After on 429"
    - "Client-side status lookup keeps token out of RSC data fetches"
    - "401/429/network map to single catalog strings (no existence leak)"

key-files:
  created:
    - frontend/tests/citizen-status.test.mjs
    - frontend/src/app/api/public/reports/status/route.ts
    - frontend/src/app/[locale]/status/page.tsx
    - frontend/src/app/status/page.tsx
  modified:
    - frontend/messages/en.json
    - frontend/messages/vi.json
    - frontend/src/app/[locale]/report/success/page.tsx

key-decisions:
  - "Client fetch + Suspense/useSearchParams for deep-link auto-fetch (RESEARCH A1)"
  - "statusLinkPrep updated to live UI-SPEC copy in Task 2 catalog drop"
  - "Added statusValue* EN/VI labels for badge human text (new/reviewing/resolved/rejected)"

patterns-established:
  - "Public status error UI branches only on HTTP class: 401 vs 429 vs other"
  - "Unprefixed public routes preserve reportId/token query when bouncing to /en/…"

requirements-completed: [CIT-01, CIT-02, CIT-03, CIT-04]

coverage:
  - id: D1
    description: "Locale status page + public BFF with XFF forward and catalog keys"
    requirement: CIT-01
    verification:
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#locale status page exists under app/[locale]/status"
        status: pass
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#public status BFF forwards X-Forwarded-For to FastAPI"
        status: pass
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#public.status* catalog keys exist with identical EN/VI trees"
        status: pass
    human_judgment: false
  - id: D2
    description: "Generic 401/429/network messaging with no existence-leak variants"
    requirement: CIT-03
    verification:
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#public.status* catalog keys exist with identical EN/VI trees"
        status: pass
      - kind: other
        ref: "frontend/src/app/[locale]/status/page.tsx maps 401→statusVerifyFailed, 429→statusRateLimited"
        status: pass
    human_judgment: false
  - id: D3
    description: "Success locale-prefixed status prep URL and unprefixed /status redirect preserving query"
    requirement: CIT-01
    verification:
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#success page builds locale-prefixed status prep URL"
        status: pass
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#unprefixed /status redirects to /en/status preserving query"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deep-link auto-fetch and bilingual civic UI against live Track A API"
    requirement: CIT-02
    verification: []
    human_judgment: true
    rationale: "Requires running backend + known reportId/token flash; browser EN/VI visual check not covered by filesystem smoke tests"

duration: 5min
completed: 2026-07-20
status: complete
---

# Phase 4 Plan 02: Citizen Status BFF + UI Summary

**Next public status BFF, Clinic Blue bilingual `/[locale]/status` lookup with one-shot deep-link auto-fetch, and locale-prefixed success deep links.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-20T14:11:18Z
- **Completed:** 2026-07-20T14:16:17Z
- **Tasks:** 3/3
- **Files modified:** 7

## Accomplishments

- Delivered Track B frontend vertical slice for CIT-01 plus client UX for CIT-02/03/04.
- Status BFF forwards X-Forwarded-For / X-Real-Ip and preserves Retry-After on 429.
- Success page now copies `/{locale}/status?reportId=&token=`; bare `/status` redirects to `/en/status` with query intact.

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing frontend smoke for status route, BFF, and catalog keys** - `df299d8` (test)
2. **Task 2: Public BFF + bilingual status page form, auto-fetch, and result panel** - `104ddde` (feat)
3. **Task 3: Unprefixed /status redirect + success locale URL fix** - `c9a77e6` (feat)

**Plan metadata:** _(pending docs commit)_

## Files Created/Modified

- `frontend/tests/citizen-status.test.mjs` — filesystem/catalog smoke for status surface
- `frontend/src/app/api/public/reports/status/route.ts` — JSON BFF proxy to FastAPI `/status`
- `frontend/src/app/[locale]/status/page.tsx` — civic form, auto-fetch, result/history panel
- `frontend/src/app/status/page.tsx` — unprefixed redirect with query preservation
- `frontend/messages/en.json` / `vi.json` — `public.status*` + `statusValue*` keys; live `statusLinkPrep`
- `frontend/src/app/[locale]/report/success/page.tsx` — `useLocale` status prep URL

## Decisions Made

- Prefer client `fetch` for tokenized lookup (RESEARCH A1) with Suspense around `useSearchParams`.
- Map only HTTP status classes to catalog strings; ignore backend `detail` text for 401.
- Add `statusValueNew|Reviewing|Resolved|Rejected` for badge labels (UI-SPEC bilingual human labels).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Bilingual status value labels**
- **Found during:** Task 2
- **Issue:** UI-SPEC requires badge + human EN/VI label; copywriting table listed page chrome keys only.
- **Fix:** Added `statusValue*` catalog keys and `t.has` lookup with raw-status fallback.
- **Files modified:** `frontend/messages/en.json`, `frontend/messages/vi.json`, `frontend/src/app/[locale]/status/page.tsx`
- **Commit:** `104ddde`

**2. [Rule 3 - Blocking] statusLinkPrep updated with Task 2 catalog drop**
- **Found during:** Task 2
- **Issue:** Task 2 verification required live `statusLinkPrep` assert; Task 3 also listed the copy update.
- **Fix:** Applied UI-SPEC live wording in Task 2 message commit; Task 3 focused on redirect + success URL.
- **Files modified:** `frontend/messages/en.json`, `frontend/messages/vi.json`
- **Commit:** `104ddde`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 3). **Impact:** No scope expansion into officer copy (04-03).

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

Ready for **04-03** (officer “Copy status link”). Do not re-issue tokens. Manual UAT: deep-link auto-fetch with a real success flash token on `/en/status` and `/vi/status`.

## TDD Gate Compliance

1. RED: `df299d8` — `test(04-02): add failing smoke for citizen status UI`
2. GREEN: `104ddde` — BFF + status page + catalog
3. GREEN: `c9a77e6` — redirect + success locale URL

## Self-Check: PASSED

- `frontend/src/app/api/public/reports/status/route.ts` — FOUND
- `frontend/src/app/[locale]/status/page.tsx` — FOUND
- `frontend/src/app/status/page.tsx` — FOUND
- `frontend/tests/citizen-status.test.mjs` — FOUND
- Commits `df299d8`, `104ddde`, `c9a77e6` — FOUND
- `node --test tests/citizen-status.test.mjs tests/public-shell.test.mjs` — 15 passed
- `npm run lint` — clean

---
*Phase: 04-citizen-status*
*Completed: 2026-07-20*
