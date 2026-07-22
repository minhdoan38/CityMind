---
phase: 07-google-free-self-hosted-platform
plan: "04"
subsystem: persistence
tags: [supabase-rpc, evidence-storage, atomic-token, report-service, analyze-route, vitest]

requires:
  - phase: 07-02
    provides: AI provider contract and domain schemas
  - phase: 07-03
    provides: Citizen status Next.js slice
provides:
  - Atomic create_report_with_access_token RPC (hashed token only, SECURITY INVOKER)
  - Tightened private evidence bucket invariants (no anonymous storage insert)
  - evidence-service with magic-byte validation, upsert:false, compensation delete helpers
  - Synchronous Next.js analyze route with issue-once access_token and FastAPI-compatible errors
  - Public BFF delegates to local handler (no FastAPI hop)
affects: [07-05, 07-06, 07-08, 07-15]

tech-stack:
  added: [file-type@22.0.1]
  patterns:
    - Transactional report+token_hash RPC with service_role-only execute grant
    - file-type magic-byte gate before Storage or AI
    - Deterministic reports/{reportId}/evidence.{ext} paths with supabase:// URIs
    - Compensation delete on DB failure after evidence upload

key-files:
  created:
    - supabase/migrations/20260721130001_next_backend_contract.sql
    - supabase/tests/07_next_backend_contract.sql
    - frontend/src/server/services/evidence-service.ts
    - frontend/src/server/services/evidence-service.test.ts
    - frontend/src/server/services/report-service.ts
    - frontend/src/server/services/report-service.test.ts
    - frontend/src/app/api/v1/reports/analyze/route.ts
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/src/app/api/public/reports/analyze/route.ts
    - frontend/src/server/repositories/reports.ts
    - frontend/src/server/security/access-tokens.ts
    - frontend/src/server/http/errors.ts

key-decisions:
  - "Dropped insert_evidence_public; server-side service_role uploads only"
  - "create_report_with_access_token accepts token_hash + expires_at only (no plaintext)"
  - "Evidence upload uses upsert:false and deleteEvidenceByUri for DB-failure compensation"
  - "ReportForm unchanged — already posts to /api/public/reports/analyze local BFF"

requirements-completed: [SELFHOST-01, SELFHOST-02, SELFHOST-04]

duration: 55min
completed: 2026-07-21
---

# Phase 7 Plan 04 Summary

**Complete Next.js-only citizen submission slice: atomic RPC persistence, private evidence, synchronous analyze, and issue-once access tokens**

## Performance

- **Duration:** ~55 min (Tasks 1–3)
- **Started:** 2026-07-21T21:44:00+07:00
- **Completed:** 2026-07-21T22:30:00+07:00
- **Tasks:** 3/3 complete
- **Files modified:** 12

## Accomplishments

- Added `create_report_with_access_token` RPC with service_role-only execute grant and access_tokens lockdown
- Implemented `evidence-service.ts` with magic-byte validation, private Storage upload, and compensation delete
- Operator applied migration SQL to hosted Supabase (Task 2 unblocked)
- Implemented `report-service.ts`: multipart validation, AI analysis, atomic RPC persist, issue-once token
- Added `POST /api/v1/reports/analyze` and updated public BFF to delegate locally (no FastAPI hop)
- Added `issueAccessToken()` and `createReportWithAccessToken()` repository helper

## Task Status

| Task | Name | Status |
|------|------|--------|
| 1 | Atomic persistence + evidence invariants | **Complete** |
| 2 | Push and live-test schema | **Complete** (operator-applied) |
| 3 | Synchronous analyze route + ReportForm | **Complete** |

## Verification Results

| Command | Result |
|---------|--------|
| `npm run test:unit -- src/server/services/report-service.test.ts src/server/services/evidence-service.test.ts tests/contracts/golden-contracts.test.ts` | **25/25 pass** |
| `npm run test:unit` (full suite) | **PASS** |
| Changed-files eslint | **PASS** |

## Deviations from Plan

- ReportForm.tsx unchanged — already targeted `/api/public/reports/analyze`; route handler swap is sufficient
- Urban context enrichment deferred (stores `null`; Phase 7 scope focuses on core submission path)

## Self-Check: PASSED

- FOUND: `frontend/src/server/services/report-service.ts`
- FOUND: `frontend/src/app/api/v1/reports/analyze/route.ts`
- FOUND: `frontend/src/app/api/public/reports/analyze/route.ts`
