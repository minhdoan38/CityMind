---
phase: 02-public-experience
plan: "04"
subsystem: ui
tags: [react-hook-form, zod, next-intl, sessionStorage, report-form, shadcn]

requires:
  - phase: 02-public-experience
    provides: "Locale-prefixed public routes and Home catalogs (02-02); AnalyzeResponse.access_token soft contract (02-01)"
provides:
  - "RHF+Zod ReportForm with analyzing disabled submit"
  - "One-time sessionStorage success flash (reportId + accessToken)"
  - "Locale /report and /report/success surfaces with UI-SPEC catalogs"
affects:
  - "Phase 4 citizen status lookup (status-link prep only)"
  - "02-05 dashboard UX (unrelated track)"

tech-stack:
  added:
    - "react-hook-form@7.82.0"
    - "zod@4.4.3"
    - "@hookform/resolvers@5.4.0"
    - "shadcn form/textarea/badge"
  patterns:
    - "sessionStorage citymind:report-success flash then locale router push (never query token)"
    - "Soft A→B: map API report_id/access_token → flash reportId/accessToken; surface formErrorNetwork if absent"

key-files:
  created:
    - frontend/src/app/[locale]/report/page.tsx
    - frontend/src/app/[locale]/report/success/page.tsx
    - frontend/src/components/ui/form.tsx
    - frontend/src/components/ui/textarea.tsx
    - frontend/src/components/ui/badge.tsx
    - frontend/tests/report-form.test.mjs
  modified:
    - frontend/src/components/ReportForm.tsx
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/messages/en.json
    - frontend/messages/vi.json

key-decisions:
  - "Exact npm pins react-hook-form@7.82.0 / zod@4.4.3 / @hookform/resolvers@5.4.0 after blocking human checkpoint"
  - "Flash payload uses camelCase reportId/accessToken; maps from API snake_case access_token (soft A→B)"
  - "radix-nova registry form stub empty — adapted new-york Form helpers onto radix-ui Slot"

patterns-established:
  - "Pattern: one-shot sessionStorage flash + clear-on-read success page redirect"
  - "Pattern: RHF FormField + Zod refine for optional image MIME/size (8MB advisory)"

requirements-completed: [PUB-03, PUB-04, PUB-06]

coverage:
  - id: D1
    description: "Report form validates with RHF+Zod, optional location, analyzing disabled submit, navigates to locale success"
    requirement: PUB-03
    verification:
      - kind: unit
        ref: "frontend/tests/report-form.test.mjs#ReportForm uses RHF+Zod, analyzing state, and sessionStorage flash (PUB-03/04)"
        status: pass
      - kind: other
        ref: "cd frontend && npm run lint && npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Success page shows report ID + access token once via sessionStorage flash with copy + status-link prep (no query token)"
    requirement: PUB-04
    verification:
      - kind: unit
        ref: "frontend/tests/report-form.test.mjs#success page one-shot flash, redirect, copy live region, status prep (D-11/D-18)"
        status: pass
    human_judgment: true
    rationale: "Live submit→success smoke (token once, URL clean) needs browser after Plan 02-01 green"
  - id: D3
    description: "Report/Success EN/VI catalog strings from UI-SPEC (PUB-06)"
    requirement: PUB-06
    verification:
      - kind: unit
        ref: "frontend/tests/report-form.test.mjs#Report/Success catalog strings match UI-SPEC (PUB-06)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-20
status: complete
---

# Phase 2 Plan 04: Report Form + Success Flash Summary

**RHF+Zod ReportForm with sessionStorage one-shot token flash to locale `/report/success` (no query-string token)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-20T12:11:07Z
- **Completed:** 2026-07-20T12:19:19Z
- **Tasks:** 2/2 (Task 1 human checkpoint pre-approved; Task 2 TDD)
- **Files modified:** 11

## Accomplishments

- Installed exact approved pins and shadcn form/textarea/badge; rebuilt ReportForm with Zod max 3000, optional location helper, 8MB image refine, Analyzing… disabled submit
- Success route consumes `citymind:report-success` once, redirects if missing, copy buttons with aria-live, status-link prep (Phase 4 deferred)
- Extended EN/VI catalogs with UI-SPEC Report/Success copy while preserving Home keys

## Task Commits

1. **Task 1: Approve React Hook Form stack package identities** — human `approved` (blocking checkpoint; no install commit)
2. **Task 2 (RED): add failing report-form contract tests** — `f89764c` (test)
3. **Task 2 (GREEN): rebuild ReportForm with RHF success flash** — `c8b6d4b` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `frontend/src/components/ReportForm.tsx` — RHF+Zod multipart analyze submit + flash handoff
- `frontend/src/app/[locale]/report/page.tsx` — civic light report shell
- `frontend/src/app/[locale]/report/success/page.tsx` — one-time token display
- `frontend/src/components/ui/{form,textarea,badge}.tsx` — shadcn pieces
- `frontend/messages/{en,vi}.json` — Report/Success strings
- `frontend/package.json` + lockfile — exact RHF stack pins
- `frontend/tests/report-form.test.mjs` — contract tests

## Decisions Made

- Used approved exact pins only (no caret WIP leftovers)
- Soft A→B: require both `report_id` and `access_token` before flash; otherwise show `formErrorNetwork`
- Form registry empty for radix-nova — shipped adapted Form helpers using `radix-ui` Slot

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted Form UI because radix-nova registry form is empty**
- **Found during:** Task 2 (shadcn add form)
- **Issue:** `npx shadcn add form` no-ops for radix-nova (registry item has no files)
- **Fix:** Wrote Form helpers from new-york pattern using project `radix-ui` Slot + existing Label
- **Files modified:** `frontend/src/components/ui/form.tsx`
- **Verification:** lint + build pass; tests assert form.tsx exists
- **Committed in:** `c8b6d4b`

**2. [Rule 1 - Bug] Client image limit aligned to backend 8MB**
- **Found during:** Task 2 (WIP reconcile)
- **Issue:** WIP used 5MB; backend/PATTERNS use `max_image_bytes` 8MB
- **Fix:** Schema + helper path use `8 * 1024 * 1024`
- **Files modified:** `frontend/src/components/ReportForm.tsx`
- **Verification:** contract test asserts 8MB constant
- **Committed in:** `c8b6d4b`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Required for install/build correctness and server-aligned validation; no scope creep.

## Authentication Gates

None — Task 1 package checkpoint was pre-approved by user resume-signal `approved`.

## Issues Encountered

- Parallel Wave 2 work touched Home messages/page; scoped commits avoided `proxy.ts`, `/login`, `/dashboard`. Message catalogs include both Report/Success keys and concurrent Home keys present in the working tree at commit time.

## TDD Gate Compliance

- RED: `f89764c` `test(02-04): add failing report-form contract tests`
- GREEN: `c8b6d4b` `feat(02-04): rebuild ReportForm with RHF success flash`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 02-05 (dashboard cards) and live smoke of submit→success once Track A analyze returns `access_token`
- Soft A→B contract documented; status lookup UI remains Phase 4

## Self-Check: PASSED

- FOUND: `frontend/src/components/ReportForm.tsx`
- FOUND: `frontend/src/app/[locale]/report/page.tsx`
- FOUND: `frontend/src/app/[locale]/report/success/page.tsx`
- FOUND: `frontend/tests/report-form.test.mjs`
- FOUND: commits `f89764c`, `c8b6d4b`
- VERIFY: `node --test tests/report-form.test.mjs tests/public-shell.test.mjs` pass; `npm run lint` pass; `npm run build` pass

---
*Phase: 02-public-experience*
*Completed: 2026-07-20*
