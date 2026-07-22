---
phase: 06-maps-geospatial
plan: "03"
subsystem: ui
tags: [maplibre, dashboard-map, clustering, bbox-filter, bff, i18n]

requires:
  - phase: 06-maps-geospatial
    plan: "01"
    provides: GET /api/v1/reports/geo/pins
provides:
  - Dashboard table/map URL toggle (view=table|map)
  - ReportsMapView with client-side MapLibre clustering
  - Bbox geo filter (draw + panel fallback) synced to URL
  - Officer BFF /api/officer/reports/geo/pins
  - IncidentsListPanel keyboard/SR path
  - EN/VI dashboard.map copy
affects: []

tech-stack:
  added: []
  patterns:
    - ReportsMapViewLoader client wrapper for next/dynamic ssr:false
    - buildGeoPinsQuery + parseBbox in reports/types.ts
    - Shared buildRasterMapStyle in lib/mapTiles.ts

key-files:
  created:
    - frontend/src/components/reports/ReportsMapView.tsx
    - frontend/src/components/reports/ReportsMapViewLoader.tsx
    - frontend/src/components/reports/ReportsViewToggle.tsx
    - frontend/src/components/reports/GeoFilterBar.tsx
    - frontend/src/components/reports/GeoFilterPanel.tsx
    - frontend/src/components/reports/IncidentsListPanel.tsx
    - frontend/src/components/reports/MapCanvasSkeleton.tsx
    - frontend/src/lib/mapTiles.ts
    - frontend/src/app/api/officer/reports/geo/pins/route.ts
    - frontend/tests/dashboard-map.test.mjs
    - frontend/tests/dashboard-geo-params.test.mjs
    - frontend/src/components/ReportStarterBar.tsx
  modified:
    - frontend/src/components/ReportLocationMiniMapInner.tsx
    - frontend/src/app/dashboard/page.tsx
    - frontend/src/components/reports/types.ts
    - frontend/src/components/reports/ReportsFilters.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json

requirements-completed: [MAP-02, MAP-03]

duration: 45min
completed: 2026-07-21
---

# Phase 6 Plan 03: Dashboard Incident Map Summary

**Officer dashboard map view with MapLibre clustering, bbox geo filter, URL sync, and bilingual copy.**

## Verification

- Lint: map components + dashboard page — 0 warnings
- `node --test` — 10/10 map smoke tests pass
- `next build` — **green** (ReportStarterBar restored; MapLibre `attributionControl` TS fix)

## Accomplishments

- Table/Map toggle on `/dashboard` via `view` URL param (table default)
- Clustered incident map with priority-colored pins; marker click → report detail
- Bbox draw + numeric panel fallback; `bbox` URL param; Clear area filter
- BFF geo pins route with officer JWT
- Unlocated count message; IncidentsListPanel for SR navigation
- Export respects bbox via extended `buildReportsQuery`

---
*Phase: 06-maps-geospatial*
*Plan: 03 — complete*
