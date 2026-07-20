---
phase: 06-maps-geospatial
plan: "01"
subsystem: api
tags: [postgis, fastapi, supabase, geo, docker-compose, bbox]

requires:
  - phase: 06-maps-geospatial
    provides: CONTEXT/RESEARCH/UI-SPEC locked bbox-only + D-20 pin projection
provides:
  - PostGIS migration SQL (extension + generated geog + GIST index)
  - get_report_geo_pins RPC (ST_Intersects viewport + optional filter bbox)
  - SupabaseReportSink.list_geo_pins with D-20 field allowlist
  - GET /api/v1/reports/geo/pins (officer JWT)
  - Optional bbox param on GET /summary and GET /export
  - docker-compose.yml backend+frontend only (D-21/D-22)
  - Wave 0 tests test_geo_pins.py, test_postgis_migration.py
affects:
  - 06-03 dashboard map (consumes /geo/pins)

tech-stack:
  added: []
  patterns:
    - PostGIS ST_Intersects via Supabase RPC get_report_geo_pins
    - Minimal pin projection (D-20 fields only)
    - Bbox-only geo filter — no radius endpoint (D-10)
    - Localhost supabase migration up (not remote db push)

key-files:
  created:
    - supabase/migrations/20260721_000001_postgis.sql
    - supabase/migrations/20260721_000002_geo_pins_rpc.sql
    - backend/tests/test_geo_pins.py
    - backend/tests/test_postgis_migration.py
    - docker-compose.yml
  modified:
    - backend/app/api/reports.py
    - backend/app/services/supabase.py
    - frontend/.env.example
    - README.md

key-decisions:
  - RPC named get_report_geo_pins (plan alias get_report_pins) — same contract
  - Export/summary bbox uses client-side lat/lng filter; map pins use PostGIS RPC
  - Docker compose excludes Supabase per D-21

requirements-completed: []

duration: 25min
completed: 2026-07-21
---

# Phase 6 Plan 01: PostGIS Geo Pins API Summary

**PostGIS migrations, bbox-only officer geo pins endpoint with D-20 field projection, and docker-compose app stack — pending localhost `supabase migration up`.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 4/5 complete (Task 4 blocked at checkpoint)
- **Files modified:** 10

## Accomplishments

- PostGIS migration adds generated `geog geography(Point,4326)` + partial GIST index
- `get_report_geo_pins` RPC returns `{pins, unlocated_count}` with attribute filters and ST_Intersects bbox
- `GET /api/v1/reports/geo/pins` enforces `require_officer`, validates viewport bbox, supports `filter_bbox`
- Summary and export accept optional `bbox=west,south,east,north`
- `docker-compose.yml` runs backend+frontend only; README documents host Supabase prerequisite
- 15 targeted pytest cases green (geo pins, migration SQL, export)

## Task Commits

| Task | Commit | Notes |
|------|--------|-------|
| 1–3, 5 (bundled) | `447f01c` | Prior executor session — single feat commit |
| 4 [BLOCKING] | — | Checkpoint: Supabase CLI not on PATH |

**Plan metadata:** pending (Task 4 checkpoint)

## API

`GET /api/v1/reports/geo/pins?west=&south=&east=&north=&filter_bbox=optional&status=&category=&...`

Response: `{ "pins": [...], "unlocated_count": N }` — pin keys limited to D-20: `report_id`, `latitude`, `longitude`, `priority`, `status`, `category`, `created_at`.

## Deviations from Plan

### Commit bundling

Tasks 1–3 and 5 landed in one commit (`447f01c`) instead of per-task atomic commits. Code matches plan acceptance criteria.

### RPC naming

Plan references `get_report_pins`; migration uses `get_report_geo_pins` to avoid ambiguity with report detail lookups.

## Auth Gates / Checkpoints

**Task 4 — `supabase migration up` (blocking-human)**

- `supabase` CLI not found on PATH (`where supabase` empty; not in scoop or Program Files)
- Migrations exist on disk but are **not applied** to local Postgres
- MAP-01 requirement remains open until human runs migration

**Human steps:**

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli) and ensure `supabase` is on PATH
2. From repo root: `supabase start` (if not already running)
3. `supabase migration up` — apply `20260721_000001_postgis.sql` and `20260721_000002_geo_pins_rpc.sql`
4. Verify: `supabase migration list` shows both 20260721 migrations applied
5. Optional SQL check: `\dx postgis` and `SELECT get_report_geo_pins(105,20,106,22,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);`

## Self-Check: PASSED (code) / BLOCKED (Task 4)

- FOUND: `supabase/migrations/20260721_000001_postgis.sql`
- FOUND: `supabase/migrations/20260721_000002_geo_pins_rpc.sql`
- FOUND: `backend/tests/test_geo_pins.py`
- FOUND: `backend/tests/test_postgis_migration.py`
- FOUND: `docker-compose.yml`
- FOUND: commit `447f01c`
- BLOCKED: local `supabase migration up` — CLI unavailable

## Next Phase Readiness

- Track C (06-03) can integrate `/geo/pins` once Task 4 migration is applied on localhost
- Frontend map tiles env vars documented in `frontend/.env.example`

---
*Phase: 06-maps-geospatial*
*Plan: 01 — partial (Task 4 checkpoint)*
