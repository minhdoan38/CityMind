---
phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g
plan: "01"
subsystem: api
tags: [hanoi, zod, triage, guidance-resolver, supabase]

requires:
  - phase: 14-officer-agent-console-per-case-triage-run-and-attempt-log-vi
    provides: triage_runs/triage_attempts audit surface for Hanoi runs
provides:
  - Hanoi v5.2 16-key Zod schema and config loader
  - Bilingual guidance_code resolver with unit tests
  - Hanoi policy cross-field validation
  - Triage wired to Hanoi prompt replacing evaluator JSON path
  - DB columns and complete_triage_report Hanoi persistence
affects:
  - 15-02 chat intake API
  - 15-03 citizen UX and handling_type routing

tech-stack:
  added: []
  patterns:
    - "HanoiAnalysisSchema strict 16-key Zod at AI provider boundary"
    - "resolveGuidanceScript deterministic catalog lookup with generate_later fail-closed"
    - "projectHanoiToLegacyRow dual-write for officer dashboard compat"

key-files:
  created:
    - src/server/domain/hanoi-analysis.ts
    - src/server/domain/guidance-resolver.ts
    - src/server/domain/guidance-resolver.test.ts
    - src/server/ai/hanoi.ts
    - src/server/validation/hanoi-policy.ts
    - src/server/validation/hanoi-policy.test.ts
    - supabase/migrations/20260723120001_hanoi_analysis_columns.sql
  modified:
    - src/server/ai/openai-compatible.ts
    - src/server/ai/openai-compatible.test.ts
    - src/server/triage/service.ts
    - src/server/triage/config.ts
    - src/server/domain/analysis-projection.ts
    - src/server/triage/audit.ts

key-decisions:
  - "Triage classifier uses Hanoi v5.2 prompt JSON (config_version 5.2.0) per D-15-02"
  - "Empty/refusal provider content throws invalid_response before JSON.parse per T-15-03"
  - "Policy validation runs after Zod parse in analyzeStructured path"
  - "Legacy evaluator-analysis falls back to Hanoi JSON for category enum when evaluator file missing"

patterns-established:
  - "HANOI_SEVERITY_TO_INT maps string severity to dashboard integer 1/2/4/5"
  - "inferOutputLanguage selects vi-VN vs en-US from report_text Vietnamese majority"

requirements-completed: [TRIAGE-15, TRIAGE-07]

duration: 5min
completed: 2026-07-23
---

# Phase 15 Plan 01: Hanoi v5.2 Classifier Foundation Summary

**Hanoi v5.2 16-key triage classifier with bilingual guidance resolver, policy validation, and triage persistence replacing the missing evaluator JSON path**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-23T02:03:00Z
- **Completed:** 2026-07-23T02:08:00Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- HanoiAnalysisSchema validates all 16 keys from `citymind_ai_hanoi_triage_guidance_v5_2 (1).json`
- `resolveGuidanceScript` delivers bilingual scripts for valid low/medium codes; high/critical always `generate_later`
- Triage service and `openai-compatible` use Hanoi prompt; empty provider responses gated as `invalid_response`
- Migration adds Hanoi columns and extends `complete_triage_report` for Hanoi field persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: HanoiAnalysisSchema + guidance resolver** - `5933487` (feat)
2. **Task 2: Hanoi policy validation** - `08f0b11` (feat)
3. **Task 3: Wire triage to Hanoi + DB migration** - `9d2aba1` (feat)

## Files Created/Modified

- `src/server/domain/hanoi-analysis.ts` - 16-key Zod schema with severity string enum and confidence anchors
- `src/server/domain/guidance-resolver.ts` - Deterministic script resolver from bilingual catalog
- `src/server/ai/hanoi.ts` - Hanoi v5.2 config loader (`buildHanoiSystemPrompt`, `getHanoiConfigVersion`)
- `src/server/validation/hanoi-policy.ts` - Cross-field handling/severity/critical_alert rules
- `src/server/ai/openai-compatible.ts` - Hanoi parse path with policy gate and empty-content rejection
- `src/server/triage/service.ts` - Hanoi policy + RPC payload projection
- `supabase/migrations/20260723120001_hanoi_analysis_columns.sql` - Additive columns + RPC Hanoi mapping

## Decisions Made

- Policy validation integrated in `parseAndValidateSchema` so provider and analyzeStructured share one gate
- `HANOI_PROMPT_VERSION` (5.2.0) recorded in triage audit metadata
- Shadow compare updated to compare Hanoi severity strings via normalized integer mapping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] evaluator-analysis import-time crash on missing JSON**
- **Found during:** Task 3 (openai-compatible tests)
- **Issue:** `evaluator-analysis.ts` read deleted `citymind_ai_triage_structured_output_evaluator.json` at module init, breaking any import of `analysis-projection`
- **Fix:** Fall back to Hanoi v5.2 JSON for category enum when evaluator file absent
- **Files modified:** `src/server/domain/evaluator-analysis.ts`
- **Verification:** `npm run test:unit` — 41 tests passed
- **Committed in:** `9d2aba1`

**2. [Rule 2 - Missing Critical] Extended complete_triage_report in migration**
- **Found during:** Task 3 (persistence design)
- **Issue:** Plan listed column migration only; RPC v2 could not persist Hanoi-specific fields
- **Fix:** Included `CREATE OR REPLACE FUNCTION complete_triage_report` with Hanoi column mapping in same migration
- **Files modified:** `supabase/migrations/20260723120001_hanoi_analysis_columns.sql`
- **Verification:** Migration SQL reviewed for additive IF NOT EXISTS columns
- **Committed in:** `9d2aba1`

**3. [Rule 1 - Bug] Shadow service type drift after StructuredAnalysisResult rename**
- **Found during:** Task 3 (triage wiring)
- **Issue:** `shadow-service.ts` and tests still referenced `evaluatorAnalysis`
- **Fix:** Updated shadow service, compare helper, and tests for `hanoiAnalysis`
- **Files modified:** `src/server/evals/shadow-service.ts`, `shadow-compare.ts`, `shadow-service.test.ts`
- **Verification:** Included in unit test run
- **Committed in:** `9d2aba1`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 bug)
**Impact on plan:** All necessary for correct triage operation; no scope creep beyond Hanoi cutover.

## Issues Encountered

None beyond deviations above.

## User Setup Required

None - no external service configuration required. Run `supabase db push` to apply `20260723120001_hanoi_analysis_columns.sql` before production triage.

## Next Phase Readiness

- Wave 2 (15-02) can build chat intake API on Hanoi classifier foundation
- Eval suite (`run-case.ts`, `eval-suite-runner.ts`) still references evaluator types — align in a future plan or eval migration
- Apply DB migration before end-to-end triage verification

## Self-Check: PASSED

- FOUND: src/server/domain/hanoi-analysis.ts
- FOUND: src/server/domain/guidance-resolver.ts
- FOUND: src/server/ai/hanoi.ts
- FOUND: supabase/migrations/20260723120001_hanoi_analysis_columns.sql
- FOUND: 5933487
- FOUND: 08f0b11
- FOUND: 9d2aba1

---
*Phase: 15-citizen-conversational-support-chat-first-intake-and-hanoi-g*
*Completed: 2026-07-23*
