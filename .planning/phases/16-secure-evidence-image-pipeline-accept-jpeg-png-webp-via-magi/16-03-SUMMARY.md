---
phase: 16-secure-evidence-image-pipeline-accept-jpeg-png-webp-via-magi
plan: "03"
subsystem: api
tags: [report-service, citizen-intake, report-form]
requires:
  - phase: 16-02
    provides: processAndStoreEvidence
provides:
  - Pipeline-wired report-service and citizen-chat-intake
  - Generic 503/415 HTTP error mapping (DATA-10)
  - ReportForm 10MB client limit alignment
affects: [16-05]
tech-stack:
  added: []
  patterns: [mapEvidenceServiceError, webpBytes to analyze provider]
key-files:
  modified:
    - src/server/services/report-service.ts
    - src/server/services/report-service.test.ts
    - src/server/services/citizen-chat-intake.ts
    - src/server/http/errors.ts
    - src/components/ReportForm.tsx
    - tests/report-form.test.mjs
key-decisions:
  - "analyzeReport passes sanitized webpBytes to provider vision input"
  - "scanner_unavailable maps to evidenceScanningUnavailable() 503"
requirements-completed: [SEC-IMG-01, SEC-IMG-02, SEC-IMG-05, SEC-IMG-08, DATA-10]
duration: 20min
completed: 2026-07-23
---

# Phase 16 Plan 03: Upload Wiring Summary

**All citizen evidence uploads now route through `processAndStoreEvidence` with generic citizen-facing errors.**

## Accomplishments
- Replaced `uploadEvidence` in `report-service` and `citizen-chat-intake`
- Added `evidenceScanningUnavailable()` HTTP helper
- `ReportForm` imports `DEFAULT_MAX_EVIDENCE_BYTES` from shared limits module

## Deviations from Plan
None — plan executed as written.

## Self-Check: PASSED
