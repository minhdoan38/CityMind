---
phase: 4
slug: citizen-status
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Mapped from plan `<verify>` blocks and RESEARCH Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.4.1 (backend); Node.js built-in `node --test` (frontend smoke); eslint |
| **Config file** | `backend/pyproject.toml` `[tool.pytest.ini_options]`; frontend tests under `frontend/tests/*.mjs` |
| **Quick run command** | `cd backend && pytest tests/test_citizen_status.py -q` |
| **Full suite command** | `cd backend && pytest -q` && `cd frontend && node --test tests/*.mjs && npm run lint` |
| **Estimated runtime** | ~20–60 seconds targeted; ~2–3 min full with lint |

---

## Sampling Rate

- **After every task commit:** Run that task’s `<automated>` verify from the owning PLAN.md
- **After every plan wave:** Wave 1 → backend pytest; Wave 2/3 → frontend `node --test` + lint; prefer full backend pytest after Track A
- **Before `$gsd-verify-work`:** Full suite green + manual checklist below
- **Max feedback latency:** 90 seconds for targeted verifies

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CIT-02, CIT-03, CIT-04 | T-04-01..04 | Red tests define DTO strip, uniform 401, status limiter | unit | `cd backend && pytest tests/test_citizen_status.py -q --tb=no` (expect fail) | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CIT-02, CIT-03 | T-04-01, T-04-02, T-04-03 | Hash bind + allowlist DTO; identical 401 | unit | `cd backend && pytest -q tests/test_citizen_status.py::test_status_dto_strips_sensitive_fields tests/test_citizen_status.py::test_uniform_401_no_existence_leak tests/test_citizen_status.py::test_report_id_binding -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | CIT-04 | T-04-04 | Separate status_limiter + XFF; 429 Retry-After | unit | `cd backend && pytest -q tests/test_citizen_status.py tests/test_access_tokens.py -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | CIT-01 | T-04-06..08 | Red smoke for routes/BFF/catalog/locale | smoke | `cd frontend && node --test tests/citizen-status.test.mjs` (expect fail) | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | CIT-01, CIT-02, CIT-03, CIT-04 | T-04-06, T-04-08 | BFF XFF + status UI + generic errors | smoke + lint | `cd frontend && node --test tests/citizen-status.test.mjs && npm run lint` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | CIT-01 | T-04-07 | Locale redirect + success prep prefix | smoke + lint | `cd frontend && node --test tests/citizen-status.test.mjs tests/public-shell.test.mjs && npm run lint` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | DASH-08 | T-04-10 | Red smoke reportId-only + dashboard keys | smoke | `cd frontend && node --test tests/citizen-status.test.mjs` (expect fail until Task 2) | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | DASH-08 | T-04-10, T-04-11 | Copy control + hint; no token= | smoke + lint | `cd frontend && node --test tests/citizen-status.test.mjs && npm run lint` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Plan verify (rollup)

| Req ID | Behavior | Plans | Primary Automated Command |
|--------|----------|-------|---------------------------|
| CIT-01 | Locale `/status` form + deep-link auto-fetch | 04-02 | `cd frontend && node --test tests/citizen-status.test.mjs` |
| CIT-02 | API returns only status/summary/history; UI renders same | 04-01, 04-02 | `pytest …::test_status_dto_strips_sensitive_fields` + frontend smoke |
| CIT-03 | Uniform 401; UI one verify-failed string | 04-01, 04-02 | `pytest …::test_uniform_401_no_existence_leak` |
| CIT-04 | Separate status IP limiter; BFF XFF; UI 429 copy | 04-01, 04-02 | `pytest tests/test_citizen_status.py` + BFF XFF assert |
| DASH-08 | Officer copies reportId-only status URL + hint | 04-03 | `node --test tests/citizen-status.test.mjs` (copy asserts) |
| DATA-03 | Hash-at-rest unchanged | 04-01 regression | `pytest tests/test_access_tokens.py -q` |

---

## Wave 0 Requirements

From RESEARCH Validation Architecture (create during plan Task 1 stubs):

- [ ] `backend/tests/test_citizen_status.py` — CIT-02/03/04 (Plan 04-01 Task 1)
- [ ] `frontend/tests/citizen-status.test.mjs` — route + BFF XFF + catalog keys + locale prep + copy asserts (Plans 04-02 / 04-03 Task 1)
- [ ] Document `STATUS_RATE_LIMIT_PER_MINUTE` in `backend/.env.example` (Plan 04-01 Task 3)

*Existing pytest + node:test infrastructure covers runners; Wave 0 is test stubs + settings docs only. No new packages.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deep link auto-fetch + EN/VI copy | CIT-01 | Browser + live API | Submit a report → copy success status link → open → confirm auto-fetch; switch locale |
| Generic 401 / calm 429 UX | CIT-03, CIT-04 | Visual + timing | Wrong token → one Alert; force limiter → rate-limited Alert without existence language |
| Officer copy paste | DASH-08 | Clipboard | Detail → Copy status link → paste shows `…/en/status?reportId=` only; hint visible |

---

## Soft A→B/C Contract (phase gate)

- Plan **04-01** publishes `POST /api/v1/reports/status` + tests (Track A).
- Plan **04-02** hard-depends on **04-01** (BFF/UI need API).
- Plan **04-03** depends on **04-02** for message-catalog merge order; DASH-08 does not need live API for clipboard, but manual QA prefers status page already live.
- **Phase gate:** Tracks A→B→C sequential waves; full suite green before `$gsd-verify-work`.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s for targeted verifies
- [ ] `nyquist_compliant: true` set in frontmatter when Wave 0 stubs land and maps stay green

**Approval:** pending
