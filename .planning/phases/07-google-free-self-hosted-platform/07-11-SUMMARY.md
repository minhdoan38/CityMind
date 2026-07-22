---
phase: 07-google-free-self-hosted-platform
plan: "11"
subsystem: audit
tags: [google-exit, cleanup-gate, allowlist, pre-clean-manifest]

requires:
  - phase: 07-10
provides:
  - google-exit-audit.mjs fail-closed scanner
  - audit:google-exit npm script
  - google-exit-pre-clean.json removal inventory baseline
affects: [07-12]

key-files:
  created:
    - frontend/scripts/google-exit-audit.mjs
    - frontend/scripts/lib/google-exit-audit.mjs
    - frontend/tests/google-exit-audit.test.ts
    - frontend/migration-manifests/google-exit-pre-clean.json
    - frontend/operations/local-cleanup-approval.json
  modified:
    - frontend/package.json
    - frontend/scripts/verify-gate-artifacts.mjs

requirements-addressed: [SELFHOST-06]

duration: 45min
completed: 2026-07-22
---

# Phase 7 Plan 11 Summary

**Executable Google-exit audit with exact Google Fonts allowlist and a deterministic pre-clean removal inventory.**

## Accomplishments

- `audit:google-exit` scans active frontend source, legacy backend/docker tracks, npm dependencies, and `.env.example` key names (never values).
- Google Fonts allowed only in `frontend/src/lib/fonts.ts` (`next/font/google`) and `frontend/src/app/globals.css` (`fonts.googleapis.com`).
- Safety evidence validator fails closed when restore/rollback gate is unsigned.
- Pre-clean manifest written: `frontend/migration-manifests/google-exit-pre-clean.json`
- Manifest hash: `d1e4fa92c470d2599480dea9d677cdb7b395e95d0f48a038b77d6b0c49a0f2ec`
- 8 unit tests passing.

## Pre-clean baseline (expected FAIL)

| Category | Count |
|----------|-------|
| Active findings | 4 (`frontend/src/lib/backend.ts` bridge lines) |
| Legacy track groups | 4 (backend/, docker, infra/bigquery, backend bridge module) |
| Env key findings | 1 (`BACKEND_API_URL` in `.env.example`) |
| Safety evidence | **Incomplete** (restore-and-rollback gate still PENDING) |

## Operator gate (Task 3)

Sign `frontend/operations/local-cleanup-approval.json` only after:
- Restore-and-rollback gate PASS
- Operator runtime decision PASS
- Explicit local cleanup approval

```bash
node frontend/scripts/verify-gate-artifacts.mjs \
  --file frontend/operations/local-cleanup-approval.json \
  --require-signed --require-inventory --require-reconciliation \
  --require-db-restore --require-storage-restore \
  --require-application-rollback --require-explicit-local-cleanup-approval
```

## Status

| Task | Status |
|------|--------|
| Task 1 — audit implementation + tests | **Complete** |
| Task 2 — pre-clean manifest | **Complete** |
| Task 3 — local cleanup approval | **Pending operator** |
