---
phase: 16-secure-evidence-image-pipeline-accept-jpeg-png-webp-via-magi
plan: "02"
subsystem: security
tags: [evidence-pipeline, sharp, webp]
requires:
  - phase: 16-01
    provides: clamav-client, evidence-limits
provides:
  - processAndStoreEvidence orchestrator
  - UUID WebP storage paths
  - GIF/SVG magic-byte rejection
affects: [16-03, 16-04]
tech-stack:
  added: []
  patterns: [in-memory scan → Sharp WebP → Storage upload]
key-files:
  created:
    - src/server/services/evidence-image-pipeline.ts
    - src/server/services/evidence-image-pipeline.test.ts
  modified:
    - src/server/services/evidence-service.ts
    - src/server/services/evidence-service.test.ts
key-decisions:
  - "In-memory pipeline only (no OS quarantine temp files for ≤10MB)"
  - "buildEvidenceObjectPath uses randomUUID().webp keys"
requirements-completed: [SEC-IMG-01, SEC-IMG-02, SEC-IMG-03, SEC-IMG-04, SEC-IMG-05]
duration: 30min
completed: 2026-07-23
---

# Phase 16 Plan 02: Image Pipeline Summary

**Shipped `processAndStoreEvidence` — validate → ClamAV scan → Sharp WebP q88 → private Storage upload with UUID keys.**

## Accomplishments
- Extended `validateEvidenceBytes` to reject GIF/SVG explicitly
- Added pipeline error codes: `infected`, `scanner_unavailable`, `transform_failed`
- Unit tests cover infected scan, scanner errors, pixel-bomb transform failures, WebP output

## Deviations from Plan
None — plan executed as written.

## Self-Check: PASSED
