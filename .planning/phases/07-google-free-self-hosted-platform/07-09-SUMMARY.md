---
phase: 07-google-free-self-hosted-platform
plan: "09"
subsystem: migration
tags: [backup, restore, rollback, reconciliation]

requires:
  - phase: 07-08
provides:
  - backup-citymind / restore-citymind operator wrappers (DB + Storage separate)
  - compare-migration-manifests and verify-gate-artifacts CLIs
  - restore-and-rollback gate manifest template
affects: [07-10, 07-12]

key-files:
  created:
    - frontend/scripts/backup-citymind.mjs
    - frontend/scripts/backup-citymind.ps1
    - frontend/scripts/restore-citymind.mjs
    - frontend/scripts/restore-citymind.ps1
    - frontend/scripts/compare-migration-manifests.mjs
    - frontend/scripts/verify-gate-artifacts.mjs
    - frontend/migration-manifests/restore-and-rollback-gate.json

requirements-addressed: [SELFHOST-03, SELFHOST-04, SELFHOST-05]

duration: 40min
completed: 2026-07-22
---

# Phase 7 Plan 09 Summary

**Recovery wrappers and manifest comparison tooling are implemented; isolated restore proof remains an operator checkpoint.**

## Accomplishments

- `backup-citymind.mjs` dumps Postgres (via `supabase db dump`) and archives Storage objects separately with SHA-256 hashes in `backup-meta.json`.
- `restore-citymind.mjs` restores only into isolated targets (`CITYMIND_ISOLATED_*` env vars) and refuses current `SUPABASE_DB_URL`.
- `compare-migration-manifests.mjs` and `verify-gate-artifacts.mjs` provide deterministic manifest/gate verification.
- PowerShell wrappers delegate to the Node implementations with `$PSScriptRoot`-relative repo paths.

## Operator gate (Task 2 — blocking cleanup plans)

Isolated restore + preserved Python rollback smoke:

```powershell
# Requires isolated Supabase target env vars:
# CITYMIND_ISOLATED_DB_URL, CITYMIND_ISOLATED_SUPABASE_URL, CITYMIND_ISOLATED_SUPABASE_SECRET_KEY

.\frontend\scripts\backup-citymind.ps1 -Output frontend\migration-backups\pre-clean
.\frontend\scripts\restore-citymind.ps1 -Input frontend\migration-backups\pre-clean -Target isolated
node frontend/scripts/compare-migration-manifests.mjs `
  --source frontend/migration-manifests/reconciliation.json `
  --target frontend/migration-manifests/restore.json `
  --require-exact
```

Then sign `restore-and-rollback-gate.json` with `application_rollback_pass: true` after preserved-revision smoke.

## Status

| Task | Status |
|------|--------|
| Task 1 — recovery wrappers | **Complete** |
| Task 2 — isolated restore + rollback proof | **Pending operator** |
