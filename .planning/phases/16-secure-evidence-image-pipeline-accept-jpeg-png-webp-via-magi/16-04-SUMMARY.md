---
phase: 16-secure-evidence-image-pipeline-accept-jpeg-png-webp-via-magi
plan: "04"
subsystem: ops
tags: [clamav-health, readiness, migration]
requires:
  - phase: 16-02
    provides: evidence pipeline, clamav-client
provides:
  - GET /api/health/clamav
  - checkReadiness clamav dependency
  - migrate-evidence-to-webp.mjs batch script
affects: [16-05]
tech-stack:
  added: []
  patterns: [ai-readiness TTL cache mirror for ClamAV]
key-files:
  created:
    - src/server/health/clamav-readiness.ts
    - src/server/health/clamav-readiness.test.ts
    - src/app/api/health/clamav/route.ts
    - scripts/migrate-evidence-to-webp.mjs
  modified:
    - src/server/health/readiness.ts
    - src/server/health/readiness.test.ts
key-decisions:
  - "Dry-run enumerates legacy paths without Storage/DB mutations"
  - "Readiness not_ready when clamav enabled but down"
requirements-completed: [SEC-IMG-06, SEC-IMG-07]
duration: 20min
completed: 2026-07-23
---

# Phase 16 Plan 04: Ops Tooling Summary

**ClamAV health endpoint, readiness integration, and legacy evidence batch migration script shipped.**

## Accomplishments
- `checkClamavHealth` with 45s TTL cache and `/api/health/clamav` route
- `checkReadiness` appends clamav dependency when `CLAMAV_ENABLED` is true
- `migrate-evidence-to-webp.mjs` supports `--dry-run`, `--limit`, `--report-id`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Windows process.exit crash in migration script**
- **Found during:** Task 3 verification
- **Issue:** `process.exit()` after Supabase client caused libuv assertion on Windows
- **Fix:** Use natural exit with `process.exitCode` only on failure; lazy-import sharp
- **Files modified:** `scripts/migrate-evidence-to-webp.mjs`

## Self-Check: PASSED
