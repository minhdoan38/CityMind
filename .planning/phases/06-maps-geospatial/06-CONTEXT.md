# Phase 6: Maps & Geospatial - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver spatial intelligence for officers and optional citizen location picking: enable PostGIS on Supabase with geo indexes; expose bbox/radius/cluster geo APIs; add a MapLibre GL incident map on the officer dashboard that toggles with the existing table view; integrate bbox geo filtering with Phase 3 filter chrome; ship an optional pin-drop mini map on the citizen report form; provide a **docker-compose one-shot** local dev stack (**backend + frontend only** — Supabase runs separately via localhost CLI).

**In scope:** MAP-01, MAP-02, MAP-03.

**Out of scope this phase:** Real-time streaming map updates / WebSocket push; heatmaps beyond cluster counts; routing/turn-by-turn; geocoding admin tools; officer-drawn polygon unions with arbitrary complexity; public incident map; analytics chart maps (Phase 5 table hotspots remain); Phase 7 triage UX; email/SMS notifications.

</domain>

<decisions>
## Implementation Decisions

### Map ↔ table toggle (officer dashboard)
- **D-01:** **Table remains the default** when an officer opens `/dashboard`. Map is a secondary view via explicit toggle/tab — do not replace the table-first workflow from Phase 3.
- **D-02:** Persist view mode in URL `searchParams` (e.g. `view=table|map`, default `table`) so refresh/share keeps the active view. Reuse Phase 3 filter params when switching views — map and table share the same filtered dataset.
- **D-03:** **Marker click navigates** to `/dashboard/reports/[reportId]` (full detail page). No side-panel preview in MVP.
- **D-04:** Sidebar adds a **Map** destination (or Reports sub-nav) consistent with existing dashboard chrome; map route may be `/dashboard` with `view=map` or `/dashboard/map` — planner picks one pattern, but URL-synced filters are mandatory.

### Clustering & pin density
- **D-05:** Use **MapLibre GL clustering** (supercluster-style) for incident pins. Show **numeric cluster counts** on bubbles; click cluster to zoom/expand.
- **D-06:** Pin/marker styling reflects **priority** (align with Phase 3 badge semantics — text + color, not color-only). Status may appear in popup/tooltip on hover if cheap; priority is the primary visual channel.
- **D-07:** At high zoom, show individual pins; at low zoom, cluster. Planner sets sensible `clusterMaxZoom` / `clusterRadius` defaults; no custom server-side clustering beyond PostGIS viewport query + client cluster layer unless performance requires it.

### Geo filter interaction
- **D-08:** Officers filter geographically via **bbox draw on the map only** (no separate radius-circle tool in MVP). Drawn bbox syncs to URL params and applies together with existing status/category/priority/date filters from Phase 3.
- **D-09:** Filter panel shows active bbox summary (e.g. "Map area selected") with **Clear geo filter** control. Clearing geo filter removes bbox params but keeps other filters.
- **D-10:** Backend geo API supports **bbox query** (MAP-03) using PostGIS; radius endpoint optional only if trivial alongside bbox — **bbox is the locked MVP interaction**.

### Citizen pin-drop mini map (Track B)
- **D-11:** **Ship Track B** in Phase 6: add a **small interactive mini map** on the report form that **supplements** the existing browser geolocation button and manual lat/lng fields — do not remove manual entry.
- **D-12:** Pin-drop updates the same `latitude`/`longitude` form fields consumed by analyze API today. Default map center: sensible city-level default or last geolocation if available — agent discretion.
- **D-13:** Mini map is **citizen-facing only** on `/[locale]/report` (or report form surface); officers do not use it on dashboard.

### Basemap & tile provider
- **D-14:** **Local dev:** free **OpenStreetMap**-compatible raster tiles (with required attribution). **Production:** env-configurable tile provider (MapTiler or equivalent) via `NEXT_PUBLIC_MAP_TILE_URL` + attribution env vars — do not hardcode API keys.
- **D-15:** MapLibre GL only (locked in PROJECT.md). No Google Maps, no Leaflet.

### Reports without coordinates
- **D-16:** Reports missing lat/lng are **hidden from the map** (not plotted at city center). Map empty/summary state shows a count: **"N reports lack location"** (or equivalent EN/VI catalog copy) so officers know data is omitted intentionally.
- **D-17:** Table view still shows all reports regardless of coordinates; only map view filters to geocoded subset unless officer applies other filters.

### PostGIS & data model (Track A)
- **D-18:** Enable **PostGIS extension** on Supabase; add `geometry`/`geography` column or generated point from existing `latitude`/`longitude` DOUBLE PRECISION columns with **GIST index** (MAP-01). Migrate additively — do not drop float columns used by existing APIs.
- **D-19:** Officer geo APIs are **JWT-protected** like list/export. Citizen submit path unchanged except Track B UI feeding same lat/lng fields.
- **D-20:** Cluster/viewport endpoint returns minimal fields for map pins: `report_id`, `latitude`, `longitude`, `priority`, `status`/`current_status`, `category`, `created_at` — no description, notes, tokens, or evidence URIs on map payloads.

### Docker one-shot local dev
- **D-21:** Phase 6 delivers **`docker-compose` app stack**: **backend + frontend only** runnable with one command (`docker compose up` or documented wrapper script). **Supabase is NOT in Docker** — developers run localhost Supabase separately (`supabase start`, `supabase migration up`) per existing project ops (STATE.md).
- **D-22:** Compose file lives at repo root or `scripts/` with README section; env examples point at host Supabase URLs (`localhost:54321`, etc.). README documents prerequisite: Supabase CLI running before `docker compose up`. This is **dev ergonomics**, not Cloud Run production deployment replacement.

### Claude's Discretion
- Exact URL param names for bbox (`geo_bbox`, `north/south/east/west`, etc.) as long as D-08/D-09 hold
- Map vs table toggle UI pattern (segmented control vs tabs) within Clinic Blue dashboard chrome
- Whether `/dashboard/map` is a separate route or `view=map` on `/dashboard` — prefer URL-synced filters over route aesthetics
- PostGIS column strategy (`geography(Point,4326)` generated vs stored geometry)
- MapTiler vs other prod tile vendor when env-configured
- Cluster color token mapping to existing priority badge palette

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — MapLibre + PostGIS deferred to Phase 6; performance constraints
- `.planning/REQUIREMENTS.md` — MAP-01, MAP-02, MAP-03
- `.planning/ROADMAP.md` — Phase 6 goal, three tracks (06-01..06-03), success criteria
- `.planning/STATE.md` — Milestone position; localhost Supabase ops

### Prior phase decisions (integration)
- `.planning/phases/03-dashboard-polish/03-CONTEXT.md` — Table-first dashboard, URL filter sync, sidebar chrome
- `.planning/phases/02-public-experience/02-CONTEXT.md` — Report form lat/lng + geolocation; maps deferred
- `.planning/phases/05-analytics-pipeline/05-CONTEXT.md` — Hotspots are table-only; no map widgets on analytics tab

### Schema & code touchpoints
- `supabase/migrations/20260720_000001_foundation.sql` — `latitude`/`longitude` on reports
- `frontend/src/components/ReportForm.tsx` — geolocation + manual lat/lng fields (Track B extends)
- `frontend/src/app/dashboard/page.tsx` — Reports table view (Track C toggles with map)
- `backend/app/api/reports.py` — analyze accepts lat/lng form fields

### External references
- [MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/) — clustering, sources, layers
- [Supabase PostGIS guide](https://supabase.com/docs/guides/database/extensions/postgis) — extension enablement
- [OpenFreeMap / OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) — dev tile attribution

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/ReportForm.tsx` — lat/lng Zod fields + `navigator.geolocation` button; Track B mini map writes same fields
- `frontend/src/app/dashboard/page.tsx` + `ReportsFilters.tsx` + `ReportsTable.tsx` — filter URL sync pattern to extend for `view=map` and bbox params
- `frontend/src/components/DashboardSidebar.tsx` — add Map nav entry
- `frontend/src/lib/backend.ts` / `officerFetch` — officer API proxy pattern for geo endpoints
- `supabase/migrations/*` — additive PostGIS migration alongside existing float columns

### Established Patterns
- URL `searchParams` persistence for dashboard state (Phase 3 filters, Phase 5 analytics date range)
- Officer JWT via `getClaims` / Bearer `officerFetch`; public BFF separate from officer routes
- shadcn/ui + Clinic Blue tokens; bilingual EN/VI via next-intl catalogs
- Localhost Supabase — `supabase migration up` / local stack, not remote `db push` requirement for dev

### Integration Points
- PostGIS migration → Supabase reports table → new FastAPI geo router or reports sub-routes
- MapLibre React component on dashboard → calls officer geo cluster/bbox API → respects Phase 3 filter query builder
- Mini map on report form → updates RHF lat/lng → existing analyze POST unchanged

</code_context>

<specifics>
## Specific Ideas

- User wants **Docker one-shot running** — backend + frontend via docker-compose; **no Supabase in Docker** (localhost Supabase CLI remains the database/auth path).
- User selected **all discussion areas** — table-default map toggle, MapLibre clustering, bbox-only geo filter, citizen mini map supplementing geolocation, OSM dev + env-configurable prod tiles, hide unlocated reports with visible count.

</specifics>

<deferred>
## Deferred Ideas

- Radius-circle geo filter (chose bbox-only for MVP)
- Side-panel marker preview (chose navigate-to-detail)
- Map as default dashboard view (chose table default)
- Replacing manual lat/lng fields with map-only input (chose supplement)
- Real-time live map updates / websocket push
- Public-facing incident map

</deferred>

---

*Phase: 06-maps-geospatial*
*Context gathered: 2026-07-21*
