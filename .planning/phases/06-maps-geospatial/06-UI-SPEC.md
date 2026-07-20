---
phase: 6
slug: maps-geospatial
status: approved
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables; primary Clinic Blue #2563EB (inherits Phase 3/5 contract; align globals.css at implementation)
created: 2026-07-21
inherits:
  - .planning/phases/03-dashboard-polish/03-UI-SPEC.md
  - .planning/phases/05-analytics-pipeline/05-UI-SPEC.md
  - .planning/phases/02-public-experience/02-UI-SPEC.md
sources:
  - REQUIREMENTS.md (MAP-01, MAP-02, MAP-03)
  - ROADMAP.md Phase 6 Tracks A∥B∥C
  - PROJECT.md (MapLibre GL + PostGIS; maps deferred to Phase 6)
  - STATE.md (deferred maps decision)
  - frontend/components.json (radix-nova, neutral, lucide)
  - frontend/src/app/globals.css (live tokens — teal in repo; contract uses Clinic Blue per Phase 3/5)
  - frontend/src/components/ReportForm.tsx (lat/lng fields, useMyLocation)
  - frontend/src/components/reports/types.ts (DashboardSearchParams, URL sync)
  - frontend/src/app/dashboard/page.tsx (Reports toolbar pattern)
  - react-map-gl/maplibre docs (MapLibre integration)
---

# Phase 6 — UI Design Contract

> Visual and interaction contract for **Maps & Geospatial** frontend surfaces.
>
> **Track A (06-01):** PostGIS + geo API (bbox, radius, cluster) — backend-first; UI contract covers API-driven states consumed by Track C only.
> **Track B (06-02):** Optional pin-drop **mini map** on bilingual citizen Report form (public register).
> **Track C (06-03):** MapLibre GL **full dashboard map** with clustering, table/map toggle, marker→detail, radius/bbox filters synced to URL.
>
> Out of scope: real-time WebSocket map updates; citizen `/status` map; analytics chart maps (Phase 5); routing/navigation directions; heatmap ML; dark map theme; 3D buildings; offline tiles; email/SMS geo alerts; image redaction on map thumbnails.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `frontend/components.json`) |
| Preset | `style: radix-nova`, `baseColor: neutral`, CSS variables; `--primary` = Clinic Blue `#2563EB` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react (`Map`, `MapPin`, `Layers`, `Crosshair`, `Square`, `Circle`, `Table2`, `LocateFixed`, `AlertTriangle`) |
| Font | Source Sans 3 only (400 / 600) |
| Register | **product** for `/dashboard` map surfaces; **brand/public civic** for Report form mini-map |

**Stack locks (Phase 6 — new dependencies):**

| Concern | Contract |
|---------|----------|
| Map engine | **MapLibre GL JS** (`maplibre-gl@^5.x`) — direct npm dependency |
| React bindings | **`react-map-gl/maplibre`** (`react-map-gl@^8.x`) — import `Map`, `Marker`, `Popup`, `Source`, `Layer` from `react-map-gl/maplibre`; import `maplibre-gl/dist/maplibre-gl.css` once in map client bundles |
| Clustering | Server-side cluster GeoJSON from Track A API (`/api/v1/reports/geo/clusters` or equivalent) — **not** client-side supercluster for officer map at MVP (keeps parity with filtered dataset) |
| Tile style | Env `NEXT_PUBLIC_MAP_STYLE_URL`; dev fallback `https://demotiles.maplibre.org/style.json` — no MapTiler token required for MVP |
| Draw / geo filter | Map-integrated bbox rectangle + radius circle **or** filter-panel numeric fallback (keyboard-accessible). Prefer lightweight custom handlers over heavy draw plugins unless RESEARCH confirms `@maplibre/maplibre-gl-draw` |
| URL sync | Extend Phase 3 `searchParams` on `/dashboard` — do **not** add `nuqs` |
| Dynamic import | Map bundles **client-only** via `next/dynamic` with `ssr: false` and skeleton placeholder — MapLibre requires `window` |
| Auth | Officer JWT for dashboard map/geo endpoints; public mini-map uses no officer auth (pin coords only, submitted with analyze) |

**Reuse existing:** `button`, `badge`, `input`, `label`, `alert`, `skeleton`, `separator`, `tooltip`, `sidebar`, `collapsible`, `select`, `slider` (radius km), `toggle-group` or `button` variant group (table/map), `card` (filter panel chrome only — flat border, no shadow), `dialog` (confirm clear geo filter if needed).

**Phase 6 add (shadcn official only, if missing):** `toggle-group`, `slider`. MapLibre/react-map-gl are **direct npm deps**, not shadcn blocks.

**Registry:** shadcn official only — `registries: {}`. No third-party shadcn registries. No third-party map UI blocks.

---

## Spacing Scale

Declared values (multiples of 4) — inherits Phase 3 product scale for dashboard; Phase 2 for public mini-map:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Map control icon gaps; popup internal pad |
| sm | 8px | Toggle group gaps; mini-map toolbar |
| md | 16px | Default; filter panel field stack; map toolbar → canvas gap |
| lg | 24px | Map sidebar/panel padding; Report form section gap above mini-map |
| xl | 32px | Dashboard page header → view toggle gap |
| 2xl | 48px | — |
| 3xl | 64px | Public Report page vertical rhythm only (Track B) |

Exceptions:
- **44px** min touch height for view toggle, Apply geo filter, Clear geo filter, Use my location, View report (popup), Retry
- **Map canvas min-height:** **480px** desktop (dashboard full map view); **320px** mobile dashboard; **200px** mobile / **240px** desktop for public mini-map — layout constraints, not spacing tokens
- Map floating controls (zoom +/-): **40×40** visual with **44×44** hit area via padding
- Dashboard map view: `main` may use `max-w-none` and reduced horizontal pad so map uses available width (override Phase 3 `max-w-6xl` on map view only)

---

## Typography

### Dashboard map (Track C) — product register

Exactly 4 sizes, 2 weights — same as Phase 3:

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px (0.875rem) | 400 | 1.4 | Map popup labels, cluster count, filter labels, control captions |
| Body | 16px (1rem) | 400 | 1.5 | Popup values, empty/error copy, panel helpers |
| Heading | 20px (1.25rem) | 600 | 1.2 | Page title “Reports”, geo filter panel title |
| Display | 28px (1.75rem) | 600 | 1.2 | **Not used** on map surfaces |

### Public mini-map (Track B) — public register

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px | 400 | 1.4 | Mini-map caption, coords readout |
| Body | 16px | 400 | 1.5 | Helper, degradation message |
| Heading | 20px | 600 | 1.2 | Location section title (existing) |
| Display | — | — | — | **Not used** on Report form |

**Rules:**
- No third weight (no 500/700).
- Cluster labels: Label 14px **semibold via weight 600 only on count numeral** — cluster count must be readable at zoom; never shrink below 14px (no map-canvas size exceptions).
- Map attribution text: browser default / MapLibre attribution — do not restyle below legibility.

---

## Color

60 / 30 / 10 restrained civic (light-only) — Clinic Blue contract (Phase 3/5):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Map canvas letterbox, popup surface, filter panel |
| Secondary (30%) | `#F1F5F9` | Map toolbar well, mini-map border container, panel bg |
| Accent (10%) | `#2563EB` | Reserved list below |
| Accent deep | `#1D4ED8` | Hover / pressed; active view toggle; selected pin |
| Soft accent | `#EFF6FF` | Bbox/radius preview fill (≤40% opacity); cluster circle fill |
| Destructive | `#DC2626` | Map load error Alert; clear-filter destructive optional |
| Ink | `#1A2B3C` | Body, popup text, cluster count numerals |
| Muted text | `#64748B` | Helpers, attribution, inactive toggle |
| Quiet line | `#E2E8F0` | Map container border, bbox stroke, panel dividers |

**Map-specific semantics (status — never color alone on markers):**

| Status | Marker ring / badge | Popup text |
|--------|---------------------|------------|
| new | Muted gray ring `#94A3B8` | “New” + category + priority |
| reviewing | Soft accent fill + ink text | “Reviewing” + category + priority |
| resolved | Clinic Blue ring (not fill) | “Resolved” + category + priority |
| rejected | Destructive ring (stroke only) | “Rejected” + category + priority |

Priority in popup: always **text label** (“Critical”, “High”, …) — no color-only dots.

Accent reserved for (only):
1. Active **Map** view toggle; primary **Apply geo filter**; **View report** link in popup
2. Selected pin on public mini-map
3. Focus-visible rings on map toolbar controls
4. Cluster count numeral (Clinic Blue text on soft-accent circle)
5. Active bbox/radius draw mode indicator

**Not accent:** basemap tiles, default zoom buttons (neutral outline), inactive table toggle, metric numbers, full-screen map flood.

**Forbidden:** dark basemap theme, purple/neon GIS chrome, 3D gradient extrusions, heatmap rainbow scales, cream/teal brand regression on dashboard map (align tokens to Clinic Blue at implementation).

---

## Visual hierarchy & focal points

| Surface | First focal | Second | Must not compete |
|---------|-------------|--------|------------------|
| Dashboard (table view) | Existing data table | Filters + metrics (Phase 3) | Map preview thumbnail |
| Dashboard (map view) | Full-width incident map | Floating geo filter bar + view toggle | Duplicate table rows under map |
| Map popup | Category + status + priority text | “View report” CTA | Description, citizen narrative, tokens, raw coords |
| Geo filter panel | Active mode (bbox / radius) + Apply | Sync indicator with URL | Permanent modal over entire map |
| Report form mini-map | Pin on map (when loaded) | Lat/lng fields + Use my location | Map as required gate before submit |
| Cluster | Count label (e.g. “12”) | Zoom on click | Pie charts on cluster |

**Layout (Track C — map view):**
1. Page header row: title + subtitle (unchanged) + **Table | Map** toggle + Export (export respects geo + attribute filters)
2. `ReportsFilters` (attribute filters) — unchanged collapsible; geo filters in **GeoFilterBar** below or right-floating over map
3. `ReportsMetrics` — unchanged; respects combined filters including geo
4. Map canvas: full content width, min-height 480px, 1px quiet border, radius `rounded-lg` (≤16px)
5. No split table+map simultaneously — single view via toggle

**Layout (Track B — mini-map):**
- Insert **below** existing lat/lng grid, inside location section (`border-t` block)
- Order: location label + helper → Use my location → lat/lng inputs → **mini-map** → location errors
- Mini-map container: `rounded-lg border border-border bg-secondary/30`, fixed height 240px (200px mobile)

---

## Component inventory (executor checklist)

| Component | Track | Spec |
|-----------|-------|------|
| `ReportLocationMiniMap` | B | Client-only dynamic import; click-to-pin; syncs RHF `latitude`/`longitude`; degradation wrapper |
| `ReportsViewToggle` | C | `ToggleGroup` or paired Buttons: Table / Map; syncs `view` URL param |
| `ReportsMapView` | C | MapLibre via react-map-gl; cluster Source/Layer; Marker/Popup; viewport fetch |
| `IncidentMapPopup` | C | category, status, priority only + View report link |
| `GeoFilterBar` | C | Mode: none / bbox / radius; draw hooks + panel fallback inputs |
| `GeoFilterPanel` | C | Numeric bbox (west,south,east,north) + center lat/lng + radius km slider; Apply / Clear |
| `MapCanvasSkeleton` | B,C | Rect skeleton matching map height; no fake tiles |
| `MapErrorState` | B,C | Alert + retry; Track B never blocks submit |
| Extend `DashboardSearchParams` | C | Add geo + view keys (see Interaction) |
| Extend `buildReportsQuery` | C | Pass geo params to list + summary + geo cluster endpoints |

---

## Screen contracts

### Track A — API-driven states (minimal UI)

No dedicated route. Track C consumes:

| API concern | UI state |
|-------------|----------|
| Cluster fetch loading | `MapCanvasSkeleton` over map area |
| Cluster fetch empty (no points in viewport + filters) | Calm empty overlay on map (see Copywriting) |
| Cluster fetch error | `Alert variant="destructive"` above map + Retry |
| Invalid bbox/radius (422) | Inline panel validation — do not fetch |
| Reports without coordinates | Excluded server-side; optional muted caption “Reports without location are hidden on the map.” |

### Track B — Public Report form mini-map (`ReportLocationMiniMap`)

| Property | Contract |
|----------|----------|
| Route | `/[locale]/report` — inside existing `ReportForm` |
| Locale | EN/VI via `public.*` message keys |
| Required? | **No** — location remains optional (Phase 2 D-09) |
| Default center | Vietnam centroid default `21.0285, 105.8542` zoom 12 if no coords; if browser geolocation succeeds, fly to user |
| Pin interaction | Click map → set pin → update lat/lng fields to 6 decimal places |
| Drag pin | Optional enhancement: draggable marker if RESEARCH cost low; else click-only MVP |
| Sync | Changing lat/lng inputs moves pin (debounced 300ms) |
| Failure | If map style/network fails: hide canvas, show Body helper “Map unavailable — enter coordinates or use your location.” Submit **unaffected** |
| Privacy | No officer data, no other reports, no clustering on public map |
| Motion | Pin drop: 150ms ease; honor `prefers-reduced-motion` |
| Tiles | Same `NEXT_PUBLIC_MAP_STYLE_URL` / demotiles fallback |

### Track C — Dashboard incident map (`ReportsMapView`)

| Property | Contract |
|----------|----------|
| Route | `/dashboard?view=map` (same page as table — toggle, not separate route) |
| Data | `officerFetch` geo cluster endpoint with viewport `bbox` + all attribute filters from URL |
| Cluster click | Zoom in step (+2 levels) or expand cluster per API `cluster_id` / `expansion_zoom` |
| Marker click | Open `IncidentMapPopup` anchored above marker |
| Popup → detail | “View report” navigates to `/dashboard/reports/[reportId]` |
| Popup content | **Only** localized category label, status badge text, priority text — no `summary`, no `report_id` in popup body (link carries id in href only for SR: “View report {id}”) |
| Pan/zoom | Debounce viewport fetch 300ms; show subtle loading indicator on toolbar (not full skeleton replace) |
| Table toggle | Returning to `view=table` preserves all URL filters including geo |
| Export | Export respects active geo + attribute filters when implemented in API (06-01) |
| Initial viewport | Fit bounds to cluster results when geo filter active; else default city center zoom 11 |

---

## Interaction contract

### URL parameters (extends Phase 3)

Add to `DashboardSearchParams`:

| Key | Values | Default | Notes |
|-----|--------|---------|-------|
| `view` | `table` \| `map` | `table` | View toggle |
| `geo_mode` | `bbox` \| `radius` | *(absent)* | Absent = no geo filter |
| `bbox` | `west,south,east,north` | — | WGS84 degrees; required when `geo_mode=bbox` |
| `center_lat` | float | — | Radius mode |
| `center_lng` | float | — | Radius mode |
| `radius_km` | float 0.1–50 | — | Radius mode; clamp in UI |

**Rules:**
- Applying attribute filters clears `cursor` (existing Phase 3 behavior).
- Applying geo filter clears `cursor`.
- `Clear geo filter` removes `geo_mode`, `bbox`, `center_*`, `radius_km` only — attribute filters remain.
- `Clear filters` (existing) clears attribute **and** geo keys.
- Invalid `bbox` (west≥east, out of range lat/lng): inline error, no fetch.

### Geo filter flows (MAP-03)

**Bbox mode:**
1. Officer selects “Area (rectangle)” in GeoFilterBar.
2. Draw rectangle on map **or** enter west/south/east/north in panel.
3. Apply → URL updated → cluster fetch + metrics + export query updated.
4. Rectangle preview: accent stroke 2px, soft-accent fill 25% opacity.

**Radius mode:**
1. Officer selects “Radius”.
2. Click map for center **or** enter center lat/lng in panel; adjust `radius_km` via slider (0.5–25 km default range) + numeric input.
3. Apply → URL updated → circle preview on map.

**Keyboard / SR fallback (required):**
- All draw modes must have equivalent panel inputs (no map-only path).
- GeoFilterBar buttons: `aria-pressed` for active mode.
- Instructions: “Use the fields below if you cannot draw on the map.”

### Table ↔ map toggle (MAP-02)

| Control | Behavior |
|---------|----------|
| Table | Default; existing `ReportsTable` |
| Map | Sets `view=map`; renders `ReportsMapView`; hides table |
| Deep link | `/dashboard?view=map&status=new` loads map with status filter |
| Mobile | Map view full width; geo panel collapses to bottom sheet pattern via `Collapsible` |

### Public mini-map interaction (Track B)

1. User may ignore map entirely.
2. “Use my location” still populates fields; map flies to coords if loaded.
3. Manual lat/lng entry moves pin.
4. Submit sends coords regardless of map load state.

### Motion

- View toggle, popup open, pin drop: 150–250ms `ease-out-expo`.
- Map pan/zoom: native MapLibre (no extra choreography).
- `prefers-reduced-motion`: no fly animations; instant `jumpTo`.

---

## Interaction states

### Dashboard map (Track C)

| State | Visual |
|-------|--------|
| Loading (initial) | `MapCanvasSkeleton` 480px |
| Loading (viewport pan) | Thin progress bar or spinner in GeoFilterBar (Label “Updating map…”) |
| Empty (no incidents) | Centered overlay on map: Heading-scale icon `Map` muted + empty copy |
| Empty (filters too tight) | Same as Phase 3 filtered empty spirit |
| Empty (no geo results) | “No reports in this area” + Clear geo filter CTA |
| Error (tiles) | Alert above map; table toggle still works |
| Error (API) | Alert destructive + Retry |
| Partial (reports lack coords) | Map shows available points; optional Caption below map |

### Public mini-map (Track B)

| State | Visual |
|-------|--------|
| Loading | Skeleton 240px |
| Ready | Map + pin |
| Degraded | Label message; lat/lng + Use my location remain |
| Error | No Alert blocking form — muted helper text only |

---

## Copywriting Contract

EN defaults; VI natural equivalents in `frontend/messages/{en,vi}.json` (`dashboard.map`, `public.map`). No hardcoded English in new chrome.

### Dashboard map (Track C)

| Element | EN | VI |
|---------|----|----|
| View toggle: table | Table | Bảng |
| View toggle: map | Map | Bản đồ |
| Page subtitle (map active) | Incidents with location appear on the map. AI stays advisory — you decide. | Sự cố có vị trí hiển thị trên bản đồ. AI chỉ hỗ trợ — bạn quyết định. |
| Primary CTA | Apply area filter | Áp dụng vùng lọc |
| Geo mode: none | No area filter | Không lọc vùng |
| Geo mode: bbox | Rectangle area | Vùng hình chữ nhật |
| Geo mode: radius | Radius | Bán kính |
| Draw bbox hint | Drag on the map to draw a rectangle, or enter coordinates below. | Kéo trên bản đồ để vẽ hình chữ nhật, hoặc nhập tọa độ bên dưới. |
| Draw radius hint | Click the map for the center, or enter coordinates below. | Nhấp bản đồ để chọn tâm, hoặc nhập tọa độ bên dưới. |
| Radius label | Radius (km) | Bán kính (km) |
| Clear geo filter | Clear area filter | Xóa lọc vùng |
| Popup: view report | View report | Xem báo cáo |
| Cluster label (a11y) | {count} reports in cluster | {count} báo cáo trong cụm |
| Updating map | Updating map… | Đang cập nhật bản đồ… |
| Empty heading | No located reports | Không có báo cáo có vị trí |
| Empty body | Try clearing filters, widening the area, or switch to the table view. | Thử xóa bộ lọc, mở rộng vùng, hoặc chuyển sang dạng bảng. |
| Empty area heading | No reports in this area | Không có báo cáo trong vùng này |
| Empty area body | Adjust the rectangle or radius, or clear the area filter. | Điều chỉnh hình chữ nhật hoặc bán kính, hoặc xóa lọc vùng. |
| Hidden coords note | Reports without location are hidden on the map. | Báo cáo không có vị trí sẽ không hiển thị trên bản đồ. |
| Error load | Could not load the incident map. Check your connection and try again. | Không thể tải bản đồ sự cố. Kiểm tra kết nối và thử lại. |
| Error tiles | Map tiles could not load. | Không thể tải lớp bản đồ. |
| Retry | Try again | Thử lại |
| Invalid bbox | Enter a valid bounding box (west < east; latitude between -90 and 90). | Nhập vùng hợp lệ (kinh độ tây < đông; vĩ độ từ -90 đến 90). |
| Invalid radius | Choose a radius between 0.1 and 50 km. | Chọn bán kính từ 0,1 đến 50 km. |
| Panel keyboard hint | You can set the area using the fields below without drawing on the map. | Bạn có thể đặt vùng bằng các trường bên dưới mà không cần vẽ trên bản đồ. |

**Destructive actions:** none required — Clear area filter is reversible (ghost button). Optional confirm only if UX testing shows mis-click pain (default: no dialog).

### Public mini-map (Track B)

| Element | EN | VI |
|---------|----|----|
| Mini-map label | Pin the location (optional) | Ghim vị trí (tùy chọn) |
| Mini-map helper | Tap the map to place a pin. You can still submit without it. | Chạm bản đồ để ghim. Bạn vẫn có thể gửi mà không cần bản đồ. |
| Map loading | Loading map… | Đang tải bản đồ… |
| Map degraded | Map unavailable — enter coordinates or use your location. | Không tải được bản đồ — nhập tọa độ hoặc dùng vị trí của bạn. |
| Primary CTA (unchanged) | Submit report | Gửi báo cáo |

---

## Accessibility

| Requirement | Contract |
|-------------|----------|
| Standard | WCAG 2.2 AA |
| Focus | Clinic Blue focus ring on all non-map controls; map canvas has `aria-label` “Incident map” / “Optional location map” |
| Touch | ≥44px on toggles, Apply, Clear, View report, Use my location |
| Clusters | Each cluster exposes **text** count (not color-only); `aria-label` “{n} reports in cluster” |
| Markers | `aria-label` “{category}, {status}, {priority}” on focused marker list alternative — provide **keyboard list panel** toggle “List incidents in view” mirroring popup fields (category, status, priority) for SR users |
| Popup | Focus trap while open; Escape closes; return focus to marker |
| Draw fallback | Panel inputs for bbox/radius always available (MAP-03 keyboard alternative) |
| Color | Status/priority never color-only — text in popup and list panel |
| Live regions | Map errors use `role="alert"` |
| Reduced motion | No flyTo; instant jump; no pin bounce |
| Locale | EN/VI for all new strings; dashboard uses existing `NextIntlClientProvider` |
| Public form | Mini-map degradation must not trap focus in broken iframe/canvas |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `toggle-group`, `slider` (if missing); reuse existing primitives | not required |
| npm direct | `maplibre-gl`, `react-map-gl` | not a shadcn registry — pin versions in package-lock; SUS checkpoint at plan time |
| Third-party shadcn | none | n/a |

---

## Anti-patterns (this phase)

| Anti-pattern | Why banned |
|--------------|------------|
| Blocking report submit when map fails | Track B resilience requirement |
| Showing description, tokens, or citizen PII in map popups | Privacy / MAP officer contract |
| Client-only supercluster ignoring server filters | Filter parity with table + export |
| Separate `/dashboard/map` route losing filter URL state | Phase 3 URL sync pattern |
| SSR MapLibre in RSC | Runtime error; use dynamic client import |
| Dark basemap / neon GIS / heatmap rainbow | Brand + civic light-only |
| Simultaneous split table + map on mobile | Cognitive load; toggle only |
| Map-only geo filter (no panel fallback) | Accessibility requirement |
| Color-only cluster or marker encoding | WCAG |
| Third-party shadcn map blocks | Registry safety |
| Requiring MapTiler API key for MVP | Use demotiles / env style URL |
| Real-time WebSocket live map | Out of scope |
| Showing other citizens’ reports on public mini-map | Privacy |

---

## Inheritance & non-goals

**Inherits from Phase 3:** Clinic Blue product register, URL `searchParams`, `ReportsFilters`/`ReportsMetrics`/`ExportButton`, empty/error spirit (DASH-07), sidebar shell, 44px targets, flat borders.

**Inherits from Phase 5:** Officer dashboard is locale-capable via layout provider; no map on Analytics tab (hotspot list remains non-map).

**Inherits from Phase 2:** Public Report optional location, bilingual EN/VI, Use my location, lat/lng manual entry, pill/rounded public form chrome for mini-map container only.

**Must not include:** Citizen status map, push notifications, routing directions, prediction overlays, officer-drawn freehand polygons (rectangle + radius only at MVP), multi-select bulk map actions.

---

## Out of Scope

| Item | Reason |
|------|--------|
| Turn-by-turn routing | Not in requirements |
| Geocoding autocomplete address search | Deferred; coords + pin-drop sufficient |
| Freehand polygon geo filter | Bbox + radius only for MAP-03 MVP |
| Heatmap layer | Phase 5 analytics covers aggregates without map |
| Editing report location from dashboard map | Read-only officer map |
| Public incident map | Officer-only dashboard |
| Offline / PWA map tiles | MVP web-only |
| 3D terrain / building extrusion | Civic 2D map sufficient |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS (FLAG: add zoom control aria-labels at implementation)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS (revised — removed 12px exception)
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-07-21

**Researcher notes:** Pre-populated from REQUIREMENTS MAP-01..03, ROADMAP Phase 6, Phase 2/3/5 UI-SPECs, live `ReportForm` + dashboard URL patterns. No CONTEXT.md / RESEARCH.md for Phase 6 — defaults chosen for Vietnam-centric civic map (centroid 21.0285, 105.8542), react-map-gl/maplibre stack, server-side clustering, panel keyboard fallback for geo draw. globals.css still shows teal tokens in repo; implementation should align to Clinic Blue per inherited Phase 3/5 contract.
