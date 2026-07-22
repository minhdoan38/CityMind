---
phase: 07-google-free-self-hosted-platform
plan: "08"
subsystem: migration
tags: [evidence-path, additive-schema, reconciliation, inventory]

requires:
  - phase: 07-06
  - phase: 07-07
provides:
  - Additive evidence_path column + RPC dual-write
  - Evidence dual-read in officer image serving and new report ingestion
  - Migration inventory, gate, reconcile scripts and manifests
affects: [07-09, 07-12]

key-files:
  created:
    - supabase/migrations/20260721130004_evidence_path_additive.sql
    - supabase/tests/07_evidence_additive.sql
    - frontend/scripts/lib/reconciliation.mjs
    - frontend/scripts/capture-migration-inventory.mjs
    - frontend/scripts/reconcile-migration.mjs
    - frontend/scripts/inventory-google-sources.ps1
    - frontend/scripts/migrate-google-data.ps1
    - frontend/migration-manifests/source-access-and-backup-gate.json
    - frontend/migration-manifests/reconciliation.json
    - frontend/tests/migration/reconciliation.test.ts
    - frontend/tests/migration/evidence-reconciliation.test.ts
  modified:
    - frontend/src/server/services/evidence-service.ts
    - frontend/src/server/services/report-service.ts
    - frontend/src/server/services/officer-read.ts
    - frontend/src/server/repositories/reports.ts

requirements-addressed: [SELFHOST-03, SELFHOST-04]

duration: 55min
completed: 2026-07-22
---

# Phase 7 Plan 08 Summary

**Additive `evidence_path` migration and reconciliation tooling are in place; legacy `image_gcs_uri` and GCS readers remain for rollback.**

## Accomplishments

- Added nullable `evidence_path` with `supabase://` backfill, format constraint, and extended `create_report_with_access_token` to dual-write `evidence_path` + `image_gcs_uri`.
- Implemented evidence dual-read (`evidence_path` preferred, `supabase://` fallback) for officer image serving and new report uploads.
- Shipped read-only inventory capture, signed gate manifest template, reconciliation library/CLI, and PowerShell orchestration scripts.
- Unit tests cover canonical hashing, row/object reconciliation, and evidence path resolution (16 migration tests passing).

## Operator gate (Task 1 — blocking live migration)

Task 2 live execution requires a signed `PASS` gate with backup hashes:

```powershell
# 1) DB backup hash
supabase db dump --db-url $env:SUPABASE_DB_URL -f backups/citymind-pre-migration.sql

# 2) Capture inventory + sign gate
.\frontend\scripts\inventory-google-sources.ps1 `
  -WriteGate `
  -DbBackupPath backups\citymind-pre-migration.sql `
  -StorageBackupPath backups\evidence-storage.tar `
  -Signer "YOUR_NAME"

# 3) Apply schema + reconcile
.\frontend\scripts\migrate-google-data.ps1
```

Or apply SQL manually:

```bash
node frontend/scripts/run-supabase-sql.mjs -f supabase/migrations/20260721130004_evidence_path_additive.sql
node frontend/scripts/run-supabase-sql.mjs -f supabase/tests/07_evidence_additive.sql
```

## Status

| Task | Status |
|------|--------|
| Task 1 — signed inventory/backup gate | **Complete** (signed PASS; 10 reports, 1 storage object, 0 `gs://`) |
| Task 2 — schema + reconcile code | **Complete** |
| Task 2 — live reconciliation | **Complete** (`reconciliation.json` status PASS) |

## Live inventory snapshot (2026-07-22)

- Reports: 10 | Status events: 4 | Storage objects: 1
- URI schemes: 9 null, 1 `supabase://`, 0 `gs://`
- `evidence_path` live on `demo-008-open-manhole`

## Deferred

- BigQuery/GCS inventory when read-only Google credentials are unavailable (research: live Supabase already holds operational data; 0 `gs://` rows).
- Legacy column drop remains gated to Plan 12.
