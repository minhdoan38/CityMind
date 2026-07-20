---
phase: 04-citizen-status
plan: "03"
subsystem: frontend
tags: [nextjs, next-intl, clipboard, officer-dashboard, DASH-08, access-tokens]

requires:
  - phase: 04-citizen-status
    provides: "Public /[locale]/status lookup + BFF (04-02)"
  - phase: 03-dashboard-polish
    provides: "Officer report detail header chrome"
provides:
  - "CopyStatusLink reportId-only absolute status URL (no token)"
  - "Muted recovery hint that full tokenized link is unrecoverable"
  - "dashboard.copyStatus* EN/VI catalog keys + clipboard live region"
affects:
  - 04-citizen-status
  - officer share UX

tech-stack:
  added: []
  patterns:
    - "Officer copy builds {origin}/en/status?reportId= only — never appends token="
    - "Copy→Check ~2s + role=status aria-live polite for clipboard feedback"
    - "Dashboard layout wraps NextIntlClientProvider so dashboard.* catalogs work"

key-files:
  created:
    - frontend/src/components/CopyStatusLink.tsx
  modified:
    - frontend/src/app/dashboard/reports/[reportId]/page.tsx
    - frontend/src/app/dashboard/layout.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json
    - frontend/tests/citizen-status.test.mjs

key-decisions:
  - "Share URL locale hard-coded to en while dashboard remains unlocalized (RESEARCH A5 / D-14a)"
  - "Wrapped dashboard layout in NextIntlClientProvider so CopyStatusLink and sidebar translations resolve"
  - "No token re-issue UI — recovery hint only (D-14c deferred)"

patterns-established:
  - "DASH-08 clipboard control lives in detail header/meta near report id, not only beside StatusActions"
  - "Honest reportId-only share links; citizen keeps original success-page tokenized URL"

requirements-completed: [DASH-08]

coverage:
  - id: D1
    description: "CopyStatusLink builds absolute /{locale}/status?reportId= URL with no token query param"
    requirement: DASH-08
    verification:
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#CopyStatusLink builds reportId-only status URL without token"
        status: pass
    human_judgment: false
  - id: D2
    description: "Detail header wires CopyStatusLink near report id / status with recovery hint catalog"
    requirement: DASH-08
    verification:
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#dashboard detail page wires CopyStatusLink in header/meta"
        status: pass
      - kind: unit
        ref: "frontend/tests/citizen-status.test.mjs#dashboard.copyStatus* catalog keys exist with identical EN/VI trees"
        status: pass
    human_judgment: false
  - id: D3
    description: "Manual clipboard paste shows reportId-only URL; live region announces Link copied"
    requirement: DASH-08
    verification:
      - kind: manual_procedural
        ref: "Officer detail → Copy status link → paste /en/status?reportId=…; hint visible; aria-live Link copied"
        status: unknown
    human_judgment: true
    rationale: "Clipboard paste and live-region announcement require a real browser session"

duration: 15min
completed: 2026-07-20
status: complete
---

# Phase 4 Plan 03: Officer Copy Status Link Summary

**Officer detail “Copy status link” copies an absolute reportId-only `/en/status?reportId=` URL with bilingual clipboard feedback and an always-visible recovery hint — never reconstructs or re-issues tokens (DASH-08 / D-13..D-15).**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-20T14:17:30Z
- **Completed:** 2026-07-20T14:32:00Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Smoke coverage for DASH-08 (reportId-only URL, no `token=`, dashboard catalog keys, detail wiring)
- `CopyStatusLink` client control with Copy→Check swap, `aria-live` “Link copied”, muted recovery hint
- Detail header placement near report ID; EN/VI `dashboard.copyStatus*` keys; dashboard next-intl provider

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing smoke for Copy status link reportId-only URL and catalog keys** - `02f559d` (test)
2. **Task 2: CopyStatusLink in detail header + recovery hint + EN/VI feedback** - `3c9a036` (feat)

**Plan metadata:** `0965a83` (docs: complete plan)

## Files Created/Modified

- `frontend/src/components/CopyStatusLink.tsx` — reportId-only clipboard + recovery hint + live region
- `frontend/src/app/dashboard/reports/[reportId]/page.tsx` — header/meta wiring
- `frontend/src/app/dashboard/layout.tsx` — NextIntlClientProvider for dashboard catalogs
- `frontend/messages/en.json` / `vi.json` — `copyStatusLink`, `statusLinkCopied`, `statusLinkRecoveryHint`
- `frontend/tests/citizen-status.test.mjs` — DASH-08 smoke asserts

## Decisions Made

- Default share locale to `en` while the officer dashboard stays unlocalized (D-14a / RESEARCH A5)
- Provide `NextIntlClientProvider` on dashboard layout so `useTranslations("dashboard")` works for CopyStatusLink (and existing sidebar/locale chrome)
- Explicitly omit token re-issue / rotation UI (D-14c)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] NextIntlClientProvider on dashboard layout**
- **Found during:** Task 2 (CopyStatusLink + EN/VI feedback)
- **Issue:** Dashboard routes were outside `[locale]` layout, so `useTranslations("dashboard")` had no client provider (same gap already present for `DashboardSidebar` / `LocaleSwitcher`).
- **Fix:** Wrap dashboard layout with `NextIntlClientProvider` using `getLocale()` + `getMessages()`.
- **Files modified:** `frontend/src/app/dashboard/layout.tsx`
- **Verification:** `npm run lint` clean; smoke tests pass
- **Committed in:** `3c9a036`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Required for bilingual D-15 feedback on the unlocalized dashboard; no scope creep beyond DASH-08.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 4 plans complete (01–03). Ready for phase verify / next milestone step. Manual UAT: open an officer detail page → Copy status link → paste confirms `/en/status?reportId=…` with no token → recovery hint visible → live region announces Link copied.

---
*Phase: 04-citizen-status*
*Completed: 2026-07-20*

## Self-Check: PASSED

- CopyStatusLink.tsx present
- Detail page wires CopyStatusLink
- Commits 02f559d (test) and 3c9a036 (feat) present
- Smoke: 8/8 pass; lint clean
