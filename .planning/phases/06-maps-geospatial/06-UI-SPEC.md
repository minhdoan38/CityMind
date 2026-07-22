---
phase: 6
slug: maps-geospatial
status: approved
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables; primary Clinic Blue #2563EB (inherits Phase 3/5 contract; align globals.css at implementation)
created: 2026-07-21
revised: 2026-07-21
inherits:
  - .planning/phases/03-dashboard-polish/03-UI-SPEC.md
  - .planning/phases/05-analytics-pipeline/05-UI-SPEC.md
  - .planning/phases/02-public-experience/02-UI-SPEC.md
sources:
  - .planning/phases/06-maps-geospatial/06-CONTEXT.md (D-01–D-22 locked)
  - REQUIREMENTS.md (MAP-01, MAP-02, MAP-03)
  - ROADMAP.md Phase 6 Tracks A∥B∥C
  - PROJECT.md (MapLibre GL + PostGIS; maps deferred to Phase 6)
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
> **Track A (06-01):** PostGIS + geo API (bbox viewport query) — backend-first; UI contract covers API-driven states consumed by Track C only.
> **Track B (06-02):** Optional pin-drop **mini map** on bilingual citizen Report form (public register).
> **Track C (06-03):** MapLibre GL **full dashboard map** with client-side clustering, table/map toggle, marker→detail navigation, bbox geo filter synced to URL.
>
> Out of scope: real-time WebSocket map updates; citizen `/status` map; analytics chart maps (Phase 5); routing/navigation directions; heatmap ML; dark map theme; 3D buildings; offline tiles; radius-circle geo filter; email/SMS geo alerts; Supabase in Docker (compose is backend+frontend only per D-21).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `frontend/components.json`) |
| Preset | `style: radix-nova`, `baseColor: neutral`, CSS variables; `--primary` = Clinic Blue `#2563EB` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react (`Map`, `MapPin`, `Layers`, `Crosshair`, `Square`, `Table2`, `LocateFixed`, `AlertTriangle`) |
| Font | Source Sans 3 only (400 / 600) |
| Register | **product** for `/dashboard` map surfaces; **brand/public civic** for Report form mini-map |

**Stack locks (Phase 6 — new dependencies):**

| Concern | Contract |
|---------|----------|
| Map engine | **MapLibre GL JS** (`maplibre-gl@^5.x`) — direct npm dependency |
| React bindings | **`react-map-gl/maplibre`** (`react-map-gl@^8.x`) — import `Map`, `Marker`, `Source`, `Layer` from `react-map-gl/maplibre`; import `maplibre-gl/dist/maplibre-gl.css` once in map client bundles |
| Clustering | **MapLibre GL client-side clustering** on viewport-fetched pin GeoJSON (`cluster: true` on `Source`; numeric count labels on cluster layers). Server returns individual pins in viewport + filters; client clusters for display (D-05/D-07). |
| Tile style | **Local dev:** OSM-compatible raster tiles via env `NEXT_PUBLIC_MAP_TILE_URL` + `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` (no API key required). **Production:** same env vars, configurable to MapTiler or equivalent (D-14). Do not hardcode keys. |
| Draw / geo filter | **BBox rectangle only** on map + filter-panel numeric fallback (keyboard-accessible). No radius-circle tool (D-08/D-10). Prefer lightweight custom draw handlers over `@maplibre/maplibre-gl-draw` unless RESEARCH confirms otherwise. |
| URL sync | Extend Phase 3 `searchParams` on `/dashboard` — do **not** add `nuqs` |
| Dynamic import | Map bundles **client-only** via `next/dynamic` with `ssr: false` and skeleton placeholder — MapLibre requires `window` |
| Auth | Officer JWT for dashboard map/geo endpoints; public mini-map uses no officer auth (pin coords only, submitted with analyze) |

**Reuse existing:** `button`, `badge`, `input`, `label`, `alert`, `skeleton`, `separator`, `tooltip`, `sidebar`, `collapsible`, `select`, `toggle-group` or `button` variant group (table/map), `card` (filter panel chrome only — flat border, no shadow).

**Phase 6 add (shadcn official only, if missing):** `toggle-group`. MapLibre/react-map-gl are **direct npm deps**, not shadcn blocks.

**Registry:** shadcn official only — `registries: {}`. No third-party shadcn registries. No third-party map UI blocks.

---

## Spacing Scale

Declared values (multiples of 4) — inherits Phase 3 product scale for dashboard; Phase 2 for public mini-map:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Map control icon gaps |
| sm | 8px | Toggle group gaps; mini-map toolbar |
| md | 16px | Default; filter panel field stack; map toolbar → canvas gap |
| lg | 24px | Map sidebar/panel padding; Report form section gap above mini-map |
| xl | 32px | Dashboard page header → view toggle gap |
| 2xl | 48px | — |
| 3xl | 64px | Public Report page vertical rhythm only (Track B) |

Exceptions:
- **44px** min touch height for view toggle, Apply geo filter, Clear geo filter, Use my location, Retry
- **Map canvas min-height:** **480px** desktop (dashboard full map view); **320px** mobile dashboard; **200px** mobile / **240px** desktop for public mini-map — layout constraints, not spacing tokens
- Map floating controls (zoom +/-): **40×40** visual with **44×44** hit area via padding; `aria-label` “Zoom in” / “Zoom out” required
- Dashboard map view: `main` may use `max-w-none` and reduced horizontal pad so map uses available width (override Phase 3 `max-w-6xl` on map view only)

---

## Typography

### Dashboard map (Track C) — product register

Exactly 4 sizes, 2 weights — same as Phase 3:

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px (0.875rem) | 400 | 1.4 | Cluster count, filter labels, control captions, unlocated count |
| Body | 16px (1rem) | 400 | 1.5 | Empty/error copy, panel helpers |
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
- Cluster labels: Label 14px **semibold via weight 600 only on count numeral** — cluster count must be readable at zoom; never shrink below 14px.
- Map attribution text: browser default / MapLibre attribution — do not restyle below legibility.

---

## Color

60 / 30 / 10 restrained civic (light-only) — Clinic Blue contract (Phase 3/5):

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Map canvas letterbox, filter panel |
| Secondary (30%) | `#F1F5F9` | Map toolbar well, mini-map border container, panel bg |
| Accent (10%) | `#2563EB` | Reserved list below |
| Accent deep | `#1D4ED8` | Hover / pressed; active view toggle; selected pin |
| Soft accent | `#EFF6FF` | Bbox preview fill (≤40% opacity); cluster circle fill |
| Destructive | `#DC2626` | Map load error Alert |
| Ink | `#1A2B3C` | Body text, cluster count numerals |
| Muted text | `#64748B` | Helpers, attribution, inactive toggle, unlocated count |
| Quiet line | `#E2E8F0` | Map container border, bbox stroke, panel dividers |

**Map-specific semantics (priority — primary visual channel on markers, D-06):**

| Priority | Marker fill / ring | Tooltip (hover only, optional) |
|----------|-------------------|--------------------------------|
| critical | Destructive ring (stroke) + ink text label | “Critical” + category |
| high | Clinic Blue ring (stroke) + ink text label | “High” + category |
| medium | Muted gray ring `#94A3B8` + ink text label | “Medium” + category |
| low | Quiet line ring + ink text label | “Low” + category |

Status appears in keyboard list panel as **text** only — never color-only. Priority drives pin color; status is secondary metadata.

Accent reserved for (only):
1. Active **Map** view toggle; primary **Apply area filter**
2. Selected pin on public mini-map
3. Focus-visible rings on map toolbar controls
4. Cluster count numeral (Clinic Blue text on soft-accent circle)
5. Active bbox draw mode indicator

**Not accent:** basemap tiles, default zoom buttons (neutral outline), inactive table toggle, metric numbers, full-screen map flood.

**Forbidden:** dark basemap theme, purple/neon GIS chrome, 3D gradient extrusions, heatmap rainbow scales, cream/teal brand regression on dashboard map.

---

## Visual hierarchy & focal points

| Surface | First focal | Second | Must not compete |
|---------|-------------|--------|------------------|
| Dashboard (table view) | Existing data table | Filters + metrics (Phase 3) | Map preview thumbnail |
| Dashboard (map view) | Full-width incident map | Floating geo filter bar + view toggle | Duplicate table rows under map |
| Marker click | Navigate to report detail | — | Popup as primary gate (D-03) |
| Geo filter panel | Bbox draw + Apply | Sync indicator with URL | Permanent modal over entire map |
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
| `ReportsMapView` | C | MapLibre via react-map-gl; client cluster Source/Layer; Marker; viewport pin fetch |
| `GeoFilterBar` | C | Bbox draw toggle + panel fallback; Apply / Clear |
| `GeoFilterPanel` | C | Numeric bbox (west,south,east,north); Apply / Clear |
| `MapCanvasSkeleton` | B,C | Rect skeleton matching map height; no fake tiles |
| `MapErrorState` | B,C | Alert + retry; Track B never blocks submit |
| `IncidentsListPanel` | C | Optional SR keyboard list: category, status, priority; navigate to detail |
| Extend `DashboardSearchParams` | C | Add `view`, `bbox` keys (see Interaction) |
| Extend `buildReportsQuery` | C | Pass geo + attribute params to list + summary + geo pins endpoints |

---

## Screen contracts

### Track A — API-driven states (minimal UI)

No dedicated route. Track C consumes:

| API concern | UI state |
|-------------|----------|
| Pin fetch loading | `MapCanvasSkeleton` over map area |
| Pin fetch empty (no points in viewport + filters) | Calm empty overlay on map (see Copywriting) |
| Pin fetch error | `Alert variant="destructive"` above map + Retry |
| Invalid bbox (422) | Inline panel validation — do not fetch |
| Reports without coordinates | Excluded server-side; show dynamic count caption when `{count} > 0` (D-16) |

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
| Failure | If map tiles/network fails: hide canvas, show Body helper “Map unavailable — enter coordinates or use your location.” Submit **unaffected** |
| Privacy | No officer data, no other reports, no clustering on public map |
| Motion | Pin drop: 150ms ease; honor `prefers-reduced-motion` |
| Tiles | Same `NEXT_PUBLIC_MAP_TILE_URL` + attribution env vars (OSM raster for dev) |

### Track C — Dashboard incident map (`ReportsMapView`)

| Property | Contract |
|----------|----------|
| Route | `/dashboard?view=map` (same page as table — toggle, not separate route) |
| Data | `officerFetch` geo pins endpoint with viewport `bbox` + all attribute filters from URL; client clusters pins in MapLibre |
| Cluster click | Zoom in (+2 levels) or expand per MapLibre cluster behavior |
| Marker click | **Navigate directly** to `/dashboard/reports/[reportId]` (D-03) — no popup gate |
| Hover (optional) | Lightweight tooltip: category + priority text only — no description, tokens, or PII |
| Pan/zoom | Debounce viewport fetch 300ms; show subtle loading indicator on toolbar (not full skeleton replace) |
| Table toggle | Returning to `view=table` preserves all URL filters including geo |
| Export | Export respects active geo + attribute filters when implemented in API (06-01) |
| Initial viewport | Fit bounds to pin results when geo filter active; else default city center zoom 11 |
| Unlocated count | When filtered dataset has reports missing coords, show `{count} reports lack location` below map (D-16) |

---

## Interaction contract

### URL parameters (extends Phase 3)

Add to `DashboardSearchParams`:

| Key | Values | Default | Notes |
|-----|--------|---------|-------|
| `view` | `table` \| `map` | `table` | View toggle |
| `bbox` | `west,south,east,north` | — | WGS84 degrees; absent = no geo filter |

**Rules:**
- Applying attribute filters clears `cursor` (existing Phase 3 behavior).
- Applying geo filter clears `cursor`.
- `Clear area filter` removes `bbox` only — attribute filters remain.
- `Clear filters` (existing) clears attribute **and** `bbox`.
- Invalid `bbox` (west≥east, out of range lat/lng): inline error, no fetch.

### Geo filter flow (MAP-03 — bbox only)

1. Officer selects “Area filter” in GeoFilterBar (or draws directly when map active).
2. Draw rectangle on map **or** enter west/south/east/north in panel.
3. Apply → URL `bbox` updated → pin fetch + metrics + export query updated.
4. Rectangle preview: accent stroke 2px, soft-accent fill 25% opacity.

**Keyboard / SR fallback (required):**
- Panel bbox inputs always available (no map-only path).
- GeoFilterBar draw toggle: `aria-pressed` when active.
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

- View toggle, pin drop: 150–250ms `ease-out-expo`.
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
| Empty (no geo results) | “No reports in this area” + Clear area filter CTA |
| Error (tiles) | Alert above map; table toggle still works |
| Error (API) | Alert destructive + Retry |
| Partial (reports lack coords) | Map shows geocoded points; Label below map: “{count} reports lack location” (D-16) |

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
| View toggle: table | Table view | Dạng bảng |
| View toggle: map | Map view | Dạng bản đồ |
| Page subtitle (map active) | Incidents with location appear on the map. AI stays advisory — you decide. | Sự cố có vị trí hiển thị trên bản đồ. AI chỉ hỗ trợ — bạn quyết định. |
| Primary CTA | Apply area filter | Áp dụng vùng lọc |
| Geo filter: inactive | No area filter | Không lọc vùng |
| Geo filter: active | Area filter on | Đang lọc vùng |
| Draw bbox hint | Drag on the map to draw a rectangle, or enter coordinates below. | Kéo trên bản đồ để vẽ hình chữ nhật, hoặc nhập tọa độ bên dưới. |
| Clear geo filter | Clear area filter | Xóa lọc vùng |
| Cluster label (a11y) | {count} reports in cluster | {count} báo cáo trong cụm |
| Updating map | Updating map… | Đang cập nhật bản đồ… |
| Empty heading | No located reports | Không có báo cáo có vị trí |
| Empty body | Try clearing filters, widening the area, or switch to the table view. | Thử xóa bộ lọc, mở rộng vùng, hoặc chuyển sang dạng bảng. |
| Empty area heading | No reports in this area | Không có báo cáo trong vùng này |
| Empty area body | Adjust the rectangle or clear the area filter. | Điều chỉnh hình chữ nhật hoặc xóa lọc vùng. |
| Unlocated count | {count} reports lack location | {count} báo cáo không có vị trí |
| Error load | Could not load the incident map. Check your connection and try again. | Không thể tải bản đồ sự cố. Kiểm tra kết nối và thử lại. |
| Error tiles | Map tiles could not load. | Không thể tải lớp bản đồ. |
| Retry | Try again | Thử lại |
| Invalid bbox | Enter a valid bounding box (west < east; latitude between -90 and 90). | Nhập vùng hợp lệ (kinh độ tây < đông; vĩ độ từ -90 đến 90). |
| Panel keyboard hint | You can set the area using the fields below without drawing on the map. | Bạn có thể đặt vùng bằng các trường bên dưới mà không cần vẽ trên bản đồ. |
| List panel toggle | List incidents in view | Liệt kê sự cố trong vùng |

**Destructive actions:** none required — Clear area filter is reversible (ghost button).

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
| Touch | ≥44px on toggles, Apply, Clear, Use my location |
| Zoom controls | `aria-label` “Zoom in” / “Zoom out” on MapLibre zoom buttons |
| Clusters | Each cluster exposes **text** count (not color-only); `aria-label` “{n} reports in cluster” |
| Markers | Keyboard list panel “List incidents in view” with category, status, priority text; Enter navigates to detail |
| Draw fallback | Panel bbox inputs always available (MAP-03 keyboard alternative) |
| Color | Priority/status never color-only — text in list panel and optional hover tooltip |
| Live regions | Map errors use `role="alert"` |
| Reduced motion | No flyTo; instant jump; no pin bounce |
| Locale | EN/VI for all new strings; dashboard uses existing `NextIntlClientProvider` |
| Public form | Mini-map degradation must not trap focus in broken iframe/canvas |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `toggle-group` (if missing); reuse existing primitives | not required |
| npm direct | `maplibre-gl`, `react-map-gl` | not a shadcn registry — pin versions in package-lock; SUS checkpoint at plan time |
| Third-party shadcn | none | n/a |

---

## Anti-patterns (this phase)

| Anti-pattern | Why banned |
|--------------|------------|
| Blocking report submit when map fails | Track B resilience requirement |
| Showing description, tokens, or citizen PII on map hover/list | Privacy / MAP officer contract |
| Server-side-only clustering bypassing MapLibre client cluster layer | D-05/D-07 locks client clustering |
| Popup as primary marker-click gate | D-03 locks direct navigation |
| Radius-circle geo filter UI | D-08/D-10 deferred; bbox only |
| Separate `/dashboard/map` route losing filter URL state | Phase 3 URL sync pattern |
| SSR MapLibre in RSC | Runtime error; use dynamic client import |
| Dark basemap / neon GIS / heatmap rainbow | Brand + civic light-only |
| Simultaneous split table + map on mobile | Cognitive load; toggle only |
| Map-only geo filter (no panel fallback) | Accessibility requirement |
| Color-only cluster or marker encoding | WCAG |
| Third-party shadcn map blocks | Registry safety |
| Requiring paid tile API key for local dev | OSM raster + env vars (D-14) |
| Real-time WebSocket live map | Out of scope |
| Showing other citizens’ reports on public mini-map | Privacy |
| Supabase in docker-compose | D-21 — localhost CLI only |

---

## Inheritance & non-goals

**Inherits from Phase 3:** Clinic Blue product register, URL `searchParams`, `ReportsFilters`/`ReportsMetrics`/`ExportButton`, empty/error spirit (DASH-07), sidebar shell, 44px targets, flat borders.

**Inherits from Phase 5:** Officer dashboard is locale-capable via layout provider; no map on Analytics tab (hotspot list remains non-map).

**Inherits from Phase 2:** Public Report optional location, bilingual EN/VI, Use my location, lat/lng manual entry, pill/rounded public form chrome for mini-map container only.

**Must not include:** Citizen status map, push notifications, routing directions, prediction overlays, radius geo filter, freehand polygon draw, multi-select bulk map actions, Supabase in Docker.

---

## Out of Scope

| Item | Reason |
|------|--------|
| Turn-by-turn routing | Not in requirements |
| Geocoding autocomplete address search | Deferred; coords + pin-drop sufficient |
| Radius-circle geo filter | Deferred per CONTEXT D-08/D-10 |
| Freehand polygon geo filter | Bbox only for MAP-03 MVP |
| Heatmap layer | Phase 5 analytics covers aggregates without map |
| Editing report location from dashboard map | Read-only officer map |
| Public incident map | Officer-only dashboard |
| Offline / PWA map tiles | MVP web-only |
| 3D terrain / building extrusion | Civic 2D map sufficient |
| Supabase in docker-compose | D-21 — backend+frontend compose only |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-07-21

**Researcher notes:** Revised 2026-07-21 to align with `06-CONTEXT.md` (D-01–D-22): client-side MapLibre clustering, bbox-only geo filter, direct marker→detail navigation, priority-first pin styling, OSM raster dev tiles via `NEXT_PUBLIC_MAP_TILE_URL`, dynamic unlocated count copy, docker-compose backend+frontend only (no Supabase). Inherits Phase 2/3/5 UI-SPECs. globals.css still shows teal tokens in repo; implementation should align to Clinic Blue per inherited contract.
