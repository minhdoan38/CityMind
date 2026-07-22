---
phase: 07-google-free-self-hosted-platform
plan: "15"
subsystem: docs
tags: [documentation, final-audit, operations]

requires:
  - phase: 07-14
provides:
  - Next.js-only operator documentation
  - docs-mode google-exit audit PASS
affects: []

key-files:
  modified:
    - README.md
    - AGENTS.md
    - .planning/codebase/STACK.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/INTEGRATIONS.md

requirements-addressed: [SELFHOST-01, SELFHOST-02, SELFHOST-03, SELFHOST-04, SELFHOST-05, SELFHOST-06]

duration: 20min
completed: 2026-07-22
---

# Phase 7 Plan 15 Summary

**Active documentation describes the direct laptop Next.js/Supabase platform; docs audit passes.**

## Documentation updates

- `README.md` — Node 22 quick start, health/ready, backup/restore, Task Scheduler, no Cloud Run/FastAPI
- `AGENTS.md` — project/stack/architecture sections aligned to Phase 7 runtime
- `.planning/codebase/STACK.md`, `ARCHITECTURE.md`, `INTEGRATIONS.md` — Next.js-only truth

## Audits

| Mode | Status | Hash |
|------|--------|------|
| `docs` | PASS | `f35cf9e1…` |
| `post-runtime-cleanup` | PASS | `8f2e5571…` |
| `final --require-all-signed-evidence` | **Pending** | restore/cleanup gates unsigned |

## Remaining operator gates (phase close)

1. Apply migration `20260721130005` if not yet live (DROP both RPC overloads first)
2. Run `07_remove_legacy_evidence.sql` + `07_evidence_final.sql`
3. Sign `restore-and-rollback-gate.json`, `operator-runtime-decision.json`, `local-cleanup-approval.json`
4. Isolated restore drill + `npm run smoke:production`
5. `audit:google-exit -- --mode final --require-all-signed-evidence`
