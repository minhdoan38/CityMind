---
phase: 07-google-free-self-hosted-platform
plan: "07"
subsystem: api
tags: [postgres-analytics, public-stats, k-anonymity, officer-analytics]

requires:
  - phase: 07-04
    provides: Canonical reports/status_events in Supabase Postgres
provides:
  - Postgres analytics views/RPCs (get_officer_analytics, get_public_stats)
  - Officer GET /api/v1/analytics and public GET /api/v1/public/stats
  - Dashboard analytics page + PublicStatsStrip direct Postgres loaders
affects: [07-08, 07-15]

key-files:
  created:
    - supabase/migrations/20260721130002_postgres_analytics.sql
    - supabase/tests/07_postgres_analytics.sql
    - frontend/src/server/repositories/analytics.ts
    - frontend/src/server/repositories/analytics.test.ts
    - frontend/src/server/services/officer-analytics.ts
    - frontend/src/server/services/officer-analytics.test.ts
    - frontend/src/app/api/v1/analytics/route.ts
    - frontend/src/app/api/v1/public/stats/route.ts
  modified:
    - frontend/src/app/api/public/stats/route.ts
    - frontend/src/app/dashboard/analytics/page.tsx
    - frontend/src/components/analytics/PublicStatsStrip.tsx
    - frontend/tests/analytics-shell.test.mjs
    - frontend/tests/public-stats.test.mjs

requirements-completed: [SELFHOST-03]

duration: 50min
completed: 2026-07-21
---

# Phase 7 Plan 07 Summary

**Officer analytics and privacy-thresholded public stats now read from self-hosted Supabase Postgres — no runtime BigQuery or FastAPI proxy on these paths.**

## Accomplishments

- Added `get_officer_analytics` (SECURITY INVOKER, officer-gated) and `get_public_stats` (SECURITY DEFINER, k≥3 disclosure) RPCs with supporting views/indexes.
- Implemented typed `analytics` repository with SLA histogram parity, 366-day range validation, and public category filtering helpers.
- Cut over officer analytics API, public stats API/BFF, dashboard analytics page, and `PublicStatsStrip` to local Postgres modules.
- Preserved isolated `stats:{ip}` rate limiting on public stats.

## Verification

- `npm run test:unit` — analytics repository + officer-analytics handler tests pass (17 cases in targeted run).
- `npm run test:legacy` — analytics-shell + public-stats shell tests pass (78 total legacy).
- Migration keyword gate: `security invoker`, `sla`, k-threshold present in `20260721130002_postgres_analytics.sql`.

## Operator gate (Task 2 — blocking live RPC)

Push migration and run live SQL contract before end-to-end analytics against production Supabase:

```bash
node frontend/scripts/verify-tooling-decision.mjs --file frontend/operations/tooling-decision.json --require-native-psql
supabase db push --db-url $SUPABASE_DB_URL
node frontend/scripts/run-supabase-sql.mjs -f supabase/tests/07_postgres_analytics.sql
```

Also push `20260721130003_officer_operations.sql` if not yet applied (07-06 Task 2).

## Deferred

- Live image smoke for 07-02 (DeepSeek has no vision).
- BigQuery reader jobs remain read-only until Plan 08/12 reconciliation.
