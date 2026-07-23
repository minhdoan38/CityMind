---
phase: 16-secure-evidence-image-pipeline-accept-jpeg-png-webp-via-magi
plan: "05"
subsystem: testing
tags: [phase16-gate, sql-contract, requirements]
requires:
  - phase: 16-03
    provides: wired upload paths
  - phase: 16-04
    provides: ops tooling
provides:
  - npm run phase16:gate
  - 16_phase16_contract.sql
  - SEC-IMG-01..08 in REQUIREMENTS.md
affects: []
tech-stack:
  added: []
  patterns: [phase gate chaining unit + legacy + migration dry-run + SQL]
key-files:
  created:
    - supabase/migrations/20260723160001_phase16_evidence_bucket_invariants.sql
    - supabase/tests/16_phase16_contract.sql
  modified:
    - package.json
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .env.example
key-decisions:
  - "SQL contract skipped in gate when SUPABASE_DB_URL absent in operator .env.local"
requirements-completed: [SEC-IMG-01, SEC-IMG-05, SEC-IMG-06, SEC-IMG-07, SEC-IMG-08]
duration: 15min
completed: 2026-07-23
---

# Phase 16 Plan 05: Gate + Traceability Summary

**Phase 16 gate script, SQL contract, bucket migration, and SEC-IMG requirement traceability complete.**

## Accomplishments
- Added `phase16:gate` npm script (unit + legacy + migration dry-run + SQL)
- Created idempotent bucket invariants migration and SQL contract test
- Documented SEC-IMG-01..08 in REQUIREMENTS.md and CLAMAV/EVIDENCE vars in `.env.example`

## Deferred Issues
- SQL contract gate requires `SUPABASE_DB_URL` in `.env.local` (not set in current operator env); migration SQL file is ready to apply via `node scripts/run-supabase-sql.mjs -f supabase/migrations/20260723160001_phase16_evidence_bucket_invariants.sql`

## Deviations from Plan
None beyond documented SQL env deferral.

## Self-Check: PASSED
