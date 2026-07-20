---
phase: 02-public-experience
verified: 2026-07-20T12:28:05Z
status: human_needed
score: 9/13 must-haves verified
behavior_unverified: 4
overrides_applied: 0
mvp_goal_format: invalid
mvp_note: "ROADMAP Mode is mvp but phase goal is not a User Story; User Flow Coverage derived from roadmap Success Criteria + plan objectives (Escalation Gate). Run /gsd mvp-phase 2 to reformat the goal if MVP UAT framing is required."
re_verification:
  previous_status: gaps_found
  previous_score: 8/13
  gaps_closed:
    - "Home section order is How it works → Instructions → About → Contact → Footer (D-03 / Plan 02-02)"
  gaps_remaining: []
  regressions: []
  fix_commit: "4d3093c"
behavior_unverified_items:
  - truth: "Citizen submits a report on the bilingual Report page and receives report_id + access_token (roadmap SC1 / PUB-04 live path)"
    test: "On /en/report (and /vi/report), submit a valid description; confirm navigate to /report/success with report_id + token; refresh clears flash; URL never contains the token."
    expected: "One-shot success flash via sessionStorage; copy actions work; refresh shows empty/redirect state."
    why_human: "End-to-end analyze + sessionStorage flash is a runtime state transition; contract tests only prove source patterns."
  - truth: "Unauthenticated /dashboard and /dashboard/reports/* redirect to /login?returnUrl=… (AUTH-04)"
    test: "In a logged-out browser, open /dashboard and /dashboard/reports/<id>."
    expected: "Redirect to /login with returnUrl preserving the requested path; public /en and /en/report stay ungated."
    why_human: "proxy.ts getClaims gate needs a live Next.js request cycle and cookie jar; node contract tests only grep source."
  - truth: "Officer signs in via Supabase Auth and lands on safe returnUrl (default /dashboard)"
    test: "From /login?returnUrl=/dashboard/reports/<id>, sign in with a seeded officer; try an open-redirect returnUrl."
    expected: "Valid officer lands on returnUrl; unsafe returnUrl falls back to /dashboard; bad password shows error."
    why_human: "Requires live Supabase Auth credentials and session cookies."
  - truth: "Success page shows access token once with copy + status-link prep (PUB-04)"
    test: "After a successful submit, use copy buttons and confirm aria live region; open prepared status link shape."
    expected: "Token visible once; copy confirms; status query prep present; refresh clears token UI."
    why_human: "Browser sessionStorage + a11y live region cannot be proven by file grep alone."
human_verification:
  - test: "Home hero civic visual + EN/VI switcher + D-03 section order"
    expected: "Visit /en and /vi; hero CTA, AI advisory, full-bleed visual; section order How it works → Instructions → About → Contact → Footer; switcher preserves path; footer + officer sign-in subtle."
    why_human: "Visual/UX and bilingual feel need a running app (VALIDATION.md manual)."
  - test: "Citizen report submit → success flash"
    expected: "Submit yields report_id + access_token once; no token in query string; refresh clears flash."
    why_human: "Live analyze + sessionStorage."
  - test: "Login → returnUrl → dashboard cards"
    expected: "Unauth /dashboard redirects; login lands on returnUrl; ReportCard list renders via Bearer officerFetch."
    why_human: "Live Supabase session + API."
---

# Phase 2: Public Experience Verification Report

**Phase Goal:** Polished bilingual public site; citizens submit reports and receive access tokens.
**Verified:** 2026-07-20T12:28:05Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (commit `4d3093c`)

**MVP mode note:** ROADMAP marks `Mode: mvp`, but `user-story.validate` failed on the phase goal (not `As a…, I want to…, so that…`). Per Escalation Gate, verification proceeded against roadmap Success Criteria and plan must-haves rather than refusing the run. Reformatting via `/gsd mvp-phase 2` is recommended for formal MVP UAT scripts.

## Re-verification Summary

| Item | Prior | Now |
|------|-------|-----|
| D-03 Home section order | ✗ FAILED (`gaps_found`) | ✓ VERIFIED — `[locale]/page.tsx` DOM order + `public-shell.test.mjs` index assertion; 10/10 public-shell tests pass |
| Other code must-haves | ✓ / ⚠️ as before | Quick regression: artifacts present; no regressions |
| Live UAT truths | ⚠️ behavior_unverified | Unchanged — still need human |

**Gaps remaining:** none (code). Status is `human_needed` (same pattern as Phase 1), not `gaps_found`.

## User Flow Coverage

Derived from roadmap Success Criteria (phase goal is not User Story–shaped):

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Land on bilingual Home | `/en` or `/vi` Home with hero, sections, footer | `[locale]/page.tsx` + catalogs + `localePrefix: always`; D-03 order fixed | ✓ code / ⚠️ live visual |
| Submit report | RHF+Zod form posts analyze; analyzing disabled | `ReportForm.tsx` → `/api/public/reports/analyze` | ✓ code / ⚠️ live submit |
| Receive token | Success shows `report_id` + plaintext token once | `sessionStorage` flash → `[locale]/report/success` | ✓ code / ⚠️ live flash |
| Officer gate | Unauth `/dashboard` → `/login?returnUrl=` | `proxy.ts` `getClaims` + matcher | ✓ code / ⚠️ live cookies |
| Officer list | Cards under `/dashboard` with Bearer fetch | `ReportCard` + `officerFetch` | ✓ code / ⚠️ live data |
| Outcome | Polished public site + token handoff + protected dashboard | Track A–C wired; D-03 closed | ✓ code / ⚠️ human UAT |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Successful analyze returns one-time plaintext `access_token`; only SHA-256 hash stored (DATA-03) | ✓ VERIFIED | `tokens.py` `issue_access_token`; `reports.py` insert hash then return plaintext; pytest coverage (prior + regression presence) |
| 2 | Rate limiting keys on trusted client hop from `X-Forwarded-For` (DATA-08) | ✓ VERIFIED | `security.py` `client_ip`; BFF forwards XFF (prior) |
| 3 | Evidence uploads require JPEG/PNG/WebP magic bytes (DATA-09) | ✓ VERIFIED | `filetype.guess` + 415 (prior) |
| 4 | Analyze failures return generic client message (DATA-10) | ✓ VERIFIED | `HTTPException(502, "Report analysis failed")` (prior) |
| 5 | Home shows hero, sections, and footer in EN and VI (roadmap SC2 / PUB-01 shell) | ✓ VERIFIED | Full-bleed hero, how-it-works, instructions, about, contact, footer; EN/VI catalogs; public-shell 10/10 |
| 6 | Always-prefix EN/VI + switcher + Accept-Language seam (PUB-02) | ✓ VERIFIED | `routing.ts` `localePrefix: "always"`; `LocaleSwitcher`; `proxy.ts` intl middleware |
| 7 | Home section order How it works → Instructions → About → Contact → Footer (D-03) | ✓ VERIFIED | `page.tsx` ids at indices how&lt;instructions&lt;about&lt;contact&lt;footer; test asserts order; fix commit `4d3093c` |
| 8 | Report form uses RHF+Zod; optional location; analyzing disabled state (PUB-03) | ✓ VERIFIED | `useForm` + `zodResolver`; `isSubmitting` disables controls (prior) |
| 9 | Success flash shows report_id + token once via sessionStorage (not query) (PUB-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Flash write/read/remove coded; contract tests assert patterns; live browser path not exercised |
| 10 | Unauth `/dashboard` → `/login?returnUrl=` via `proxy.ts` getClaims (AUTH-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `proxy.ts` gate + `safeReturnUrl`; officer-auth contract tests; runtime redirect not exercised |
| 11 | Officer Supabase email/password login honors safe returnUrl (roadmap SC3) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `login/route.ts` `signInWithPassword` + `safeReturnUrl`; needs live Auth |
| 12 | Dashboard recent ReportCard list + Bearer `officerFetch` (AUTH-04 UX / 02-05) | ✓ VERIFIED | `dashboard/page.tsx` + `ReportCard`; `officerFetch` Bearer (prior) |
| 13 | End-to-end citizen submit receives report_id + access token (roadmap SC1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Soft A→B wired (`body.access_token` → flash); live analyze not run in this verification |

**Score:** 9/13 truths verified (4 present, behavior-unverified; 0 failed)

### Deferred Items

None — no remaining code gaps deferred to later phases.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `backend/app/services/tokens.py` | Issue-once hash helper | ✓ VERIFIED | Regression presence OK |
| `frontend/src/app/api/public/reports/analyze/route.ts` | BFF XFF forward | ✓ VERIFIED | Prior |
| `backend/tests/test_access_tokens.py` | DATA-03 coverage | ✓ VERIFIED | Prior |
| `frontend/src/app/[locale]/page.tsx` | Bilingual Home + D-03 order | ✓ VERIFIED | Reordered; order asserted in tests |
| `frontend/src/i18n/routing.ts` | `localePrefix: always` | ✓ VERIFIED | |
| `frontend/src/proxy.ts` | next-intl + dashboard gate | ✓ VERIFIED | |
| `frontend/src/app/login/page.tsx` | returnUrl sign-in | ✓ VERIFIED | |
| `frontend/src/components/ReportForm.tsx` | RHF+Zod + flash | ✓ VERIFIED | |
| `frontend/src/app/[locale]/report/success/page.tsx` | One-shot token UI | ✓ VERIFIED | |
| `frontend/src/components/dashboard/ReportCard.tsx` | Card list item | ✓ VERIFIED | |
| `frontend/src/app/dashboard/page.tsx` | Recent cards | ✓ VERIFIED | |
| `frontend/src/lib/backend.ts` | Bearer officerFetch | ✓ VERIFIED | |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `backend/app/api/reports.py` | `tokens.py` | issue + persist hash | ✓ WIRED | Prior |
| BFF analyze route | `security.py` client_ip | X-Forwarded-For | ✓ WIRED | Prior |
| `i18n/routing.ts` | `proxy.ts` | createMiddleware | ✓ WIRED | |
| `proxy.ts` | Supabase SSR getClaims | dashboard matcher | ✓ WIRED | |
| `ReportForm.tsx` | success page | sessionStorage flash | ✓ WIRED | |
| AnalyzeResponse.access_token | ReportForm flash | soft A→B | ✓ WIRED | |
| `backend.ts` | FastAPI recent | Bearer JWT | ✓ WIRED | |
| `dashboard/page.tsx` | detail route | card href | ✓ WIRED | Via `ReportCard.tsx` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| AnalyzeResponse | `access_token` | `issue_access_token` → hash insert | Yes (hash only in DB) | ✓ FLOWING |
| ReportForm → success | `reportId` / `accessToken` | analyze JSON → sessionStorage | Yes when API returns token | ✓ FLOWING (code) |
| Home copy | `t(...)` | en.json / vi.json | Catalog strings | ✓ FLOWING |
| Dashboard cards | `reports` | `officerFetch(/api/v1/reports/recent)` | Yes when session+API live | ✓ FLOWING (code) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------- |
| D-03 section order (gap re-check) | `node --test tests/public-shell.test.mjs` | 10/10 pass; order assertion green | ✓ PASS |
| DOM order indices | node indexOf how→instructions→about→contact→footer | `ordered: true` | ✓ PASS |
| Live browser UAT | — | Not run | ? SKIP → human |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No phase-declared `scripts/*/tests/probe-*.sh` | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DATA-03 | 02-01 | Hash-at-rest; plaintext once | ✓ SATISFIED | tokens + pytest |
| DATA-08 | 02-01 | XFF rate limit | ✓ SATISFIED | client_ip + pytest |
| DATA-09 | 02-01 | Magic bytes | ✓ SATISFIED | filetype + pytest |
| DATA-10 | 02-01 | Generic analyze errors | ✓ SATISFIED | analyze 502 generic; **warning:** some officer routes still interpolate `{exc}` in 502/401 details |
| PUB-01 | 02-02 | Home hero/sections/footer | ✓ SATISFIED | Present + D-03 order verified |
| PUB-02 | 02-02 | EN/VI next-intl always-prefix | ✓ SATISFIED | routing + catalogs + tests |
| PUB-03 | 02-04 | RHF+Zod form | ✓ SATISFIED | ReportForm + pins + tests |
| PUB-04 | 02-04 | Success report_id + token | ? NEEDS HUMAN | Code wired; live flash unverified |
| PUB-06 | 02-02/04 | Responsive/a11y + natural catalogs | ? NEEDS HUMAN | focus-visible/min-h-11 present; visual a11y needs human |
| AUTH-04 | 02-03/05 | proxy.ts dashboard gate + returnUrl | ? NEEDS HUMAN | Code + contract tests; live redirect/login needs human |

No orphaned Phase 2 requirements — all mapped IDs appear in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `backend/app/api/reports.py` | ~164+ | Officer 502 details include `{exc}` | ⚠️ Warning | Broader DATA-10 wording; analyze path is clean |
| `frontend/src/app/[locale]/page.tsx` | Display clamp | Hero up to `3.25rem` vs UI-SPEC Display max 40px / `2.5rem` | ℹ️ Info | Visual contract drift |

No `TBD`/`FIXME`/`XXX` debt markers in phase-touched critical files. Prior D-03 blocker and weak order test are **closed** by `4d3093c`.

### Human Verification Required

### 1. Home visual + locale + D-03 order

**Test:** Visit `/en` and `/vi`; confirm hero CTA, AI advisory, section order How it works → Instructions → About → Contact → Footer, switcher path preserve.
**Expected:** Civic light Home matches UI-SPEC; EN/VI natural copy; D-03 order visible.
**Why human:** Visual/UX.

### 2. Citizen submit → success flash

**Test:** Submit report; inspect success URL and refresh.
**Expected:** Token once via flash; no query token; copy + live region.
**Why human:** Browser sessionStorage + live analyze.

### 3. Login → returnUrl → dashboard cards

**Test:** Unauth `/dashboard`; login with officer; land on returnUrl; see cards.
**Expected:** Gate + Bearer list works against live Supabase/API.
**Why human:** Live Auth cookies.

### Gaps Summary

**No remaining code gaps.** D-03 Home section order (sole prior `gaps_found` item) closed in commit `4d3093c`: DOM order matches locked contract and `public-shell.test.mjs` asserts id order (10/10 pass).

**Remaining work is human UAT** for live submit/login/visual — same pattern as Phase 1 (`human_needed`, ROADMAP checkbox left unchecked until UAT clears).

---

_Verified: 2026-07-20T12:28:05Z_
_Verifier: the agent (gsd-verifier, generic-agent workaround)_
