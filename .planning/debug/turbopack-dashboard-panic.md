---
status: resolved
trigger: Turbopack FATAL panic on /dashboard HMR
created: 2026-07-22
updated: 2026-07-22
---

# Debug: turbopack-dashboard-panic

## Symptoms

- **Expected:** `npm run dev` stays up; `/dashboard` reloads without compiler crash.
- **Actual:** Intermittent `FATAL: An unexpected Turbopack error occurred` while serving `/dashboard` (200 responses then panic; dev process exits).
- **Error:** `Failed to write app endpoint /dashboard/page` → `get_next_server_import_map failed` → `Next.js package not found`.
- **Panic log:** `%TEMP%\next-panic-ea76b0f7c881e1577339a84b359a1867.log`

## Root cause

1. **Turbopack HMR bug** — Turbopack intermittently loses resolution of the local `next` package during dashboard page recompilation (known class of issues on Windows / after project root moves). `node_modules/next` is present; panic is resolver/cache instability, not a missing install.
2. **Build blocker (secondary)** — `AnalysisLineage` type used in `openai-compatible.ts` without import; `next build` typecheck failed.

## Fix applied

1. Import `AnalysisLineage` in `src/server/ai/openai-compatible.ts`.
2. Switch dev script to webpack: `"dev": "next dev --webpack"` (stable dev server; avoids Turbopack panic path).
3. Cleared `.next` before rebuild verification.

## Verification

- `npm run build` — should pass typecheck + compile
- `npm run dev` — webpack dev server; hit `/dashboard` repeatedly without FATAL panic

## Rollback / later

- Re-enable Turbopack when stable: change dev script back to `next dev` after Next.js patch or clean `node_modules` + `.next` reinstall if desired.
