---
phase: 02-public-experience
verified: 2026-07-20T12:25:00Z
status: gaps_found
score: 8/13 must-haves verified
behavior_unverified: 4
overrides_applied: 0
mvp_goal_format: invalid
mvp_note: "ROADMAP Mode is mvp but phase goal is not a User Story; User Flow Coverage derived from roadmap Success Criteria + plan objectives (Escalation Gate). Run /gsd mvp-phase 2 to reformat the goal if MVP UAT framing is required."
gaps:
  - truth: "Home section order is How it works → Instructions → About → Contact → Footer (D-03 / Plan 02-02)"
    status: failed
    reason: "Localized Home renders About before How it works; Instructions is nested under How it works. Locked D-03 and Plan 02-02 must_have require How it works → Instructions → About → Contact → Footer."
    artifacts:
      - path: "frontend/src/app/[locale]/page.tsx"
        issue: "DOM order is about → how-it-works (instructions nested) → contact → footer"
    missing:
      - "Reorder Home sections to How it works → Instructions → About → Contact → Footer (or accept override if About-first is intentional)"
      - "Extend public-shell.test.mjs to assert section index order (current test only checks string presence)"
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
  - test: "Home hero civic visual + EN/VI switcher (after section-order fix or override)"
    expected: "Visit /en and /vi; hero CTA, AI advisory, full-bleed visual; switcher preserves path; footer + officer sign-in subtle."
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
**Verified:** 2026-07-20T12:25:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

**MVP mode note:** ROADMAP marks `Mode: mvp`, but `user-story.validate` failed on the phase goal (not `As a…, I want to…, so that…`). Per Escalation Gate, verification proceeded against roadmap Success Criteria and plan must-haves rather than refusing the run. Reformatting via `/gsd mvp-phase 2` is recommended for formal MVP UAT scripts.

## User Flow Coverage

Derived from roadmap Success Criteria (phase goal is not User Story–shaped):

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Land on bilingual Home | `/en` or `/vi` Home with hero, sections, footer | `[locale]/page.tsx` + catalogs + `localePrefix: always` | ✓ code / ⚠️ D-03 order gap |
| Submit report | RHF+Zod form posts analyze; analyzing disabled | `ReportForm.tsx` → `/api/public/reports/analyze` | ✓ code / ⚠️ live submit |
| Receive token | Success shows `report_id` + plaintext token once | `sessionStorage` flash → `[locale]/report/success` | ✓ code / ⚠️ live flash |
| Officer gate | Unauth `/dashboard` → `/login?returnUrl=` | `proxy.ts` `getClaims` + matcher | ✓ code / ⚠️ live cookies |
| Officer list | Cards under `/dashboard` with Bearer fetch | `ReportCard` + `officerFetch` | ✓ code / ⚠️ live data |
| Outcome | Polished public site + token handoff + protected dashboard | Track A–C wired; one D-03 blocker | ✗ gap (section order) |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Successful analyze returns one-time plaintext `access_token`; only SHA-256 hash stored (DATA-03) | ✓ VERIFIED | `tokens.py` `issue_access_token`; `reports.py` insert hash then return plaintext; pytest `test_access_tokens.py` + `test_analyze_returns_access_token` |
| 2 | Rate limiting keys on trusted client hop from `X-Forwarded-For` (DATA-08) | ✓ VERIFIED | `security.py` `client_ip` rightmost/`TRUSTED_PROXY_COUNT`; BFF forwards XFF; pytest `test_xff_*` |
| 3 | Evidence uploads require JPEG/PNG/WebP magic bytes (DATA-09) | ✓ VERIFIED | `filetype.guess` + 415; pytest `test_forged_content_type_rejected_by_magic_bytes` |
| 4 | Analyze failures return generic client message (DATA-10) | ✓ VERIFIED | `HTTPException(502, "Report analysis failed")`; pytest asserts detail; no raw exception in analyze path |
| 5 | Home shows hero, sections, and footer in EN and VI (roadmap SC2 / PUB-01 shell) | ✓ VERIFIED | Full-bleed hero, how-it-works, about, contact, footer; EN/VI key parity 104/104; public-shell tests pass |
| 6 | Always-prefix EN/VI + switcher + Accept-Language seam (PUB-02) | ✓ VERIFIED | `routing.ts` `localePrefix: "always"`; `LocaleSwitcher`; `proxy.ts` intl middleware; tests pass |
| 7 | Home section order How it works → Instructions → About → Contact → Footer (D-03) | ✗ FAILED | Actual DOM order: **About → How it works (Instructions nested) → Contact → Footer** in `[locale]/page.tsx` |
| 8 | Report form uses RHF+Zod; optional location; analyzing disabled state (PUB-03) | ✓ VERIFIED | `useForm` + `zodResolver`; `isSubmitting` disables controls; report-form tests + lint + build green |
| 9 | Success flash shows report_id + token once via sessionStorage (not query) (PUB-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Flash write/read/remove coded; contract tests assert patterns; live browser path not exercised |
| 10 | Unauth `/dashboard` → `/login?returnUrl=` via `proxy.ts` getClaims (AUTH-04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `proxy.ts` gate + `safeReturnUrl`; officer-auth contract tests; runtime redirect not exercised |
| 11 | Officer Supabase email/password login honors safe returnUrl (roadmap SC3) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `login/route.ts` `signInWithPassword` + `safeReturnUrl`; needs live Auth |
| 12 | Dashboard recent ReportCard list + Bearer `officerFetch` (AUTH-04 UX / 02-05) | ✓ VERIFIED | `dashboard/page.tsx` + `ReportCard` href `/dashboard/reports/${id}`; `officerFetch` sets `Authorization: Bearer`; build lists route |
| 13 | End-to-end citizen submit receives report_id + access token (roadmap SC1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Soft A→B wired (`body.access_token` → flash); live analyze not run in this verification |

**Score:** 8/13 truths verified (4 present, behavior-unverified; 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `backend/app/services/tokens.py` | Issue-once hash helper | ✓ VERIFIED | `gsd verify.artifacts` 02-01 |
| `frontend/src/app/api/public/reports/analyze/route.ts` | BFF XFF forward | ✓ VERIFIED | Forwards X-Forwarded-For / X-Real-IP |
| `backend/tests/test_access_tokens.py` | DATA-03 coverage | ✓ VERIFIED | Exists; tests pass |
| `frontend/src/app/[locale]/page.tsx` | Bilingual Home | ⚠️ PARTIAL | Exists + substantive, but D-03 order wrong |
| `frontend/src/i18n/routing.ts` | `localePrefix: always` | ✓ VERIFIED | |
| `frontend/src/proxy.ts` | next-intl + dashboard gate | ✓ VERIFIED | Next 16 Proxy middleware present in build |
| `frontend/src/app/login/page.tsx` | returnUrl sign-in | ✓ VERIFIED | |
| `frontend/src/components/ReportForm.tsx` | RHF+Zod + flash | ✓ VERIFIED | |
| `frontend/src/app/[locale]/report/success/page.tsx` | One-shot token UI | ✓ VERIFIED | |
| `frontend/src/components/dashboard/ReportCard.tsx` | Card list item | ✓ VERIFIED | |
| `frontend/src/app/dashboard/page.tsx` | Recent cards | ✓ VERIFIED | |
| `frontend/src/lib/backend.ts` | Bearer officerFetch | ✓ VERIFIED | |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `backend/app/api/reports.py` | `tokens.py` | issue + persist hash | ✓ WIRED | `verify.key-links` 02-01 |
| BFF analyze route | `security.py` client_ip | X-Forwarded-For | ✓ WIRED | Pattern in both |
| `i18n/routing.ts` | `proxy.ts` | createMiddleware | ✓ WIRED | |
| `proxy.ts` | Supabase SSR getClaims | dashboard matcher | ✓ WIRED | |
| `ReportForm.tsx` | success page | sessionStorage flash | ✓ WIRED | |
| AnalyzeResponse.access_token | ReportForm flash | soft A→B | ✓ WIRED (manual) | Tool flagged non-path `from:`; code uses `body.access_token` |
| `backend.ts` | FastAPI recent | Bearer JWT | ✓ WIRED | |
| `dashboard/page.tsx` | detail route | card href | ✓ WIRED (manual) | Link lives in `ReportCard.tsx` (`/dashboard/reports/${id}`); tool pattern missed page.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| AnalyzeResponse | `access_token` | `issue_access_token` → `insert_access_token(hash)` | Yes (hash only in DB) | ✓ FLOWING |
| ReportForm → success | `reportId` / `accessToken` | analyze JSON → sessionStorage | Yes when API returns token | ✓ FLOWING (code) |
| Home copy | `t(...)` | en.json / vi.json | Catalog strings | ✓ FLOWING |
| Dashboard cards | `reports` | `officerFetch(/api/v1/reports/recent)` | Yes when session+API live | ✓ FLOWING (code) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Access tokens + XFF + magic + analyze | `python3.12 venv` + `pytest -q tests/test_access_tokens.py tests/test_security.py tests/test_analyze.py -x` | 27 passed in 3.03s | ✓ PASS |
| Frontend contracts | `node --test tests/public-shell.test.mjs tests/report-form.test.mjs tests/officer-auth.test.mjs` | 29/29 pass | ✓ PASS |
| EN/VI key parity | node walkKeys compare | 104/104 identical | ✓ PASS |
| ESLint | `npm run lint` | exit 0 | ✓ PASS |
| Production build | `npm run build` | Compiled; Proxy middleware; locale report/success + dashboard routes | ✓ PASS |
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
| PUB-01 | 02-02 | Home hero/sections/footer | ⚠️ PARTIAL | Present; **D-03 section order failed** |
| PUB-02 | 02-02 | EN/VI next-intl always-prefix | ✓ SATISFIED | routing + catalogs + tests |
| PUB-03 | 02-04 | RHF+Zod form | ✓ SATISFIED | ReportForm + pins + tests |
| PUB-04 | 02-04 | Success report_id + token | ? NEEDS HUMAN | Code wired; live flash unverified |
| PUB-06 | 02-02/04 | Responsive/a11y + natural catalogs | ? NEEDS HUMAN | focus-visible/min-h-11 present; visual a11y needs human |
| AUTH-04 | 02-03/05 | proxy.ts dashboard gate + returnUrl | ? NEEDS HUMAN | Code + contract tests; live redirect/login needs human |

No orphaned Phase 2 requirements — all mapped IDs appear in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `frontend/src/app/[locale]/page.tsx` | ~137–250 | Section order About-first vs D-03 | 🛑 Blocker | Plan/CONTEXT must-have missed |
| `frontend/tests/public-shell.test.mjs` | ~106–119 | D-01–D-08 test ignores order | ⚠️ Warning | False green on D-03 |
| `backend/app/api/reports.py` | ~164+ | Officer 502 details include `{exc}` | ⚠️ Warning | Broader DATA-10 wording; analyze path is clean |
| `frontend/src/app/[locale]/page.tsx` | Display clamp | Hero up to `3.25rem` vs UI-SPEC Display max 40px / `2.5rem` | ℹ️ Info | Visual contract drift |

No `TBD`/`FIXME`/`XXX` debt markers in phase-touched critical files.

### Human Verification Required

### 1. Home visual + locale (after order fix or override)

**Test:** Visit `/en` and `/vi`; confirm hero CTA, AI advisory, section order per D-03 (or accepted override), switcher path preserve.
**Expected:** Civic light Home matches UI-SPEC; EN/VI natural copy.
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

**Blocking:** Home section order does not match locked D-03 / Plan 02-02 must-have (About appears before How it works). Automated frontend contracts did not assert order, so Wave verifies stayed green while the content contract drifted.

**Everything else Track A/C and most of Track B is present, wired, and unit/contract-tested.** Backend Phase 2 security suite is green (27). Frontend contracts (29), lint, and production build are green. Remaining work after fixing (or overriding) D-03 is human UAT for live submit/login/visual.

**This looks intentional (Dentlabs-style About-first layout).** To accept the deviation without reordering, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "Home section order How it works → Instructions → About → Contact → Footer"
    reason: "About-first civic layout chosen for marketing composition; all sections still present"
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

Then re-run verification.

---

_Verified: 2026-07-20T12:25:00Z_
_Verifier: the agent (gsd-verifier)_
