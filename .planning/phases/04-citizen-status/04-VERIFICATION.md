---
phase: 04-citizen-status
verified: 2026-07-20T14:23:22Z
status: human_needed
score: 7/8 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Citizen enters report_id + token on /status and sees current status and history"
    test: "Submit a report, open the success status deep link (or /en/status with reportId+token), confirm auto-fetch shows current status, summary, and newest-first history; repeat with manual form submit"
    expected: "Result panel shows status badge, summary, and history (or empty-history copy); wrong token shows one generic verify-failed Alert"
    why_human: "Backend pytest and frontend smoke prove API/DTO/routes exist, but no browser E2E exercises the live fetch→render path against a real token"
human_verification:
  - test: "Deep link auto-fetch + EN/VI (from 04-02 PLAN human-check)"
    expected: "With backend running and a known report_id+token: open /en/status?reportId=…&token=… → auto-fetch shows status/history; wrong token → one generic error; /vi/status shows VI copy"
    why_human: "Requires live API + browser; smoke tests only assert source/catalog presence"
  - test: "Officer Copy status link (from 04-03 PLAN human-check)"
    expected: "Detail → Copy status link → paste is /en/status?reportId=… with no token=; recovery hint visible; live region announces Link copied"
    why_human: "Clipboard + visual feedback need a real browser session"
  - test: "Calm 429 UX (from 04-VALIDATION.md)"
    expected: "Force status limiter → rate-limited Alert without existence language; Check status disabled briefly via Retry-After"
    why_human: "Limiter threshold and UI timing are environment-dependent"
---

# Phase 4: Citizen Status Verification Report

**Phase Goal:** As a citizen, I want to look up my report with a report ID and access token, so that I can see current status and history without creating an account.

**Mode:** mvp  
**Verified:** 2026-07-20T14:23:22Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## User Flow Coverage

User story: «As a citizen, I want to look up my report with a report ID and access token, so that I can see current status and history without creating an account.»

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open status | Citizen can reach `/en/status` or `/vi/status` (and unprefixed `/status` redirects) | `frontend/src/app/[locale]/status/page.tsx`; `frontend/src/app/status/page.tsx` → `/en/status` preserving query | ✓ |
| Enter credentials | Form accepts report ID + access token; deep link prefills `reportId`+`token` | Status page inputs + `useSearchParams` prefill + one-shot auto-fetch | ✓ (wired) |
| Submit / auto-fetch | Client POSTs to public BFF → FastAPI status | `fetch("/api/public/reports/status")` → `backendEndpoint("/api/v1/reports/status")` | ✓ (wired) |
| See outcome | Current status, summary, newest-first history without AI/officer internals | UI result panel; API `CitizenStatusResponse` allowlist; `get_citizen_status` strips `actor_id` | ✓ code / ⚠️ browser unproven |
| Outcome clause | Citizen sees status/history without an account | Public unauthenticated POST + token proof only | ✓ (API) / ⚠️ human for E2E |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Citizen enters report_id + token on `/status` and sees current status and history (ROADMAP SC1 / CIT-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Page, BFF, and API wired; frontend smoke + pytest green; no live browser E2E against a real token |
| 2 | Invalid token does not reveal whether report exists (ROADMAP SC2 / CIT-03) | ✓ VERIFIED | `test_uniform_401_no_existence_leak` — missing/wrong/expired/mismatch all HTTP 401 with identical detail; never 404 |
| 3 | Officer can copy shareable status link from detail page (ROADMAP SC3 / DASH-08) | ✓ VERIFIED | `CopyStatusLink` builds `/{locale}/status?reportId=` without `token=`; wired in detail header; smoke asserts + recovery hint |
| 4 | Valid lookup returns only status, summary, history newest-first (CIT-02) | ✓ VERIFIED | `test_status_dto_strips_sensitive_fields`; `CitizenStatusResponse` + `get_citizen_status` select allowlist |
| 5 | Status lookup uses separate `status:{ip}` limiter; 429 + Retry-After 60 (CIT-04) | ✓ VERIFIED | `enforce_status_rate_limit`; `test_status_rate_limit_separate_from_analyze`; BFF forwards XFF |
| 6 | Locale-prefixed success prep URL + unprefixed `/status` redirect preserve query (D-03 / D-09) | ✓ VERIFIED | Success page `` `/${locale}/status?reportId=…&token=…` ``; redirect page; smoke tests pass |
| 7 | 401→one verify-failed string; 429→rate-limited copy (CIT-03/04 UX) | ✓ VERIFIED | Status page maps `401`/`429` to catalog keys; EN/VI keys present in smoke |
| 8 | Recovery hint + Check/aria-live clipboard feedback (D-14b / D-15) | ✓ VERIFIED | `statusLinkRecoveryHint` always visible; Copy→Check + `role="status"` aria-live |

**Score:** 7/8 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `backend/app/api/reports.py` | POST `/status` + uniform 401 + rate-limit Depends | ✓ VERIFIED | `citizen_report_status` hash→bind→citizen projection |
| `backend/app/schemas.py` | CitizenStatus request/response DTOs | ✓ VERIFIED | Allowlist fields only |
| `backend/app/security.py` | Separate `status_limiter` | ✓ VERIFIED | `status:{ip}` keyspace |
| `backend/app/services/tokens.py` | Hash + report bind + expiry | ✓ VERIFIED | `hash_access_token`, `token_binds_report` + `compare_digest` |
| `backend/app/services/supabase.py` | Hash lookup + citizen projection | ✓ VERIFIED | `get_access_token_by_hash`, `get_citizen_status` |
| `backend/tests/test_citizen_status.py` | CIT-02/03/04 coverage | ✓ VERIFIED | 4 tests passed via `.venv` |
| `frontend/src/app/api/public/reports/status/route.ts` | Public BFF + XFF forward | ✓ VERIFIED | Proxies JSON + Retry-After |
| `frontend/src/app/[locale]/status/page.tsx` | Civic form + auto-fetch + results | ✓ VERIFIED | Substantive, not stub |
| `frontend/src/app/status/page.tsx` | Unprefixed redirect | ✓ VERIFIED | Preserves `reportId`/`token` |
| `frontend/src/components/CopyStatusLink.tsx` | ReportId-only clipboard | ✓ VERIFIED | No token reconstruction |
| `frontend/src/app/dashboard/reports/[reportId]/page.tsx` | Header wiring | ✓ VERIFIED | `<CopyStatusLink reportId={…} />` under ID meta |
| `frontend/tests/citizen-status.test.mjs` | Route/catalog/copy smoke | ✓ VERIFIED | 8/8 passed |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `reports.py` | `tokens.py` | `hash_access_token` + `token_binds_report` before payload | ✓ WIRED | gsd verify.key-links + source |
| `security.py` | `reports.py` | `Depends(enforce_status_rate_limit)` on POST `/status` | ✓ WIRED | Separate limiter instance |
| `[locale]/status/page.tsx` | BFF route | `POST /api/public/reports/status` JSON body | ✓ WIRED | Client fetch + response handling |
| BFF route | FastAPI | `backendEndpoint("/api/v1/reports/status")` + XFF | ✓ WIRED | Passthrough status/body/Retry-After |
| `CopyStatusLink.tsx` | clipboard | `origin/en/status?reportId=` no `token=` | ✓ WIRED | Absolute URL |
| Detail page | `CopyStatusLink` | Header/meta near report id | ✓ WIRED | Import + render |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Status page result panel | `result` / `setResult` | BFF → FastAPI → `get_citizen_status` (Supabase) | Yes (DB-backed when enabled) | ✓ FLOWING |
| History list | `result.history` | `status_events` ordered `created_at desc` | Yes | ✓ FLOWING |
| CopyStatusLink URL | `reportId` prop | Officer detail `report.report_id` | Yes (loaded report) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| CIT-02/03/04 API | `cd backend && .venv/bin/python -m pytest tests/test_citizen_status.py -q` | 4 passed | ✓ PASS |
| Frontend smoke | `cd frontend && node --test tests/citizen-status.test.mjs` | 8 pass, 0 fail | ✓ PASS |
| Empty/malformed body | POST empty `report_id`/`token` | HTTP **422** (Pydantic), not 401 | ⚠️ WARNING — see below |
| Probes | N/A | No `scripts/**/probe-*.sh` for this phase | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No phase probes declared | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CIT-01 | 04-02 | Public `/status` accepts report_id + token | ✓ SATISFIED (code) / ? NEEDS HUMAN (E2E) | Locale page + form + deep-link auto-fetch |
| CIT-02 | 04-01, 04-02 | Token-validated API returns status, summary, history only | ✓ SATISFIED | DTO + `get_citizen_status` + pytest |
| CIT-03 | 04-01, 04-02 | Invalid token → 401 without existence leak | ✓ SATISFIED | Uniform 401 detail; UI single verify-failed string |
| CIT-04 | 04-01, 04-02 | Status lookup rate-limited | ✓ SATISFIED | Separate limiter + BFF XFF + UI 429 mapping |
| DASH-08 | 04-03 | Officer copies citizen status link | ✓ SATISFIED (code) / ? NEEDS HUMAN (clipboard) | ReportId-only URL + hint on detail |
| DATA-03 | regression (VALIDATION) | Hash-at-rest unchanged | ✓ SATISFIED | `hash_access_token` SHA-256; no plaintext store on lookup path |

No orphaned Phase 4 requirements — all five IDs claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `backend/app/schemas.py` | CitizenStatusRequest | Empty/malformed → **422** vs PLAN wording “same HTTP 401” | ⚠️ Warning | Does **not** leak existence; still fails closed before hash lookup. Not a ROADMAP SC failure. |
| — | — | No TBD/FIXME/XXX in phase deliverables | — | — |
| — | — | No stub returns / hollow props on status path | — | — |

### Human Verification Required

### 1. Deep link auto-fetch + EN/VI

**Test:** With backend running and a known `report_id`+token from success flash, open `/en/status?reportId=…&token=…`. Then try a wrong token. Switch to `/vi/status`.  
**Expected:** Auto-fetch shows status/summary/history; wrong token → one generic error; VI strings render.  
**Why human:** Live API + browser; smoke tests are static.

### 2. Officer Copy status link

**Test:** Open officer detail → Copy status link → paste clipboard.  
**Expected:** Absolute `/en/status?reportId=…` only (no `token=`); recovery hint visible; “Link copied” announced.  
**Why human:** Clipboard and live-region UX.

### 3. Calm 429 UX

**Test:** Force status rate limit (prod-like `STATUS_RATE_LIMIT_PER_MINUTE`) and hammer Check status.  
**Expected:** Rate-limited Alert; no existence-leak copy; button respects Retry-After window.  
**Why human:** Timing/env dependent.

### Gaps Summary

No blockers. Phase goal is implemented and wired end-to-end in code; automated API + smoke coverage is green. Overall status is **human_needed** solely for browser/clipboard UAT (including the one PRESENT_BEHAVIOR_UNVERIFIED roadmap success criterion). Minor warning: empty/malformed request bodies yield FastAPI **422** rather than the PLAN’s stated uniform **401** — acceptable for anti-enumeration, but diverges from PLAN wording.

---

_Verified: 2026-07-20T14:23:22Z_  
_Verifier: gsd-verifier (generic-agent workaround)_
