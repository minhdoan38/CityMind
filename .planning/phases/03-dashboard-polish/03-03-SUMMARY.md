---
phase: 03-dashboard-polish
plan: "03"
subsystem: ui
tags: [shadcn-dialog, status-actions, detail-page, next-intl, advisory-ai]

requires:
  - phase: 03-dashboard-polish
    provides: Note-gated status API + actor_id in status_history (Plan 03-01)
  - phase: 04-citizen-status
    provides: CopyStatusLink on detail (preserved)
provides:
  - "D-19 detail section hierarchy with advisory AI panel"
  - "Actor-aware newest-first status timeline"
  - "Dialog note-gated resolve/reject; reviewing immediate"
  - "EN/VI detail + resolve catalog keys (room left for 03-04 export)"
affects:
  - 03-04 export button/BFF
  - Phase 3 UAT / verification

tech-stack:
  added: ["shadcn dialog"]
  patterns:
    - "reviewing PATCHes immediately; resolved/rejected open Dialog with required note"
    - "Soft-accent AI panel + disclaimer Alert — never primary authority chrome"
    - "Timeline actor from API actor_id (truncated) or Officer label — never form-collected"

key-files:
  created:
    - frontend/src/components/ui/dialog.tsx
    - frontend/tests/dashboard-detail.test.mjs
  modified:
    - frontend/src/app/dashboard/reports/[reportId]/page.tsx
    - frontend/src/components/StatusActions.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json

key-decisions:
  - "Preserve CopyStatusLink on detail header (DASH-08 Phase 4) — do not remove"
  - "Evidence section owns image + signals; AI panel owns summary/recommendation/uncertainty"
  - "No ExportButton keys beyond resolve/detail — leave room for 03-04"

patterns-established:
  - "StatusActions: Dialog only when note required; Keep editing is no-op"
  - "Detail RSC uses getTranslations('dashboard') for section copy"

requirements-completed: [DASH-04, DASH-05, DASH-07]

duration: 5min
completed: 2026-07-20
---

# Phase 3 Plan 03: Detail Polish + Note-Gated Resolve Summary

**Detail page reordered per D-19 with advisory AI and actor timeline; resolve/reject now require a Dialog decision note while reviewing stays one-click.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-20T16:02:39Z
- **Completed:** 2026-07-20T16:08:00Z
- **Tasks:** 2/2 (TDD RED + GREEN each)
- **Files modified:** 6

## Accomplishments

- Reshuffled `/dashboard/reports/[reportId]` to header → citizen → evidence → AI advisory → urban → timeline → StatusActions; preserved CopyStatusLink.
- Soft-accent AI panel with UI-SPEC advisory title/disclaimer; timeline shows truncated `actor_id` or Officer.
- Replaced one-click StatusActions with reviewing immediate PATCH + Dialog-gated resolved/rejected (required trimmed note, 422 → catalog validation, Keep editing no-op).
- Extended EN/VI `dashboard.*` with detail + resolve keys only (export keys reserved for 03-04).

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `58de134` — test(03-03): add failing smoke for detail hierarchy
2. **Task 1 GREEN:** `bbfe9a3` — feat(03-03): reorder detail hierarchy with advisory AI
3. **Task 2 RED:** `4d00f82` — test(03-03): add failing Dialog note-gate assertions
4. **Task 2 GREEN:** `069f2d6` — feat(03-03): gate resolve/reject with Dialog note

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `frontend/src/app/dashboard/reports/[reportId]/page.tsx` — D-19 hierarchy, actor timeline, i18n
- `frontend/src/components/StatusActions.tsx` — Dialog note gate
- `frontend/src/components/ui/dialog.tsx` — shadcn Dialog primitive
- `frontend/messages/en.json` / `vi.json` — detail + resolve copy
- `frontend/tests/dashboard-detail.test.mjs` — smoke assertions

## Decisions Made

- Kept CopyStatusLink on detail (Phase 4 DASH-08) despite Phase 3 CONTEXT deferral language — already shipped.
- Evidence vs AI split: image + evidence signals in Evidence; uncertainty under AI advisory panel.
- Client note validation + server 422 both surface `noteRequired` (T-03-09 / T-03-11).

## Deviations from Plan

None - plan executed exactly as written for in-scope tasks.

### Out-of-scope discovery (deferred)

**Pre-existing build break:** `npm run build` fails on missing `@/components/ReportStarterBar` imported by `[locale]/page.tsx`. Not caused by 03-03 changes; logged in `deferred-items.md`. Smoke tests + lint for this plan pass.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Detail + Dialog deliverables complete; full frontend build remains blocked by unrelated public Home import.

## Issues Encountered

- Production `next build` blocked by missing ReportStarterBar (pre-existing). Documented under deferred items; did not invent stub (out of 03-03 scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 03-04 (export UI/BFF) in parallel/next — catalogs have room for export keys.
- Smoke: open detail → section order → Mark reviewing (no dialog) → Resolve Dialog empty blocked → note confirm refreshes timeline → Reject Keep editing leaves status unchanged.

## Threat Flags

None — status BFF note forwarding unchanged; actor not collected in UI (T-03-10 mitigated).

## Known Stubs

None.

## Self-Check: PASSED

- Files: dialog.tsx, StatusActions.tsx, detail page, dashboard-detail.test.mjs, 03-03-SUMMARY.md — present
- Commits: 58de134, bbfe9a3, 4d00f82, 069f2d6 — present
