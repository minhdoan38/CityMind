---
phase: 07-google-free-self-hosted-platform
plan: "12"
subsystem: schema
tags: [legacy-evidence, image_gcs_uri, fail-closed-migration]

requires:
  - phase: 07-11
provides:
  - staged 20260721130005_remove_legacy_evidence.sql
  - migration-stage 07_remove_legacy_evidence.sql contract
  - durable 07_evidence_final.sql post-cutover contract
affects: [07-13, 07-15]

key-files:
  created:
    - supabase/migrations/20260721130005_remove_legacy_evidence.sql
    - supabase/tests/07_remove_legacy_evidence.sql
    - supabase/tests/07_evidence_final.sql
  modified: []

requirements-addressed: [SELFHOST-04, SELFHOST-06]

duration: 20min
completed: 2026-07-22
---

# Phase 7 Plan 12 Summary

**Fail-closed legacy `image_gcs_uri` removal SQL is staged; live push remains blocked on operator approval gates.**

## Accomplishments

- Migration `20260721130005_remove_legacy_evidence.sql` raises before drop when:
  - any row has `image_gcs_uri` without `evidence_path`
  - any row still has `gs://` URIs
- `create_report_with_access_token` RPC updated to accept only `p_evidence_path` (no `p_image_gcs_uri`).
- `07_remove_legacy_evidence.sql` validates column removal and evidence_path-only RPC behavior.
- `07_evidence_final.sql` validates durable post-cutover schema (no legacy column, format constraint, private bucket).

## Artifact hashes

| File | SHA-256 |
|------|---------|
| `supabase/migrations/20260721130005_remove_legacy_evidence.sql` | `e4faa91468833e38a5d58f9f7d4434c0d16640a5af9831f24685f091b88674cd` |
| `supabase/tests/07_remove_legacy_evidence.sql` | `596b639bccebe85a869a04d9293394d6b3b2e8e4491cb5a69d1c33d2cea1e146` |
| `supabase/tests/07_evidence_final.sql` | `4ee8b6ba4581abbc1fab4efbaa75728e4795adcb057c6f0fafbdcca19743c279` |

## Status

| Task | Status |
|------|--------|
| Task 1 — Stage destructive SQL | **Complete** |
| Task 2 — Push + live SQL contracts | **Pending operator** — migration `30005` includes dual `DROP FUNCTION`; re-run after fix |

## Operator checkpoint (Task 2)

After signing cleanup approval and restore gate PASS:

```powershell
supabase db push
node frontend/scripts/run-supabase-sql.mjs supabase/tests/07_remove_legacy_evidence.sql
node frontend/scripts/run-supabase-sql.mjs supabase/tests/07_evidence_final.sql
```

Do not remove Python/GCS readers in application code until both live SQL contracts pass.
