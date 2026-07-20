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
| 05-01-* | 01 | 1 | ANLY-01 | T-exfil | Allowlisted columns only; no tokens/evidence | unit | `pytest tests/test_etl_privacy.py -q` | ❌ W0 | ⬜ pending |
| 05-01-* | 01 | 1 | ANLY-01 | T-watermark | Watermark not advanced on load failure | unit | `pytest tests/test_etl_watermarks.py -q` | ❌ W0 | ⬜ pending |
| 05-01-* | 01 | 1 | ANLY-02 | T-sla | One close per report; range filters | unit | `pytest tests/test_analytics_views.py -q` | ❌ W0 | ⬜ pending |
| 05-01-* | 01 | 1 | ANLY-03 | T-authz | Officer JWT required on analytics API | api | `pytest tests/test_analytics_api.py -q` | ❌ W0 | ⬜ pending |
| 05-02-* | 02 | 2 | D-17 | T-k-anon | Categories with count &lt; 3 omitted/bucketed | api | `pytest tests/test_public_stats.py -q` | ❌ W0 | ⬜ pending |
| 05-02-* | 02 | 2 | D-12 | — | Public stats failure does not 500 Home | smoke | `node --test tests/public-stats.test.mjs` | ❌ W0 | ⬜ pending |
| 05-03-* | 03 | 2 | ANLY-03 | — | Analytics nav + URL range keys | smoke | `node --test tests/analytics-shell.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_etl_privacy.py` — ANLY-01 column allowlist
- [ ] `backend/tests/test_etl_watermarks.py` — failure/success watermark behavior
- [ ] `backend/tests/test_analytics_views.py` — SLA/volume/category logic
- [ ] `backend/tests/test_analytics_api.py` — officer auth + range validation
- [ ] `backend/tests/test_public_stats.py` — k-anonymity + rate limit
- [ ] `frontend/tests/analytics-shell.test.mjs` — nav + URL param helpers
- [ ] `frontend/tests/public-stats.test.mjs` — degrade/hide contract
- [ ] `infra/bigquery/analytics_views.sql` + `etl_watermarks.sql` — schema Wave 0
- [ ] `npx shadcn add chart` — after human-verify on recharts SUS (UI-SPEC)

*Existing pytest + Node smoke infrastructure covers runners; Wave 0 adds phase-specific files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cloud Scheduler → Cloud Run Job daily run | ANLY-01 / D-01 | Needs GCP project deploy | Deploy job; confirm non-zero exit + logs on forced failure |
| Officer Analytics charts render with real BQ data | ANLY-03 | Live warehouse + browser | Login → `/dashboard/analytics` → Last 30 days → three charts + hotspot list |
| Public Home stats strip EN/VI + graceful hide | D-11/D-12 | Live BFF + locale | Toggle API down; Home still renders; stats hidden or “unavailable” |
| Clipboard/date custom range URL share | D-08/D-09 | Browser | Set custom from→to; refresh; range persists in `searchParams` |
