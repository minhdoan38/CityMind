---
status: partial
phase: 05-analytics-pipeline
source: [05-VERIFICATION.md]
started: 2026-07-21T05:20:00Z
updated: 2026-07-21T05:20:00Z
---

## Current Test

number: 1
name: Live ETL run
expected: |
  Deploy ETL per scripts/deploy_etl_job.md (or run locally with ENABLE_BIGQUERY=true), seed Supabase reports,
  execute `python -m app.jobs.etl_supabase_to_bigquery`, confirm BigQuery reports_analytics / status_events_analytics rows appear.
  ETL completes exit 0; analytics tables contain projected rows; watermarks advance in etl_watermarks.
awaiting: user response

## Tests

### 1. Live ETL run
expected: ETL completes exit 0; analytics tables contain projected rows; watermarks advance in etl_watermarks.
result: [pending]

### 2. Officer Analytics tab
expected: Charts render with warehouse data or calm empty-state copy; URL range|from|to persists; invalid custom range shows error and blocks fetch.
result: [pending]

### 3. Public Home strip (EN/VI)
expected: Strip shows totals/top categories when API succeeds; degrades closed (hidden) when backend down or 502; no PII leakage; categories under count 3 omitted.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
