---
phase: 2
slug: public-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Mapped from plan `<verify>` blocks and RESEARCH Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.4.1 (backend); Node.js built-in `node --test` (frontend contract tests); eslint / next build |
| **Config file** | `backend/tests/` (no jest/vitest); frontend tests under `frontend/tests/*.test.mjs` |
| **Quick run command** | `cd backend && pytest -q tests/test_security.py tests/test_analyze.py tests/test_access_tokens.py -x` |
| **Full suite command** | `cd backend && pytest -q` && `cd frontend && node --test tests/*.test.mjs && npm run lint && npm run build` |
| **Estimated runtime** | ~60–120 seconds (backend targeted); ~2–4 min full with frontend build |

---

## Sampling Rate

- **After every task commit:** Run that task’s `<automated>` verify from the owning PLAN.md
- **After every plan wave:** Backend `pytest -q` when Track A touched; frontend `node --test` + `npm run lint` when Track B/C touched
- **Before `$gsd-verify-work`:** Full suite must be green + manual checklist below
- **Max feedback latency:** 120 seconds for targeted verifies (build may exceed — run at plan end)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | — (pkg gate) | T-02-SC | Human approve filetype before pip | checkpoint | `node …/gsd-tools.cjs query frontmatter.get …/02-RESEARCH.md` | ✅ RESEARCH | ⬜ pending |
| 02-01-02 | 01 | 1 | DATA-03 | T-02-01 | Plaintext once; hash-only at rest | unit | `cd backend && pytest -q tests/test_access_tokens.py tests/test_analyze.py -k "token or access_token" -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DATA-08, DATA-09, DATA-10 | T-02-02, T-02-03, T-02-04 | Rightmost XFF key; magic bytes; generic 502 | unit | `cd backend && pytest -q tests/test_security.py tests/test_analyze.py tests/test_access_tokens.py -x` | ❌ W0 / extend | ⬜ pending |
| 02-02-01 | 02 | 1 | PUB-01, PUB-02, PUB-06 | — | Always-prefix EN/VI Home + catalogs | node + lint | `cd frontend && node --test tests/public-shell.test.mjs && node -e "…en/vi key parity…" && npm run lint` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | — (pkg gate) | T-02-SC | Human approve RHF/zod pins before npm | checkpoint | `node …/gsd-tools.cjs query frontmatter.get …/02-RESEARCH.md` | ✅ RESEARCH | ⬜ pending |
| 02-04-02 | 04 | 2 | PUB-03, PUB-04, PUB-06 | T-02-05, T-02-06 | RHF+Zod submit; sessionStorage flash (no query token) | node + lint + build | `cd frontend && node --test tests/report-form.test.mjs tests/public-shell.test.mjs && npm run lint && npm run build` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AUTH-04 | T-02-09 | Supabase email/password + safe returnUrl | node + lint | `cd frontend && node --test tests/officer-auth.test.mjs && npm run lint` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | AUTH-04 | T-02-07 | `/dashboard` gated via `proxy.ts` getClaims | node + lint | `cd frontend && node --test tests/officer-auth.test.mjs && npm run lint` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 3 | AUTH-04 (UX) | T-02-08 | Bearer JWT officerFetch + card list | node + lint + build | `cd frontend && node --test tests/officer-auth.test.mjs && npm run lint && npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Plan verify (rollup)

| Req ID | Behavior | Plans | Primary Automated Command |
|--------|----------|-------|---------------------------|
| DATA-03 | Analyze returns plaintext `access_token`; DB stores only SHA-256 hash + `expires_at` | 02-01 | `cd backend && pytest -q tests/test_access_tokens.py tests/test_analyze.py -k "token or access_token" -x` |
| DATA-08 | Rate limit keys on trusted client hop (rightmost XFF + optional `TRUSTED_PROXY_COUNT`) | 02-01 | `cd backend && pytest -q tests/test_security.py -x` |
| DATA-09 | Magic-byte allowlist JPEG/PNG/WebP; forged Content-Type → 415 | 02-01 | `cd backend && pytest -q tests/test_analyze.py -x` |
| DATA-10 | Analyze exceptions → generic client detail; no raw exception string | 02-01 | `cd backend && pytest -q tests/test_analyze.py tests/test_access_tokens.py -x` |
| PUB-01 | Polished bilingual Home (hero CTA, sections, civic light) | 02-02 | `cd frontend && node --test tests/public-shell.test.mjs && npm run lint` |
| PUB-02 | `localePrefix: 'always'` EN/VI + switcher + Accept-Language | 02-02 | same + en/vi JSON key-parity node one-liner |
| PUB-03 | Report form RHF+Zod; optional location; analyzing disabled state | 02-04 | `cd frontend && node --test tests/report-form.test.mjs && npm run lint` |
| PUB-04 | Success flash shows token once; never in query string | 02-04 | `cd frontend && node --test tests/report-form.test.mjs && npm run build` |
| PUB-06 | Natural EN/VI catalogs (Home + Report/Success strings) | 02-02, 02-04 | en/vi key parity + lint |
| AUTH-04 | Unauth `/dashboard` → `/login?returnUrl=`; getClaims in `proxy.ts` | 02-03, 02-05 | `cd frontend && node --test tests/officer-auth.test.mjs && npm run lint && npm run build` |

---

## Wave 0 Requirements

From RESEARCH Validation Architecture (carry forward until stubs exist):

- [ ] `backend/tests/test_access_tokens.py` — DATA-03 hash-at-rest + once-return
- [ ] Extend `backend/tests/test_security.py` — XFF keying / leftmost spoof ignored when rightmost trusted
- [ ] Extend `backend/tests/test_analyze.py` — magic bytes + generic 502 message
- [ ] `frontend/tests/public-shell.test.mjs` — always-prefix locale Home / switcher contracts
- [ ] `frontend/tests/report-form.test.mjs` — Zod/RHF + flash handoff contracts (optional schema-helper unit)
- [ ] `frontend/tests/officer-auth.test.mjs` — returnUrl + dashboard gate + Bearer path
- [x] Confirm Phase 1 frontend packages — **verified 2026-07-20:** `next-intl@4.13.2`, `@supabase/ssr@0.12.3`, `components.json`, `src/lib/supabase/{client,server}.ts` present; **still needed:** `react-hook-form`, `zod`, `@hookform/resolvers` (Plan 02-04 install)

*Existing pytest + eslint infrastructure covers runners; Wave 0 is test stubs + missing RHF/zod pins only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Home hero civic visual + section order EN/VI | PUB-01, PUB-06 | Visual / bilingual UX | Visit `/en` and `/vi`; confirm CTA, AI line, How it works → Instructions → About → Contact → Footer; switcher preserves path |
| Success token copy + live region | PUB-04 | Browser sessionStorage + a11y | Submit report; confirm URL has no token; copy buttons; refresh clears flash |
| Login → returnUrl → dashboard cards | AUTH-04 | Real Supabase session cookies | Unauth `/dashboard` redirects; login lands on returnUrl; cards render |

---

## Soft A→B Contract (phase gate)

- Plan **02-01** publishes `AnalyzeResponse.access_token`.
- Plan **02-04** success flash **soft-depends** on that field (not a hard `depends_on` so Track A ∥ B Wave 1 stay parallel).
- **Phase gate:** Prefer 02-01 green before smoke-testing 02-04 success with a live analyze; if 02-01 incomplete, form may surface API errors without token flash.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s for targeted verifies
- [ ] `nyquist_compliant: true` set in frontmatter when Wave 0 stubs land and maps stay green

**Approval:** pending
