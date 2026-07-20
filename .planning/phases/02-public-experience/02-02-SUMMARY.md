---
phase: 02-public-experience
plan: "02"
subsystem: ui
tags: [next-intl, i18n, localePrefix, home, bilingual, proxy]

requires:
  - phase: 01-supabase-foundation
    provides: next-intl scaffold, Phase 1 tokens, proxy.ts filename convention
provides:
  - Always-prefix EN/VI public App Router Home under app/[locale]
  - createNavigation helpers + locale-only proxy.ts seam for Plan 02-03
  - EN/VI Home message catalogs with identical key trees
affects:
  - 02-03 (dashboard auth composition on proxy.ts)
  - 02-04 (Report/success under [locale])

tech-stack:
  added: []
  patterns:
    - "localePrefix: always + Accept-Language via next-intl middleware"
    - "proxy.ts locale-only seam; dashboard getClaims deferred to 02-03"
    - "createNavigation for locale Links; next/link for /login outside [locale]"

key-files:
  created:
    - frontend/src/i18n/navigation.ts
    - frontend/src/app/[locale]/layout.tsx
    - frontend/src/app/[locale]/page.tsx
  modified:
    - frontend/src/i18n/routing.ts
    - frontend/src/i18n/request.ts
    - frontend/src/proxy.ts
    - frontend/src/services/locale.ts
    - frontend/src/components/LocaleSwitcher.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json
    - frontend/src/app/page.tsx
    - frontend/src/app/report/page.tsx
    - frontend/src/app/layout.tsx
    - frontend/src/app/globals.css
    - frontend/next.config.ts
    - frontend/tests/public-shell.test.mjs

key-decisions:
  - "Reconciled existing Phase 2 WIP instead of rewriting; closed D-03/D-06 gaps (separate Instructions + 5 steps)"
  - "Officer sign-in uses next/link to /login so login stays outside [locale]"
  - "proxy.ts is intl-only this plan; Phase 1 dashboard auth removed here for D-17 — Plan 02-03 restores getClaims"

patterns-established:
  - "Pattern: public routes under app/[locale]; /login and /dashboard remain unprefixed"
  - "Pattern: LocaleSwitcher via createNavigation replace(pathname, { locale })"

requirements-completed: [PUB-01, PUB-02, PUB-06]

coverage:
  - id: D1
    description: Always-prefix next-intl routing (en/vi) with Accept-Language detection and createNavigation helpers
    requirement: PUB-02
    verification:
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#routing uses en/vi with localePrefix always (D-13)
        status: pass
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#createNavigation helpers are exported for prefixed Link/router
        status: pass
    human_judgment: false
  - id: D2
    description: Locale-only proxy.ts next-intl seam that does not gate public Home/report (D-17)
    requirement: PUB-02
    verification:
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#proxy.ts is locale-only next-intl seam (D-17 / Plan 02-03 auth later)
        status: pass
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#login and dashboard stay outside app/[locale]
        status: pass
    human_judgment: false
  - id: D3
    description: Bilingual Home under [locale] with D-01–D-08 content contract (hero CTA, advisory, section order, civic light UI)
    requirement: PUB-01
    verification:
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#localized Home implements D-01–D-08 content contract
        status: pass
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#Home catalogs include UI-SPEC public copy keys (PUB-01/02/06)
        status: pass
    human_judgment: true
    rationale: "Visual polish (full-bleed hero atmosphere, civic light tone, 44px CTA focus) needs human smoke of /en and /vi"
  - id: D4
    description: EN/VI message catalogs share identical key trees for Home/navigation namespaces
    requirement: PUB-06
    verification:
      - kind: unit
        ref: frontend/tests/public-shell.test.mjs#EN/VI catalogs share identical key trees
        status: pass
      - kind: other
        ref: "node -e walk(en)===walk(vi) key parity"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-20
status: complete
---

# Phase 2 Plan 02: Track B i18n + Home Summary

**Always-prefix EN/VI Home under `app/[locale]` with next-intl `localePrefix: 'always'`, UI-SPEC catalogs, and a locale-only `proxy.ts` seam for Plan 02-03**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-20T12:03:51Z
- **Completed:** 2026-07-20T12:07:05Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Migrated next-intl to `localePrefix: 'always'` with Accept-Language detection, `createNavigation`, and `requestLocale` message loading
- Established locale-only `proxy.ts` composition (intl middleware; login/dashboard bypass; no public-route auth gate)
- Shipped bilingual Home (D-01–D-08): full-bleed civic hero, Report CTA → `/report`, AI advisory, How it works → Instructions (5 steps) → About → Contact → Footer
- EN/VI catalogs share identical key trees with natural VI Home copy; unprefixed `/` and `/report` redirect into prefixes

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate always-prefix routing and locale proxy seam**
   - `5d20d62` test(02-02): add public-shell always-prefix routing tests
   - `ec3018e` feat(02-02): migrate always-prefix routing and locale proxy seam
2. **Task 2: Ship bilingual Home and EN/VI catalogs**
   - `762c012` test(02-02): extend public-shell Home and catalog contract tests
   - `25089fc` feat(02-02): ship bilingual Home and EN/VI catalogs

**Plan metadata:** see docs commit after SUMMARY self-check

## Files Created/Modified

- `frontend/src/i18n/routing.ts` — `localePrefix: 'always'`, `localeDetection: true`
- `frontend/src/i18n/navigation.ts` — `createNavigation` Link/redirect/usePathname/useRouter
- `frontend/src/i18n/request.ts` — `requestLocale` + message import
- `frontend/src/proxy.ts` — next-intl middleware seam; bypass login/dashboard/api
- `frontend/src/app/[locale]/layout.tsx` — locale layout + `setRequestLocale` / `generateStaticParams`
- `frontend/src/app/[locale]/page.tsx` — bilingual Home per D-01–D-08
- `frontend/messages/{en,vi}.json` — Home namespaces + key parity
- `frontend/src/components/LocaleSwitcher.tsx` — prefix-preserving switch via createNavigation
- `frontend/src/app/page.tsx` / `frontend/src/app/report/page.tsx` — redirects into `/en…`
- `frontend/tests/public-shell.test.mjs` — routing, proxy, Home, catalog tests

## Decisions Made

- Reconciled existing WIP (keep) rather than wipe: strengthened tests, split Instructions, added 5th step, fixed officer `/login` to non-prefixed `next/link`
- Left `[locale]/report/*` and ReportForm RHF work for Plan 02-04 (parallel scope)
- Cookie `services/locale.ts` retained as secondary helper; URL prefixes own active locale

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Officer sign-in used locale Link to `/login`**
- **Found during:** Task 2 (Home shell reconcile)
- **Issue:** `createNavigation` Link would prefix `/login` → `/en/login`, but login must stay outside `[locale]`
- **Fix:** Header/footer officer links use `next/link` with absolute `/login`
- **Files modified:** `frontend/src/app/[locale]/page.tsx`
- **Verification:** public-shell Home contract test asserts `next/link` + `href="/login"`
- **Committed in:** `25089fc`

**2. [Rule 2 - Missing Critical] How it works and Instructions were one section; only 4 steps**
- **Found during:** Task 2 vs D-03/D-06 / UI-SPEC
- **Issue:** Combined section + missing step 5 violated locked content contract
- **Fix:** Separate sections; five UI-SPEC instruction steps; contact “coming soon” copy
- **Files modified:** `frontend/src/app/[locale]/page.tsx`, `frontend/messages/en.json`, `frontend/messages/vi.json`
- **Verification:** Home catalog + D-01–D-08 tests pass
- **Committed in:** `25089fc`

**3. [WIP reconcile] TDD RED already green**
- **Found during:** Task 1
- **Issue:** Working tree already had always-prefix routing/proxy; characterization tests passed immediately
- **Fix:** Documented; still committed test → feat sequence and closed remaining gaps in Task 2
- **Impact:** No false RED; reconcile mode honored

---

**Total deviations:** 2 auto-fixed (Rule 2) + 1 documented WIP/TDD note  
**Impact on plan:** Correctness for D-03/D-06/D-17 and login outside locale; no scope creep into ReportForm/auth

## Issues Encountered

None blocking. Parallel Plan 02-01 commits landed between Task 1 and Task 2 on `main`; 02-02 commits remained scoped to i18n/Home files only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for Plan 02-03 to compose dashboard `getClaims()` onto `proxy.ts` without regressing locale middleware
- Ready for Plan 02-04 to mount Report/success under `[locale]` (partial WIP already present — leave for 02-04)
- Human smoke recommended: `/en`, `/vi`, locale switcher path preserve, Report CTA, officer link → `/login`

## Self-Check: PASSED

- Key artifacts present on disk
- Commits `5d20d62`, `ec3018e`, `762c012`, `25089fc` present in git log
- `node --test tests/public-shell.test.mjs` — 10/10 pass
- EN/VI key parity command — pass
- `npm run lint` — pass

---
*Phase: 02-public-experience*
*Completed: 2026-07-20*
