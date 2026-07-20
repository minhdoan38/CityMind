# Phase 6: Maps & Geospatial - Research

**Researched:** 2026-07-21
**Domain:** PostGIS on Supabase, FastAPI geo pin API, MapLibre GL + react-map-gl dashboard map, citizen mini-map, docker-compose app stack
**Confidence:** HIGH (codebase patterns + npm registry + CONTEXT/UI-SPEC locks); MEDIUM (PostGIS Supabase local enablement; lightweight bbox draw implementation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Map ↔ table toggle (officer dashboard)
- **D-01:** **Table remains the default** when an officer opens `/dashboard`. Map is secondary via explicit toggle/tab.
- **D-02:** Persist view mode in URL `searchParams` (`view=table|map`, default `table`). Map and table share the same filtered dataset.
- **D-03:** **Marker click navigates** to `/dashboard/reports/[reportId]`. No side-panel preview in MVP.
- **D-04:** Sidebar adds Map destination consistent with dashboard chrome; URL-synced filters mandatory.

#### Clustering & pin density
- **D-05:** **MapLibre GL client-side clustering** with numeric cluster counts; click cluster to zoom/expand.
- **D-06:** Pin styling reflects **priority** (align Phase 3 badge semantics — text + color). Status may appear in tooltip/list only.
- **D-07:** High zoom = individual pins; low zoom = clusters. Client `clusterMaxZoom` / `clusterRadius` defaults; no custom server-side clustering unless performance requires later.

#### Geo filter interaction
- **D-08:** Officers filter geographically via **bbox draw on map only** (no radius-circle tool).
- **D-09:** Filter panel shows active bbox summary with **Clear geo filter** control.
- **D-10:** Backend geo API supports **bbox query** using PostGIS; **bbox is the locked MVP interaction**.

#### Citizen pin-drop mini map (Track B)
- **D-11:** Ship Track B: **small interactive mini map** on report form supplementing geolocation + manual lat/lng fields.
- **D-12:** Pin-drop updates same `latitude`/`longitude` form fields consumed by analyze API.
- **D-13:** Mini map is citizen-facing only on `/[locale]/report`.

#### Basemap & tile provider
- **D-14:** **Local dev:** OSM-compatible raster tiles with attribution. **Production:** env-configurable via `NEXT_PUBLIC_MAP_TILE_URL` + attribution env vars.
- **D-15:** MapLibre GL only. No Google Maps, no Leaflet.

#### Reports without coordinates
- **D-16:** Reports missing lat/lng **hidden from map**; show count **"{count} reports lack location"**.
- **D-17:** Table view shows all reports; only map view filters to geocoded subset.

#### PostGIS & data model (Track A)
- **D-18:** Enable **PostGIS extension**; add geography/geometry from existing `latitude`/`longitude` with **GIST index**. Migrate additively — do not drop float columns.
- **D-19:** Officer geo APIs are **JWT-protected** like list/export.
- **D-20:** Geo pin endpoint returns minimal fields: `report_id`, `latitude`, `longitude`, `priority`, `status`, `category`, `created_at` — no description, notes, tokens, evidence.

#### Docker one-shot local dev
- **D-21:** **`docker-compose` app stack**: **backend + frontend only**. **Supabase NOT in Docker** — localhost CLI (`supabase start`, `supabase migration up`).
- **D-22:** Compose env points at host Supabase URLs (`localhost:54321`); README documents Supabase prerequisite.

### Claude's Discretion
- Exact URL param names for bbox
- Map vs table toggle UI pattern (segmented control vs tabs)
- `/dashboard/map` vs `view=map` on `/dashboard` — prefer URL-synced filters
- PostGIS column strategy (`geography(Point,4326)` generated vs stored)
- MapTiler vs other prod tile vendor when env-configured
- Cluster color token mapping to priority badge palette

### Deferred Ideas (OUT OF SCOPE)
- Radius-circle geo filter
- Side-panel marker preview
- Map as default dashboard view
- Replacing manual lat/lng with map-only input
- Real-time WebSocket live map updates
- Public incident map
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | PostGIS enabled; geo indexes on report coordinates | Track A: `CREATE EXTENSION postgis`; generated `geog` column + GIST; additive migration `supabase/migrations/20260721_*_postgis.sql` |
| MAP-02 | MapLibre GL incident map on dashboard with clustering | Track C: `maplibre-gl` + `react-map-gl/maplibre`; client `Source` cluster layer; `next/dynamic` SSR guard |
| MAP-03 | Bbox geo filter API and map-integrated filter UI | Track A+C: PostGIS `ST_MakeEnvelope` bbox filter; URL `bbox` param; draw + panel fallback per UI-SPEC |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- **Tech stack:** FastAPI for API; Supabase for ops; BigQuery analytics-only. `[CITED: AGENTS.md]`
- **Security:** Officer JWT for protected routes; access tokens hashed at rest — never on map payloads. `[CITED: AGENTS.md]` `[CITED: D-19/D-20]`
- **Privacy:** Token-scoped citizen status; map popups/list must not leak PII. `[CITED: AGENTS.md]`
- **Locale:** Bilingual EN/VI for new map chrome. `[CITED: AGENTS.md]` `[CITED: 06-UI-SPEC.md]`
- **Localhost Supabase:** Use `supabase migration up` / local stack — not remote `db push` for dev. `[CITED: STATE.md]` `[CITED: D-21/D-22]`

## Summary

Phase 6 adds spatial intelligence in three **parallel MVP tracks** aligned with ROADMAP 06-01..06-03. The codebase already stores `latitude`/`longitude` on `reports` (`DOUBLE PRECISION`) and accepts them on analyze. `[VERIFIED: supabase/migrations/20260720_000001_foundation.sql]` `[VERIFIED: backend/app/api/reports.py]` There is **no PostGIS extension, no geo API, no map dependencies** in `frontend/package.json` today. `[VERIFIED: frontend/package.json]`

**Track A** adds PostGIS + officer geo read API on FastAPI, reusing `SupabaseReportSink._apply_filters` attribute filter pattern and `require_officer` JWT gate from Phase 3. `[VERIFIED: backend/app/services/supabase.py]` `[VERIFIED: backend/app/api/reports.py]` Bbox filtering should use PostGIS `ST_Intersects(geog, ST_MakeEnvelope(west, south, east, north, 4326))` with `latitude IS NOT NULL AND longitude IS NOT NULL`. Return GeoJSON FeatureCollection or flat pin array for client clustering.

**Track B** adds `ReportLocationMiniMap` via `next/dynamic(() => import(...), { ssr: false })` inside existing `ReportForm.tsx` RHF fields — no analyze API change. `[VERIFIED: frontend/src/components/ReportForm.tsx]`

**Track C** extends `DashboardSearchParams` / `buildReportsQuery` in `frontend/src/components/reports/types.ts` with `view` and `bbox`; toggles table vs `ReportsMapView` on same `/dashboard` page. `[VERIFIED: frontend/src/app/dashboard/page.tsx]` `[VERIFIED: types.ts]` Client-side MapLibre clustering on fetched pins (not server cluster endpoint). `[CITED: 06-CONTEXT.md D-05]` `[CITED: 06-UI-SPEC.md]`

**Docker:** New root `docker-compose.yml` for backend + frontend only; `SUPABASE_URL=http://host.docker.internal:54321` (Windows) or `http://127.0.0.1:54321` with `network_mode` considerations. No Supabase service in compose. `[CITED: D-21/D-22]`

**Primary recommendation:** Pin versions `maplibre-gl@^5.24.0`, `react-map-gl@^8.1.1` `[VERIFIED: npm registry 2026-07-21]`; PostGIS migration via Supabase CLI local; new `GET /api/v1/reports/geo/pins` (+ optional `unlocated_count` in response); frontend dynamic map components per UI-SPEC; compose file as dev ergonomics only.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PostGIS extension + GIST index | Database (Supabase migration) | — | MAP-01; spatial queries in DB |
| Bbox + attribute pin query | API (FastAPI + Supabase/PostGIS) | — | Officer JWT; minimal payload D-20 |
| Unlocated count in filtered set | API (same geo endpoint meta) | Frontend display | D-16 dynamic copy |
| Dashboard map render + cluster | Browser (MapLibre client) | Frontend Server (RSC shell) | D-05; SSR guard via dynamic import |
| Bbox draw + URL sync | Browser (client map + panel) | — | MAP-03; extends Phase 3 params |
| Citizen mini-map | Browser (client) | — | Track B optional; degrade gracefully |
| Tile URLs / attribution | Config (env) | Browser | D-14 OSM dev tiles |
| docker-compose app stack | Infra (repo root) | — | D-21 backend+frontend only |

## Standard Stack

| Layer | Choice | Version | Source |
|-------|--------|---------|--------|
| Map engine | `maplibre-gl` | `^5.24.0` (latest 5.x) | `[VERIFIED: npm registry]` |
| React bindings | `react-map-gl` (import `react-map-gl/maplibre`) | `^8.1.1` | `[VERIFIED: npm registry]` |
| PostGIS | Supabase Postgres extension | PostGIS 3.x (bundled with Supabase) | `[CITED: https://supabase.com/docs/guides/database/extensions/postgis]` |
| Geo query | Raw SQL via Supabase RPC or service-role | — | `[ASSUMED]` PostgREST cannot express PostGIS bbox without RPC/view |
| Dashboard UI | shadcn + existing Phase 3 components | radix-nova | `[VERIFIED: frontend/components.json]` |
| Officer auth | Supabase JWT + `require_officer` | existing | `[VERIFIED: backend/app/security.py]` |
| URL state | Native `searchParams` | no nuqs | `[CITED: 03-RESEARCH.md]` `[CITED: 06-UI-SPEC.md]` |
| Dev tiles | OSM raster template URL in env | e.g. `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | `[CITED: D-14]` `[CITED: OSM tile policy]` |
| Tests | pytest (backend) + `node --test` (frontend smoke) | pytest 8.4.1 | `[VERIFIED: backend/pyproject.toml]` `[VERIFIED: Phase 5 pattern]` |

**Install command (frontend):**
```bash
cd frontend && npm install maplibre-gl@^5.24.0 react-map-gl@^8.1.1
```

**SUS checkpoint:** MapLibre + react-map-gl are new direct deps — planner should flag at plan-checker / execute SUS gate per UI-SPEC Registry Safety.

## Architecture Patterns

### Track A — PostGIS migration (MAP-01)

**Recommended migration** (`supabase/migrations/20260721_000001_postgis.sql`):

```sql
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS reports_geog_gist_idx
  ON public.reports USING GIST (geog)
  WHERE geog IS NOT NULL;
```

`[CITED: Supabase PostGIS guide]` `[ASSUMED]` `extensions` schema — verify local `supabase start` PostGIS path; fallback `CREATE EXTENSION postgis` in `public` if local CLI differs.

**Apply locally:** `supabase migration up` (not `db push` to remote). `[CITED: STATE.md]`

### Track A — Geo pins API (MAP-03 backend)

**New route:** `GET /api/v1/reports/geo/pins`

| Query param | Purpose |
|-------------|---------|
| `west`, `south`, `east`, `north` | Viewport bbox (WGS84) — required |
| `status`, `category`, `priority`, `min_severity`, `max_severity`, `created_after`, `created_before` | Reuse list filters |
| Optional `bbox` filter param | Officer-drawn filter bbox (intersect with viewport) |

**Response shape:**
```json
{
  "pins": [
    {"report_id": "...", "latitude": 21.03, "longitude": 105.85, "priority": "high", "status": "new", "category": "infrastructure", "created_at": "..."}
  ],
  "unlocated_count": 4
}
```

`unlocated_count` = reports matching attribute filters but missing coords (for D-16). `[CITED: D-16]` `[CITED: D-20]`

**Implementation options (recommend #1):**

1. **Supabase RPC** `get_report_pins(viewport_w, viewport_s, viewport_e, viewport_n, filter_bbox_w, ...)` — SQL function with `ST_Intersects`, `SECURITY DEFINER`, officer check. `[ASSUMED]` cleanest for PostGIS.
2. **FastAPI raw SQL** via `asyncpg` / Supabase REST `.rpc()` — same SQL, called from `SupabaseReportSink.list_geo_pins()`.

Reuse `_validate_report_filters` from `reports.py`. `[VERIFIED: backend/app/api/reports.py]`

**Export integration:** Extend export query builder to accept same `bbox` param when geo filter active (06-UI-SPEC). `[CITED: 06-UI-SPEC.md]`

### Track B — Citizen mini-map (MAP-02 partial / form UX)

- Component: `frontend/src/components/ReportLocationMiniMap.tsx` (client).
- Load: `const Map = dynamic(() => import('./ReportLocationMiniMapInner'), { ssr: false, loading: () => <Skeleton /> })`
- Map style: raster source from `process.env.NEXT_PUBLIC_MAP_TILE_URL` with `tiles: [url]` in style JSON, or use `maplibre-gl` raster layer helper.
- Default center: `21.0285, 105.8542` zoom 12 (Hanoi). `[CITED: 06-UI-SPEC.md]`
- On click: `form.setValue('latitude', lat.toFixed(6))` — same as geolocation button. `[VERIFIED: ReportForm.tsx]`
- Failure: hide map, show degraded helper — submit unaffected. `[CITED: D-11]` `[CITED: 06-UI-SPEC.md]`

### Track C — Dashboard map (MAP-02/03)

**Page integration:** `dashboard/page.tsx` reads `view` from `searchParams`. If `view=map`, render `ReportsMapView` instead of `ReportsTable`; keep `ReportsFilters`, `ReportsMetrics`, `ExportButton`. `[VERIFIED: dashboard/page.tsx pattern]`

**Extend types.ts:**
```typescript
export type DashboardSearchParams = {
  // existing...
  view?: string;
  bbox?: string; // west,south,east,north
};
```

**Client clustering pattern** (react-map-gl + maplibre):
```tsx
<Source
  id="reports"
  type="geojson"
  data={geojsonFromPins}
  cluster
  clusterMaxZoom={14}
  clusterRadius={50}
>
  <Layer id="clusters" type="circle" filter={['has', 'point_count']} ... />
  <Layer id="cluster-count" type="symbol" filter={['has', 'point_count']} ... />
  <Layer id="unclustered-point" type="circle" filter={['!', ['has', 'point_count']]} ... />
</Source>
```
`[CITED: MapLibre clustering docs]` `[CITED: D-05/D-07]`

**Marker click:** `router.push(`/dashboard/reports/${reportId}`)` — no popup gate. `[CITED: D-03]`

**Viewport fetch:** Debounce `moveend` 300ms; pass map bounds as `west,south,east,north` to geo pins API. When URL `bbox` filter set, also pass filter bbox for server-side intersection.

**Bbox draw:** Lightweight approach — track mousedown/mousemove/mouseup on map canvas to draw rectangle overlay (div or MapLibre fill layer), then set URL `bbox` on Apply. Panel numeric inputs as keyboard fallback. `[CITED: D-08]` `[CITED: 06-UI-SPEC.md]` Avoid `@maplibre/maplibre-gl-draw` unless draw UX insufficient — adds bundle weight. `[ASSUMED]`

### Track D — docker-compose (D-21)

New `docker-compose.yml` at repo root:

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    extra_hosts:
      - "host.docker.internal:host-gateway"
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      BACKEND_API_URL: http://backend:8000
      NEXT_PUBLIC_SUPABASE_URL: http://host.docker.internal:54321
```

Document: run `supabase start` on host first. **No** `supabase` service in compose. `[CITED: D-21/D-22]`

Existing Dockerfiles: `frontend/Dockerfile`, `backend/Dockerfile`. `[VERIFIED: repo]`

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Map rendering | MapLibre GL + react-map-gl | D-15 lock; SSR pitfalls documented |
| Client clustering | MapLibre `Source` cluster props | D-05; don't ship supercluster separately unless needed |
| Officer auth on geo routes | `require_officer` dependency | Existing pattern |
| URL filter state | Extend `buildReportsQuery` | Phase 3 pattern |
| PostGIS point from lat/lng | Generated geography column | Keeps float columns for analyze API |
| Tile server in dev | OSM raster env URL | D-14; no MapTiler key required |
| Supabase in Docker | Host CLI | D-21 explicit user decision |

## Common Pitfalls

| Pitfall | Mitigation |
|---------|------------|
| SSR crash (`window is not defined`) | `next/dynamic` with `ssr: false` for all MapLibre components |
| Import `react-map-gl` instead of `react-map-gl/maplibre` | Use `/maplibre` entry per UI-SPEC |
| Forgetting `maplibre-gl/dist/maplibre-gl.css` | Import once in map client bundle |
| Server-side clustering endpoint | Client clusters per D-05; server returns flat pins in viewport |
| Radius filter UI | Out of scope — ROADMAP success criteria mention radius but CONTEXT supersedes to bbox-only; planner must follow CONTEXT |
| Plotting reports without coords at (0,0) | Filter `geog IS NOT NULL`; show `unlocated_count` |
| Popup blocking navigation | Direct `router.push` on marker click per D-03 |
| PostGIS extension on remote push | Local `supabase migration up` only for dev |
| Docker can't reach host Supabase | `host.docker.internal` / `extra_hosts` on Windows |
| OSM tile usage policy | Show attribution; respect usage policy for dev volume |
| Geo endpoint returning PII | Select only D-20 fields; no `description`, `summary`, tokens |
| Export ignoring bbox | Pass bbox to export endpoint when geo filter active |

## Code Examples

### Officer geo fetch (BFF pattern)

Follow `officerFetch` in `frontend/src/lib/backend.ts` — add Next API route `frontend/src/app/api/officer/reports/geo/pins/route.ts` proxying to FastAPI with JWT cookie, same as recent/summary. `[VERIFIED: Phase 3 BFF pattern]`

### FastAPI route sketch

```python
@router.get("/geo/pins")
async def geo_pins(
    west: float = Query(..., ge=-180, le=180),
    south: float = Query(..., ge=-90, le=90),
    east: float = Query(..., ge=-180, le=180),
    north: float = Query(..., ge=-90, le=90),
    filter_bbox: str | None = Query(None),  # optional west,south,east,north
    officer: OfficerPrincipal = Depends(require_officer),
    # ... attribute filters
):
    if west >= east or south >= north:
        raise HTTPException(422, "Invalid bbox")
    pins, unlocated = sink.list_geo_pins(...)
    return {"pins": pins, "unlocated_count": unlocated}
```

### Env vars (frontend `.env.example` additions)

```
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=© OpenStreetMap contributors
```

## Validation Architecture

> `workflow.nyquist_validation` is **true** in project config. `[VERIFIED: gsd-sdk init]`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.4.1 (backend); Node test runner via `frontend/tests/*.test.mjs` |
| Config file | `backend/pyproject.toml` |
| Quick run command | `cd backend && pytest tests/test_geo_pins.py -q` |
| Full suite command | `cd backend && pytest -q` && `node --test frontend/tests/*.test.mjs` |
| Estimated runtime | ~30–60s full |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | PostGIS migration applies; `geog` populated when lat/lng set | migration/integration | `pytest tests/test_postgis_migration.py -q` | ❌ Wave 0 |
| MAP-01 | GIST index exists on reports | sql | manual `supabase db lint` or migration test | ❌ Wave 0 |
| MAP-03 | Geo pins requires officer JWT (401 without) | api | `pytest tests/test_geo_pins.py::test_requires_auth -x` | ❌ Wave 0 |
| MAP-03 | Invalid bbox returns 422 | api | `pytest tests/test_geo_pins.py::test_invalid_bbox -x` | ❌ Wave 0 |
| MAP-03 | Pins exclude null coordinates | api | `pytest tests/test_geo_pins.py::test_skips_unlocated -x` | ❌ Wave 0 |
| MAP-03 | Pin payload has no description/summary/token fields | api | `pytest tests/test_geo_pins.py::test_pin_projection -x` | ❌ Wave 0 |
| MAP-03 | Bbox filter intersects officer-drawn bbox + viewport | api | `pytest tests/test_geo_pins.py::test_filter_bbox -x` | ❌ Wave 0 |
| D-16 | Response includes `unlocated_count` | api | `pytest tests/test_geo_pins.py::test_unlocated_count -x` | ❌ Wave 0 |
| MAP-02 | Dashboard `view=map` renders map shell (smoke) | smoke | `node --test frontend/tests/dashboard-map.test.mjs` | ❌ Wave 0 |
| MAP-02 | Report form mini-map degrades without blocking | smoke | `node --test frontend/tests/report-minimap.test.mjs` | ❌ Wave 0 |
| UI | URL `bbox` param parsed in buildReportsQuery | unit | `node --test frontend/tests/dashboard-geo-params.test.mjs` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted pytest or frontend smoke for touched track
- **Per wave merge:** full backend pytest + new map smoke tests
- **Phase gate:** green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_geo_pins.py` — MAP-03 API contract
- [ ] `backend/tests/test_postgis_migration.py` — MAP-01 (may use mocked RPC)
- [ ] `frontend/tests/dashboard-map.test.mjs` — view toggle + map shell
- [ ] `frontend/tests/report-minimap.test.mjs` — degradation path
- [ ] `frontend/tests/dashboard-geo-params.test.mjs` — URL param builder

## ROADMAP / CONTEXT Divergence Note

ROADMAP Phase 6 success criteria and plan 06-01 mention **"radius/bbox"** and **"cluster"** server API. **CONTEXT.md and UI-SPEC supersede for planning:**

| ROADMAP text | Locked decision |
|--------------|-----------------|
| Radius/bbox filter | **BBox only** (radius deferred) |
| Server cluster endpoint | **Client MapLibre clustering** on pin fetch |
| Click marker opens detail | **Direct navigation** (not popup-first) |

Planner and executor must follow CONTEXT + UI-SPEC + this research note.

## Planner Guidance (Track → Plan mapping)

| Plan | Track | Wave | Depends | Delivers |
|------|-------|------|---------|----------|
| 06-01 | A | 1 | — | PostGIS migration, `list_geo_pins`, `GET /geo/pins`, export bbox hook, pytest |
| 06-02 | B | 1 | — | `ReportLocationMiniMap`, env tiles, EN/VI strings, smoke test |
| 06-03 | C | 2 | 06-01 | `ReportsMapView`, toggle, clustering, bbox draw, URL sync, BFF route |

**Optional 06-04 (infra):** docker-compose backend+frontend + README — can be parallel Wave 1 per D-21.

**Schema push:** `[BLOCKING]` task after migration — `supabase migration up` on localhost (not remote push). `[CITED: plan-phase schema gate for Supabase]`

## Sources

| Claim | Tag |
|-------|-----|
| `latitude`/`longitude` on reports | `[VERIFIED: supabase/migrations/20260720_000001_foundation.sql]` |
| No map deps in frontend | `[VERIFIED: frontend/package.json]` |
| maplibre-gl 5.24.0, react-map-gl 8.1.1 | `[VERIFIED: npm registry]` |
| Phase 3 filter/URL pattern | `[VERIFIED: frontend/src/components/reports/types.ts]` |
| Officer list/summary fetch | `[VERIFIED: frontend/src/app/dashboard/page.tsx]` |
| ReportForm lat/lng + geolocation | `[VERIFIED: frontend/src/components/ReportForm.tsx]` |
| Supabase PostGIS extension | `[CITED: https://supabase.com/docs/guides/database/extensions/postgis]` |
| MapLibre clustering | `[CITED: https://maplibre.org/maplibre-gl-js/docs/examples/cluster/`]` |
| OSM tile policy | `[CITED: https://operations.osmfoundation.org/policies/tiles/]` |
| Bbox-only, client cluster, no Supabase docker | `[CITED: 06-CONTEXT.md]` |
| UI interaction contracts | `[CITED: 06-UI-SPEC.md]` |
| RPC vs raw SQL for PostGIS | `[ASSUMED]` — confirm during 06-01 implementation |

---

## RESEARCH COMPLETE

Phase 6 is ready for planning. Primary risks: PostGIS RPC design on local Supabase, lightweight bbox draw UX, docker→host Supabase networking on Windows.
