---
phase: 6
slug: maps-geospatial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.4.1 (backend); Node test runner via `frontend/tests/*.test.mjs` |
| **Config file** | `backend/pyproject.toml` |
| **Quick run command** | `cd backend && pytest tests/test_geo_pins.py -q` |
| **Full suite command** | `cd backend && pytest -q` && `node --test frontend/tests/*.test.mjs` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run targeted pytest or frontend smoke for the touched track
- **After every plan wave:** Run full backend pytest + Phase 6 map smoke tests
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | MAP-01 | T-06-01 / — | PostGIS migration applies locally | migration | `pytest tests/test_postgis_migration.py -q` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | MAP-03 | T-06-02 | Geo pins require officer JWT | api | `pytest tests/test_geo_pins.py::test_requires_auth -x` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | MAP-03 | T-06-03 | Invalid bbox returns 422 | api | `pytest tests/test_geo_pins.py::test_invalid_bbox -x` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | D-20 | T-06-04 | Pin payload excludes PII fields | api | `pytest tests/test_geo_pins.py::test_pin_projection -x` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 1 | D-16 | — | `unlocated_count` in geo response | api | `pytest tests/test_geo_pins.py::test_unlocated_count -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | MAP-02 | — | Mini-map degrades without blocking submit | smoke | `node --test frontend/tests/report-minimap.test.mjs` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | MAP-02 | — | `view=map` renders map shell | smoke | `node --test frontend/tests/dashboard-map.test.mjs` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | MAP-03 | — | URL `bbox` param in query builder | unit | `node --test frontend/tests/dashboard-geo-params.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_geo_pins.py` — MAP-03 API contract
- [ ] `backend/tests/test_postgis_migration.py` — MAP-01 migration/RPC
- [ ] `frontend/tests/dashboard-map.test.mjs` — dashboard map view smoke
- [ ] `frontend/tests/report-minimap.test.mjs` — citizen mini-map degradation
- [ ] `frontend/tests/dashboard-geo-params.test.mjs` — URL param builder

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MapLibre tiles render in browser | MAP-02 | Requires canvas/WebGL | Open `/dashboard?view=map`; confirm OSM tiles + attribution |
| Bbox draw on map | MAP-03 | Pointer interaction | Draw rectangle; confirm URL `bbox` updates and pins filter |
| Cluster click zoom | D-05 | Visual map behavior | Click cluster bubble; map zooms/expands |
| docker-compose reaches host Supabase | D-21 | Docker networking | `supabase start` then `docker compose up`; login + map load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
