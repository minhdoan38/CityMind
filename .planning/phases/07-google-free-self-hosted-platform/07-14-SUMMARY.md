---
phase: 07-google-free-self-hosted-platform
plan: "14"
subsystem: runtime
tags: [nextjs-only, backend-bridge-removal, env-cleanup]

requires:
  - phase: 07-13
provides:
  - Node-only frontend runtime without FastAPI proxy
affects: [07-15]

key-files:
  deleted:
    - frontend/src/lib/backend.ts
  modified:
    - frontend/.env.example
    - frontend/scripts/load-project-env.mjs
    - frontend/tests/officer-auth.test.mjs
    - frontend/scripts/google-exit-audit.mjs

requirements-addressed: [SELFHOST-01, SELFHOST-02, SELFHOST-05, SELFHOST-06]

duration: 10min
completed: 2026-07-22
---

# Phase 7 Plan 14 Summary

**Active runtime is Next.js-only: FastAPI proxy bridge and `BACKEND_API_URL` removed.**

## Changes

- Deleted `frontend/src/lib/backend.ts` (`backendEndpoint`, `officerFetch`)
- Removed `BACKEND_API_URL` from `frontend/.env.example`
- Tooling env loader reads `frontend/.env.local` only
- Legacy officer-auth tests assert direct `officer-read` evidence path (no proxy)
- Google-exit scanner roots no longer include deleted backend/docker paths

## Verification

```text
npm test                          → pass
npm run build                     → pass
audit:google-exit --mode post-runtime-cleanup → PASS (hash 8f2e5571…)
```

Smoke production not re-run in this plan slice (requires live Supabase + AI env).
