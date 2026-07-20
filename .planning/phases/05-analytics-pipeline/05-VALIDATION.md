---
phase: 5
slug: analytics-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `05-RESEARCH.md` ## Validation Architecture.
> Waves aligned with revised plans: 01 → 04 → 03 → 02.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.4.1 (backend); Node test runner (`frontend/tests/*.test.mjs`) |
| **Config file** | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run command** | `cd backend && .venv/bin/python -m pytest tests/test_analytics_api.py tests/test_etl_privacy.py -q` |
| **Full suite command** | `cd backend && .venv/bin/python -m pytest -q` && `cd frontend && node --test tests/*.test.mjs` |
| **Estimated runtime** | ~60–120 seconds (phase-scoped); full suite longer |

---

## Sampling Rate

- **After every task commit:** Run targeted pytest / smoke file(s) for that task
- **After every plan wave:** Full backend pytest + frontend analytics/public smoke tests
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~120 seconds for phase-scoped suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-* | 01 | 1 | ANLY-01 | T-05-01 | Allowlisted columns only; no tokens/evidence | unit | `pytest tests/test_etl_privacy.py -q` | ❌ W0 | ⬜ pending |
| 05-01-* | 01 | 1 | ANLY-01 | T-05-06 | Watermark not advanced on load failure | unit | `pytest tests/test_etl_watermarks.py -q` | ❌ W0 | ⬜ pending |
| 05-01-* | 01 | 1 | ANLY-02 | T-sla | One close per report; range filters | unit | `pytest tests/test_analytics_views.py -q` | ❌ W0 | ⬜ pending |
| 05-04-* | 04 | 2 | ANLY-03 | T-05-02 | Officer JWT required on analytics API | api | `pytest tests/test_analytics_api.py -q` | ❌ W0 | ⬜ pending |
| 05-03-* | 03 | 3 | ANLY-03 | — | Analytics nav + URL range keys | smoke | `node --test tests/analytics-shell.test.mjs` | ❌ W0 | ⬜ pending |
| 05-02-* | 02 | 4 | D-17 | T-05-12 | Categories with count under 3 omitted/bucketed | api | `pytest tests/test_public_stats.py -q` | ❌ W0 | ⬜ pending |
| 05-02-* | 02 | 4 | D-12 | T-05-15 | Public stats failure does not 500 Home | smoke | `node --test tests/public-stats.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_etl_privacy.py` — ANLY-01 column allowlist (plan 05-01)
- [ ] `backend/tests/test_etl_watermarks.py` — failure/success watermark behavior (plan 05-01)
- [ ] `backend/tests/test_analytics_views.py` — SLA/volume/category logic (plan 05-01)
- [ ] `backend/tests/test_analytics_api.py` — officer auth + range validation (plan 05-04)
- [ ] `backend/tests/test_public_stats.py` — k-anonymity + rate limit (plan 05-02)
- [ ] `frontend/tests/analytics-shell.test.mjs` — nav + URL param helpers (plan 05-03)
- [ ] `frontend/tests/public-stats.test.mjs` — degrade/hide contract (plan 05-02)
- [ ] `infra/bigquery/analytics_views.sql` + `etl_watermarks.sql` — schema Wave 0 (plan 05-01)
- [ ] `npx shadcn add chart` — after human-verify on recharts SUS (plan 05-03 / UI-SPEC)

*Existing pytest + Node smoke infrastructure covers runners; Wave 0 adds phase-specific files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cloud Scheduler → Cloud Run Job daily run | ANLY-01 / D-01 | Needs GCP project deploy | Deploy job; confirm non-zero exit + logs on forced failure |
| Officer Analytics charts render with real BQ data | ANLY-03 | Live warehouse + browser | Login → `/dashboard/analytics` → Last 30 days → three charts + hotspot list |
| Public Home stats strip EN/VI + graceful hide | D-11/D-12 | Live BFF + locale | Toggle API down; Home still renders; stats hidden or “unavailable” |
| Clipboard/date custom range URL share | D-08/D-09 | Browser | Set custom from→to; refresh; range persists in `searchParams` |
| Phase 4 execute gate | ROADMAP dep | Cross-phase | Confirm Phase 4 UAT accepted (or explicit bypass) before `$gsd-execute-phase 5` |
