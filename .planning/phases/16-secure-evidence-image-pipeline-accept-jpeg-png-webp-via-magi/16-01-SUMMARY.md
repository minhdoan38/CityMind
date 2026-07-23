---
phase: 16-secure-evidence-image-pipeline-accept-jpeg-png-webp-via-magi
plan: "01"
subsystem: security
tags: [sharp, clamscan, evidence-limits, clamav]
requires:
  - phase: 15
    provides: citizen upload paths
provides:
  - sharp and clamscan dependencies
  - client-safe evidence-limits module (10MB)
  - fail-closed ClamAV TCP client with mocked tests
affects: [16-02, 16-03, 16-04]
tech-stack:
  added: [sharp@^0.35.3, clamscan@^2.4.0]
  patterns: [lazy ClamAV singleton, shared evidence byte limits]
key-files:
  created:
    - src/lib/evidence-limits.ts
    - src/server/services/clamav-client.ts
    - src/server/services/clamav-client.test.ts
  modified:
    - package.json
    - package-lock.json
    - src/server/services/evidence-service.ts
key-decisions:
  - "10MB default via evidence-limits.ts shared client/server"
  - "CLAMAV_ENABLED defaults enabled unless explicitly false"
  - "localFallback false on clamdscan config"
requirements-completed: [SEC-IMG-02, SEC-IMG-05, SEC-IMG-08]
duration: 25min
completed: 2026-07-23
---

# Phase 16 Plan 01: Deps + ClamAV Client Summary

**Installed sharp/clamscan, centralized 10MB evidence limits, and shipped a fail-closed ClamAV INSTREAM client with full unit coverage.**

## Accomplishments
- Added `evidence-limits.ts` with `DEFAULT_MAX_EVIDENCE_BYTES` (10MB) and env resolver
- Implemented `clamav-client.ts` with `assertCleanBuffer`, `pingClamav`, mocked tests (RED→GREEN)
- Refactored `evidence-service.ts` to import limits from shared module

## Deviations from Plan
None — plan executed as written.

## Self-Check: PASSED
