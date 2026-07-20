---
phase: 06-maps-geospatial
plan: "01"
subsystem: api
tags: [postgis, fastapi, supabase, geo, docker-compose]

requires:
  - phase: 06-maps-geospatial
    provides: CONTEXT/RESEARCH/UI-SPEC locked bbox-only + client clustering decisions
provides:
  - PostGIS migration with generated geography column + GIST index
  - get_report_geo_pins RPC returning pins + unlocated_count
  - GET /api/v1/reports/geo/pins (officer JWT)
  - bbox param on /summary and /export
  - docker-compose.yml (backend+frontend only)
  - backend/tests/test_geo_pins.py, test_postgis_migration.py
affects:
  - 06-03 dashboard map (consumes geo pins API)

tech-stack:
  added: []
  patterns:
    - PostGIS ST_Intersects via Supabase RPC
    - Minimal pin projection (D-20 fields only)
    - Localhost supabase migration up (not remote push)

key-decisions:
  - Bbox-only geo filter at API layer; no radius endpoint
  - Export/summary bbox uses client-side lat/lng filter; map pins use PostGIS RPC
  - Docker compose excludes Supabase per D-21

deviations:
  - Task 4 (supabase migration up) requires human run on localhost — not executed in agent session

human-checkpoints:
  - Run `supabase migration up` locally to apply 20260721_* migrations

verification:
  - pytest tests/test_geo_pins.py tests/test_postgis_migration.py (requires backend venv with deps)

status: partial
completed: 2026-07-21
---

# 06-01 Summary — Track A PostGIS + Geo API

PostGIS migrations, geo pins RPC, officer REST endpoint, bbox on summary/export, tests, and docker-compose app stack delivered. **Pending:** local `supabase migration up` on host (Task 4 checkpoint).

## Tasks

| Task | Status | Notes |
|------|--------|-------|
| 1 Wave 0 tests | done | test_geo_pins.py, test_postgis_migration.py |
| 2 PostGIS + RPC + sink | done | list_geo_pins via get_report_geo_pins |
| 3 FastAPI /geo/pins + bbox export/summary | done | |
| 4 [BLOCKING] migration up | pending | Human: `supabase migration up` |
| 5 docker-compose | done | No supabase service |

## API

`GET /api/v1/reports/geo/pins?west=&south=&east=&north=&filter_bbox=optional&...filters`

Response: `{ "pins": [...], "unlocated_count": N }`
