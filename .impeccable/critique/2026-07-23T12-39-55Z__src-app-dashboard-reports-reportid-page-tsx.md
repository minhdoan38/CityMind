---
target: dashboard report detail page
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-07-23T12-39-55Z
slug: src-app-dashboard-reports-reportid-page-tsx
---
# Critique: Dashboard report detail

**Target:** `src/app/dashboard/reports/[reportId]/page.tsx` (live: `/dashboard/reports/[id]`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Badges communicate triage/routing; status PATCH has no persistent success toast after refresh |
| 2 | Match System / Real World | 3 | Impact humanized; shadow panel + table headers still engineer-facing English |
| 3 | User Control and Freedom | 3 | Back link + resolve/reject dialog cancel; no undo after status change |
| 4 | Consistency and Standards | 3 | Aligns with dashboard cards/badges; hero tool row denser than list page |
| 5 | Error Prevention | 4 | Resolve/reject require note in dialog — strong guardrail |
| 6 | Recognition Rather Than Recall | 2 | Officer must scroll/recall context; metrics lack semantic `dl` grouping |
| 7 | Flexibility and Efficiency | 2 | No keyboard jump to decision panel; tab order follows DOM (main before aside) |
| 8 | Aesthetic and Minimalist Design | 2 | Many equal-weight sections; empty Urban context + Status history add noise |
| 9 | Error Recovery | 3 | StatusActions surfaces errors; history load failure has alert |
| 10 | Help and Documentation | 3 | Advisory copy present; copy-link recovery hint is long in hero |
| **Total** | | **28/40** | **Good — solid foundation, desktop density issues** |

## Anti-Patterns Verdict

**LLM:** Does not read as generic AI slop. Civic product register is respected: restrained blue, surface cards, no gradient text, no hero-metric cliché. Remaining tell is **card-stack sameness** — eight similarly styled sections in the main column.

**Detector:** 1 warning — `transition: width` on `.report-analyze-progress-fill` in `globals.css` (~L925); unrelated to this page but shared stylesheet.

**Browser overlays:** Skipped — `detect.js` injection not run (no live-server inject in this session). Manual desktop screenshot reviewed.

## Overall Impression

Desktop layout is usable and the sticky **Officer decision** rail is the right call. The page still feels longer than the task requires: officers see the decision panel while the main column repeats information they already scanned in the table. Biggest win: **tighten information hierarchy and keyboard path to action**.

## What's Working

1. **Sticky decision aside** — Primary actions stay visible while reviewing evidence on wide screens.
2. **Split metrics** — Priority/Severity/Confidence row + full-width Impact avoids the earlier overflow failure.
3. **Advisory framing** — AI disclaimer in the analysis section matches product trust model.

## Priority Issues

### [P1] Keyboard tab order buries officer actions
- **Why:** DOM order is main column (10+ sections) then aside. Keyboard users tab through the entire report before reaching Mark as reviewing.
- **Fix:** Move `<aside>` before `.reports-detail-main` in DOM and use CSS `order` for visual placement, or add a skip link / landmark shortcut.
- **Command:** `/impeccable adapt` + `/impeccable harden`

### [P1] Empty sections still consume vertical space
- **Why:** Urban context and Status history render full cards even when empty — adds scroll on desktop without value.
- **Fix:** Collapse to compact empty states or hide until data exists; keep timeline placeholder only when history errors.
- **Command:** `/impeccable distill`

### [P2] Hero tool cluster competes with title
- **Why:** Badges + agent console link + copy button + recovery hint + advisory line stack before metrics — high cognitive load at entry.
- **Fix:** Move copy link + hint into aside or a compact "Share" menu; keep hero to title, meta, badges, one-line advisory.
- **Command:** `/impeccable layout`

### [P2] Shadow comparison panel not localized
- **Why:** Hardcoded English in `ShadowComparisonPanel` breaks bilingual EN/VI parity.
- **Fix:** Move strings to `dashboard.triage` or `dashboard` messages.
- **Command:** `/impeccable harden`

### [P2] Metrics lack semantic structure
- **Why:** Labels/values are `<p>` pairs; screen readers don't announce as a definition list.
- **Fix:** Use `<dl>` / `<dt>` / `<dd>` for metric strip and impact row.
- **Command:** `/impeccable audit` (a11y pass)

## Persona Red Flags

**Alex (Power User):** No shortcut to jump to decision actions. Must scroll past empty Urban context. Reviewing → no bulk or next-report navigation.

**Sam (Accessibility):** Tab order reaches Officer decision after entire main column. Metric labels rely on visual proximity only. Timeline status uses `capitalize` on raw DB status strings (may read oddly in screen readers).

**Officer reviewer (domain):** Mixed EN citizen text + VI AI facts without locale labels may slow verification. Raw lat/long without map forces mental geography work.

## Minor Observations

- `formatDate` hardcoded to `en-GB` regardless of officer locale.
- Category title relies on `text-transform: capitalize` instead of display formatting at data layer.
- Evidence image uses generic alt text, not report-specific.

## Questions to Consider

- What if Urban context and empty timeline were removed from the default view entirely?
- Should the decision panel be the first landmark on desktop, not just visually sticky?
- Would a single "Case summary" block replace Citizen + Observed + Unknowns for faster scanning?
