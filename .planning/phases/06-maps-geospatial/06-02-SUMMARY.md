---
phase: 06-maps-geospatial
plan: "02"
subsystem: ui
tags: [maplibre, react-map-gl, citizen-form, i18n, next-dynamic]

requires:
  - phase: 06-maps-geospatial
    provides: UI-SPEC Track B + D-11..D-15 tile env vars
provides:
  - ReportLocationMiniMap dynamic wrapper (ssr:false + degradation)
  - ReportLocationMiniMapInner MapLibre click-to-pin map
  - EN/VI public.map copy
  - report-minimap smoke tests
affects:
  - 06-03 dashboard map (shared MapLibre stack)

tech-stack:
  added: [maplibre-gl, react-map-gl]
  patterns:
    - next/dynamic ssr:false for MapLibre client bundle
    - OSM raster tiles via NEXT_PUBLIC_MAP_TILE_URL
    - Graceful degradation — submit unaffected on tile failure

key-files:
  created:
    - frontend/src/components/ReportLocationMiniMap.tsx
    - frontend/src/components/ReportLocationMiniMapInner.tsx
    - frontend/tests/report-minimap.test.mjs
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/components/ReportForm.tsx
    - frontend/messages/en.json
    - frontend/messages/vi.json

key-decisions:
  - useWatch for lat/lng sync (React Compiler / ESLint compatible)
  - jumpTo when prefers-reduced-motion; flyTo otherwise on input sync

requirements-completed: [MAP-02-partial]

duration: 20min
completed: 2026-07-21
---

# Phase 6 Plan 02: Citizen Mini-Map Summary

**Optional MapLibre pin-drop mini map on the bilingual report form with graceful degradation and EN/VI copy.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 4/4 complete
- **Files modified:** 8

## Accomplishments

- Installed `maplibre-gl@^5.24.0` and `react-map-gl@^8.1.1` (SUS approved via continue signal)
- `ReportLocationMiniMap` — dynamic import, error boundary, degraded helper text
- `ReportLocationMiniMapInner` — OSM raster style from env, click-to-pin, 6-decimal coords, debounced input sync
- Wired into `ReportForm` below lat/lng grid; manual entry and Use my location unchanged
- EN/VI `public.map` keys; 4 smoke tests green

## Verification

- `npm run lint` — map components + ReportForm (0 warnings)
- `node --test frontend/tests/report-minimap.test.mjs` — 4/4 pass

## Deviations from Plan

None — implementation matches 06-02-PLAN acceptance criteria.

## Next Phase Readiness

- Track C (06-03) can reuse MapLibre deps and tile env pattern for dashboard map

---
*Phase: 06-maps-geospatial*
*Plan: 02 — complete*
