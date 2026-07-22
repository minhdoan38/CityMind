---
phase: 07-google-free-self-hosted-platform
plan: "10"
subsystem: ops
tags: [health, readiness, production-smoke, loopback]

requires:
  - phase: 07-09
provides:
  - GET /api/health liveness
  - GET /api/ready Supabase readiness probe
  - smoke:production loopback production smoke script
affects: [07-15]

key-files:
  created:
    - frontend/src/app/api/health/route.ts
    - frontend/src/app/api/ready/route.ts
    - frontend/src/server/health/readiness.ts
    - frontend/src/server/health/readiness.test.ts
    - frontend/scripts/smoke-production.mjs
    - frontend/scripts/register-citymind-task.ps1
    - frontend/operations/operator-runtime-decision.json
  modified:
    - frontend/package.json
    - frontend/.env.example

requirements-addressed: [SELFHOST-05]

duration: 35min
completed: 2026-07-22
---

# Phase 7 Plan 10 Summary

**Liveness/readiness endpoints and a loopback production smoke harness are in place for direct laptop Node operation.**

## Accomplishments

- `/api/health` returns `{ status: "ok" }` with no external calls.
- `/api/ready` probes Supabase with bounded timeout; response allowlists dependency name/status/latency only (`Cache-Control: no-store`).
- `npm run smoke:production` builds, starts on `127.0.0.1`, polls health/ready/home, scans logs for secret patterns, and shuts down gracefully.
- `operator-runtime-decision.json` template records backup/restore commands and loopback default.

## Status

| Task | Status |
|------|--------|
| Task 1 — health/readiness/smoke | **Complete** (unit tests pass) |
| Task 2 — operator runtime decision | **Pending operator sign-off** |
| Task 3 — Task Scheduler + live restore drill | **Script staged** (`register-citymind-task.ps1`); **verify blocked** on Tasks 2 + 09-2 |

## Verify locally

```bash
cd frontend
npm run test:unit -- src/server/health/readiness.test.ts
npm run build
npm run smoke:production
```
