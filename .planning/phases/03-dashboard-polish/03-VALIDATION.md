---
phase: 3
slug: dashboard-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Mapped from plan `<verify>` blocks and RESEARCH Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.4.1 (backend); Node.js built-in `node --test` (frontend smoke); eslint / next build |
| **Config file** | `backend/pyproject.toml` `[tool.pytest.ini_options]`; frontend tests under `frontend/tests/*.test.mjs` |
| **Quick run command** | `cd backend && pytest tests/test_reports.py -q` |
| **Full suite command** | `cd backend && pytest -q` && `cd frontend && node --test tests/dashboard-*.test.mjs && npm run lint && npm run build` |
| **Estimated runtime** | ~30–90 seconds (backend targeted); ~2–4 min full with frontend build |

---

## Sampling Rate

- **After every task commit:** Run that task’s `<automated>` verify from the owning PLAN.md
- **After every plan wave:** Backend `pytest -q` when Track A touched; frontend `node --test` + `npm run lint` when Track B/C/export touched
- **Before `$gsd-verify-work`:** Full suite must be green + manual checklist below
- **Max feedback latency:** 120 seconds for targeted verifies (build may exceed — run at plan end)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | — (pkg gate) | T-03-SC | Human approve XlsxWriter before pip | checkpoint | `node …/gsd-tools.cjs query frontmatter.get …/03-RESEARCH.md` | ✅ RESEARCH | ⬜ pending |
| 03-01-02 | 01 | 1 | DATA-07, DASH-05 (server) | T-03-01, T-03-02 | actor_id from JWT sub; resolve/reject blank note → 422 | unit | `cd backend && pytest -q tests/test_reports.py::test_status_records_actor_id tests/test_reports.py::test_resolve_requires_note tests/test_security.py -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | DATA-04, DATA-05, DATA-06 | T-03-03, T-03-04, T-03-05 | Keyset cursor; filtered summary; auth + stream export | unit | `cd backend && pytest -q tests/test_reports.py::test_list_cursor_pagination tests/test_reports.py::test_summary_respects_filters tests/test_export.py -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | DASH-02, DASH-03, DASH-07 (list) | T-03-07, T-03-08 | Table/filters/metrics; URL sync; list empty/error | node + lint | `cd frontend && node --test tests/dashboard-table.test.mjs && npm run lint` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 3 | DASH-06, DASH-07 (export) | T-03-06 | getClaims-gated stream proxy; focus=export | node + lint + build | `cd frontend && node --test tests/dashboard-export.test.mjs && npm run lint && npm run build` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | DASH-04, DASH-07 (detail) | T-03-10 | Detail section order; advisory AI; actor timeline | node + lint | `cd frontend && node --test tests/dashboard-detail.test.mjs && npm run lint` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | DASH-05, DASH-07 (resolve) | T-03-09, T-03-11 | Dialog note gate; reviewing immediate | node + lint + build | `cd frontend && node --test tests/dashboard-detail.test.mjs && npm run lint && npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Plan verify (rollup)

| Req ID | Behavior | Plans | Primary Automated Command |
|--------|----------|-------|---------------------------|
| DATA-04 | `cursor`+`limit` returns `next_cursor`; stable keyset ordering | 03-01 | `cd backend && pytest -q tests/test_reports.py::test_list_cursor_pagination -x` |
| DATA-05 | `/summary` metrics computed on filtered set (four fields) | 03-01 | `cd backend && pytest -q tests/test_reports.py::test_summary_respects_filters -x` |
| DATA-06 | `/export` streams CSV/XLSX with filters; officer auth | 03-01 | `cd backend && pytest -q tests/test_export.py -x` |
| DATA-07 | status insert includes `actor_id` from JWT sub | 03-01 | `cd backend && pytest -q tests/test_reports.py::test_status_records_actor_id -x` |
| DASH-02 | Compact TanStack/shadcn table replaces Phase 2 cards | 03-02 | `cd frontend && node --test tests/dashboard-table.test.mjs && npm run lint` |
| DASH-03 | Collapsible filters + URL sync; metrics share filters | 03-02 | same |
| DASH-04 | Detail section order + advisory AI + timeline | 03-03 | `cd frontend && node --test tests/dashboard-detail.test.mjs && npm run lint` |
| DASH-05 | resolved/rejected require note (server 422 + Dialog) | 03-01, 03-03 | pytest note gate + dashboard-detail tests |
| DASH-06 | Filtered CSV/Excel export via BFF; sidebar `?focus=export` | 03-04 | `cd frontend && node --test tests/dashboard-export.test.mjs && npm run lint` |
| DASH-07 | Loading / empty / error states (list, export, detail) | 03-02, 03-03, 03-04 | dashboard-table / detail / export smoke |

---

## Wave 0 Requirements

From RESEARCH Validation Architecture (carry forward until stubs exist):

- [ ] Migration `actor_id` + `current_status` (+ indexes/backfill) — Plan 03-01
- [ ] `backend/tests/test_reports.py` extensions for cursor, filtered summary, note gate, actor_id
- [ ] `backend/tests/test_export.py` for CSV/XLSX streaming + auth
- [ ] `frontend/tests/dashboard-table.test.mjs` — table/filters/metrics/empty/error + filter query wiring
- [ ] `frontend/tests/dashboard-export.test.mjs` — ExportButton + BFF route + `focus=export` sidebar URL
- [ ] `frontend/tests/dashboard-detail.test.mjs` — D-19 section order + Dialog note gate markers
- [ ] Install `@tanstack/react-table` (Plan 03-02) and `XlsxWriter==3.2.9` (Plan 03-01 after human-verify)

*Existing pytest + eslint infrastructure covers runners; Wave 0 is test stubs + package pins only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Table replaces cards; column toggle severity | DASH-02 | Visual + localStorage | Login → `/dashboard`; confirm table (not card grid); toggle severity; refresh preserves visibility |
| Filters change metrics + cursor Next | DASH-03, DATA-04/05 | Live API + URL | Apply status filter; confirm metrics change and URL searchParams update; Next uses cursor |
| Export CSV/XLSX downloads filtered set | DASH-06 | Browser download stream | Apply filter → Download CSV → file opens with filtered rows; sidebar Export focuses control |
| Detail hierarchy + resolve Dialog | DASH-04, DASH-05 | Visual + a11y | Open detail → confirm section order → reviewing immediate → resolve Dialog empty blocked → confirm refreshes timeline with truncated actor |

---

## Soft A→B/C Contract (phase gate)

- Plan **03-01** publishes cursor list, filtered summary, streaming export, and actor-aware status.
- Plan **03-02** (table/filters) hard-depends on **03-01**.
- Plan **03-04** (export UI) hard-depends on **03-01** + **03-02** (needs filter query string).
- Plan **03-03** (detail) hard-depends on **03-01** + **03-02**; does **not** wait for **03-04** (export can run ∥ detail).
- **Phase gate:** Prefer 03-01 green before smoke-testing live table/export against remote schema.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s for targeted verifies
- [ ] `nyquist_compliant: true` set in frontmatter when Wave 0 stubs land and maps stay green

**Approval:** pending
