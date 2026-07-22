---
phase: 07-google-free-self-hosted-platform
plan: "02"
subsystem: ai
tags: [openai-compatible, zod, vitest, provider-neutral, multimodal, server-only]

requires:
  - phase: 07-01
    provides: Vitest runner, golden contract fixtures, tooling gate
provides:
  - Strict Zod ReportAnalysis domain contract with JSON Schema export
  - Deterministic advisory policy validation seam
  - Provider-neutral AnalysisProvider interface and lineage types
  - Hardened OpenAI-compatible native-fetch adapter with generic failures
  - Live capability smoke script (blocked until operator configures AI env)
affects: [07-03, 07-04, 07-05, 07-14]

tech-stack:
  added: []
  patterns:
    - Zod strict schema + z.toJSONSchema for outbound/inbound analysis contract
    - server-only env validation with HTTPS-only AI base URL (loopback exception)
    - Native fetch adapter with redirect:error, AbortSignal timeout, bounded body reads
    - Generic AnalysisProviderError codes without secret/endpoint leakage

key-files:
  created:
    - frontend/src/server/domain/report-analysis.ts
    - frontend/src/server/domain/report-analysis.test.ts
    - frontend/src/server/validation/analysis-policy.ts
    - frontend/src/server/validation/analysis-policy.test.ts
    - frontend/src/server/ai/provider.ts
    - frontend/src/server/config/env.ts
    - frontend/src/server/ai/openai-compatible.ts
    - frontend/src/server/ai/openai-compatible.test.ts
    - frontend/scripts/smoke-ai.mjs
    - frontend/tests/stubs/server-only.ts
  modified:
    - frontend/.env.example
    - frontend/vitest.config.mts

key-decisions:
  - "Policy validation enforces advisory-only language, evidence/uncertainty separation, and severity-priority alignment without Phase 8 triage states"
  - "Smoke script is self-contained ESM (no TypeScript import) so plain node can gate live capability"
  - "Vitest aliases server-only to a stub because the package is not yet a direct dependency"

patterns-established:
  - "AI adapter returns { analysis, lineage } with actual response model/request ID/latency"
  - "All provider failures map to generic 'Report analysis failed' with typed internal codes only"

requirements-completed: [SELFHOST-02]

duration: 35min
completed: 2026-07-21
---

# Phase 7 Plan 02 Summary

**Provider-neutral OpenAI-compatible analysis adapter with strict Zod contracts, advisory policy validation, mocked security tests, and a live smoke gate blocked pending operator AI configuration**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-21T21:34:00+07:00
- **Completed:** 2026-07-21T21:38:00+07:00
- **Tasks:** 2/3 complete (Task 3 checkpoint blocked)
- **Files modified:** 12

## Accomplishments

- Strict `ReportAnalysisSchema` matches legacy Python enums/bounds and exports `reportAnalysisJsonSchema`
- Pure `validateAnalysisPolicy` enforces advisory-only output, evidence/uncertainty separation, and low-confidence uncertainty without officer overrides
- `createOpenAiCompatibleProvider` uses environment-only HTTPS endpoint, fixed `chat/completions` path, strict JSON schema, image parts, bounded reads, and lineage capture
- Mocked tests cover timeout, refusal, HTTP errors, invalid JSON/schema, byte cap, image part, redaction, and lineage
- `smoke-ai.mjs` implemented; correctly exits blocked when `AI_BASE_URL` / `THIRD_PARTY_API_KEY` / `AI_MODEL` are absent

## Task Commits

Changes are uncommitted per operator preference.

1. **Task 1: Domain contracts (TDD)** — schema, policy, provider interface + 17 tests
2. **Task 2: OpenAI-compatible adapter (TDD)** — env config, adapter, smoke script + 10 tests
3. **Task 3: Live smoke checkpoint** — **BLOCKED** (missing AI configuration)

## Verification Results

| Command | Result |
|---------|--------|
| `npm run test:unit -- src/server/domain/report-analysis.test.ts src/server/validation/analysis-policy.test.ts` | **27/27 pass** (17 domain/policy + 10 adapter) |
| `npx eslint src/server/config/env.ts src/server/domain/report-analysis.ts src/server/validation/analysis-policy.ts src/server/ai/provider.ts src/server/ai/openai-compatible.ts` | **pass** |
| `npm run lint` (full) | **fail** — pre-existing `DateRangeToolbar.tsx` react-hooks error (out of scope) |
| `node scripts/smoke-ai.mjs --require-strict-schema --require-image --require-lineage --require-privacy-approval` | **exit 2** — `SMOKE_BLOCKED: missing AI_BASE_URL, THIRD_PARTY_API_KEY, AI_MODEL` |

## Files Created/Modified

- `frontend/src/server/domain/report-analysis.ts` — strict Zod schema + JSON Schema export
- `frontend/src/server/validation/analysis-policy.ts` — deterministic advisory policy checks
- `frontend/src/server/ai/provider.ts` — `AnalysisProvider`, `AnalysisInput`, `AnalysisLineage` contract
- `frontend/src/server/config/env.ts` — server-only Zod env validation (Supabase + AI vars)
- `frontend/src/server/ai/openai-compatible.ts` — native-fetch adapter with generic error mapping
- `frontend/scripts/smoke-ai.mjs` — EN/VI text + PNG image live capability gate
- `frontend/.env.example` — generic third-party AI env vars added
- `frontend/vitest.config.mts` — `server-only` stub alias for unit tests
- `frontend/tests/stubs/server-only.ts` — empty stub module

## Decisions Made

- Smoke script duplicates minimal fetch/schema logic in plain ESM so `node scripts/smoke-ai.mjs` works without a TS loader
- Policy layer stays conservative (Phase 7 invariants only); no `manual_review`, retries, or worker state
- No Gemini, Vertex, Google AI SDK, or Google credential references in new TypeScript

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest could not resolve `server-only` import**
- **Found during:** Task 2 verification
- **Issue:** `import "server-only"` fails in Vitest because the package is not a direct dependency
- **Fix:** Added `tests/stubs/server-only.ts` and Vitest resolve alias
- **Files modified:** `frontend/vitest.config.mts`, `frontend/tests/stubs/server-only.ts`
- **Verification:** All 27 unit tests pass

---

**Total deviations:** 1 auto-fixed (blocking test infrastructure)
**Impact on plan:** Required for verify gate; no scope creep.

## Task 3 Checkpoint — BLOCKED

**Type:** `checkpoint:human-verify` (blocking)
**Status:** Awaiting operator AI configuration

### Blocker

Live smoke cannot run. Environment audit shows no configured values for:
- `AI_BASE_URL`
- `AI_MODEL`
- `THIRD_PARTY_API_KEY`

Smoke script correctly refuses to fake a live call (exit code 2).

### Operator steps to unblock

1. Add to `frontend/.env.local`:
   ```
   AI_BASE_URL=https://your-endpoint.example/v1
   AI_MODEL=your-configured-model
   THIRD_PARTY_API_KEY=your-third-party-api-key
   AI_PROVIDER_LABEL=third-party
   AI_TIMEOUT_MS=60000
   ```
2. Confirm endpoint privacy/retention terms are acceptable
3. Run:
   ```
   cd frontend
   node scripts/smoke-ai.mjs --require-strict-schema --require-image --require-lineage --require-privacy-approval
   ```
   Or set `SMOKE_AI_PRIVACY_APPROVED=1` to skip the interactive privacy prompt.

### Expected pass criteria

- EN text, VI text, and image cases return strict JSON analysis
- Lineage includes actual response model, request ID, and latency
- No API key or endpoint URL printed in output

## Issues Encountered

- Full `npm run lint` fails on pre-existing dashboard component issues unrelated to this plan slice

## User Setup Required

Operator must configure generic third-party AI endpoint credentials in `frontend/.env.local` before Task 3 live smoke can pass.

## Next Phase Readiness

- Wave 2 AI adapter slice is code-complete and unit-tested
- Report service orchestration (07-04) can import `createOpenAiCompatibleProvider` once live smoke passes
- **Do not switch report submission to the new adapter until Task 3 smoke is operator-approved**

## Self-Check: PASSED

- All 10 planned source files exist under `frontend/src/server/` and `frontend/scripts/`
- Unit tests: 27/27 pass
- No Google/Gemini imports in new server modules
- Smoke script blocks correctly without configuration (no fake live smoke)

---
*Phase: 07-google-free-self-hosted-platform*
*Completed: 2026-07-21 (Tasks 1-2; Task 3 blocked)*
