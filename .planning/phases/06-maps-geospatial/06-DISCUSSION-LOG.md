# Phase 6 Discussion Log

**Date:** 2026-07-21  
**Mode:** discuss  
**Participants:** User + GSD discuss-phase

## Areas Discussed

All six gray areas selected plus user freeform addition (Docker one-shot).

### 1. Map ↔ table toggle UX
| Question | Options | Selection |
|----------|---------|-----------|
| Default view on `/dashboard` | Table default / Map default / Remember last | **Table default** |
| Marker click behavior | Navigate to detail / Side panel / Popup only | **Navigate to `/dashboard/reports/[id]`** |

**Captured:** D-01..D-04

### 2. Clustering & pin density
Discussed with agent discretion defaults: MapLibre client clustering, count labels, priority-colored pins, expand on zoom.

**Captured:** D-05..D-07

### 3. Geo filter interaction
| Question | Options | Selection |
|----------|---------|-----------|
| Geo filter mode | Bbox + radius / Bbox only / Radius only | **BBox draw on map only** |

**Captured:** D-08..D-10

### 4. Citizen pin-drop mini map (Track B)
| Question | Options | Selection |
|----------|---------|-----------|
| Track B scope | Ship mini map (supplement) / Replace fields / Defer | **Ship mini map — supplements geolocation + manual fields** |

**Captured:** D-11..D-13

### 5. Basemap & tile provider
| Question | Options | Selection |
|----------|---------|-----------|
| Tiles | OSM dev + env prod / OSM only / MapTiler only | **OSM for local dev; env-configurable provider for prod** |

**Captured:** D-14..D-15

### 6. Reports without coordinates
| Question | Options | Selection |
|----------|---------|-----------|
| Missing lat/lng | Hide with count / Hide silent / City center approximate | **Hide from map; show "N reports lack location" count** |

**Captured:** D-16..D-17

### 7. Docker one-shot (user freeform)
| Question | Options | Selection |
|----------|---------|-----------|
| Docker scope | Full stack / App only / Docs only | **docker-compose: backend + frontend** (initial) |

**Revision (2026-07-21):** User clarified **no Supabase docker** — Supabase stays on localhost CLI; compose is app-only.

**Captured:** D-21..D-22

## Deferred During Discussion

- Radius-circle geo filter tool
- Map as default view
- Side-panel marker preview
- Public incident map

## Next Step

`/gsd-plan-phase 6` or `/gsd-ui-phase 6` (frontend-heavy phase)
