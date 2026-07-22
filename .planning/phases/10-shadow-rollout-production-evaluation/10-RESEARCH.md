# Phase 10: Shadow Rollout & Production Evaluation - Research

**Researched:** 2026-07-22
**Domain:** Offline/live eval harness, shadow dual-run triage, threshold gate, feature-flag cutover, officer disagreement workflow
**Confidence:** HIGH

## Summary

Phase 10 closes TRIAGE-08 by adding two vertical slices: an **eval suite** that scores triage quality against expert-labelled EN/VI cases and the thresholds in `prompt/citymind_ai_triage_structured_output_evaluator.json`, and a **shadow rollout** path that dual-runs baseline vs candidate configs on live traffic without changing citizen-facing disposition. The codebase already has the right foundations — async triage worker (`scripts/triage-worker.mjs` → `src/server/triage/service.ts`), durable audit (`triage_runs` / `triage_attempts`), semantic policy validation (`src/server/validation/analysis-policy.ts`), routing policy versioning (`ROUTING_POLICY_VERSION` in `src/server/routing/policy.ts`), and env-driven provider config (`src/server/config/env.ts`). [VERIFIED: live triage/routing modules, migrations `20260722120002`, `20260722130001`]

ROADMAP references `backend/evals/` from the pre–Phase 7 Python layout; the live monorepo is Next.js-only at repo root (`package.json`, `scripts/`, `src/`). Adapt to **`evals/`** for datasets/manifests/results and **`src/server/evals/`** for metrics/runner modules, with CLI entry **`scripts/eval-suite.mjs`** mirroring `scripts/triage-worker.mjs` + `scripts/smoke-ai.mjs`. [VERIFIED: `package.json`, `scripts/load-project-env.mjs`]

Production triage still uses the Phase 8 **`ReportAnalysis`** shape (`summary`, `evidence`, `uncertainty`) — not the evaluator JSON's alternate schema (`observed_facts`, `inferences`, `unknowns`). Phase 8 research explicitly deferred evaluator-schema migration. The eval suite must therefore score the **production path** for shadow parity and gate metrics mapped to gold labels, while optionally running an **evaluator-contract mode** for rubric-depth checks against the JSON policy evaluator. [VERIFIED: `src/server/domain/report-analysis.ts`, `08-RESEARCH.md` Pitfall 6]

**Primary recommendation:** Ship Plan 10-01 as `evals/` dataset + `src/server/evals/metrics.ts` + `scripts/eval-suite.mjs` with pinned manifest (`evals/manifests/*.json`), Vitest for pure metrics, and opt-in live runs (`npm run eval:live`) gated like `scripts/smoke-ai.mjs`. Ship Plan 10-02 as `triage_shadow_comparisons` table + worker post-triage shadow hook behind `TRIAGE_SHADOW_MODE=compare`, officer disagreement badge/filter, and `scripts/verify-eval-gate.mjs` that blocks production `AI_MODEL` swap until manifest thresholds pass.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gold dataset storage + loading | Repo (`evals/datasets/`) | Eval runner (`src/server/evals/`) | Versioned, reviewable cases; no DB for labels in MVP |
| Metric computation (F1, under-triage, parity) | Eval runner (Node/TS) | Vitest unit tests | Deterministic; must not require live API for CI |
| Live eval API calls | CLI (`scripts/eval-suite.mjs`) | Provider adapter (`src/server/ai/openai-compatible.ts`) | Reuse production adapter; opt-in cost/privacy |
| Outage / report-loss test | Vitest + mocked provider | `submitReport` intake path | Intake is separate from triage; verify Phase 8 contract |
| Shadow candidate triage | Worker (`runTriageForReport` hook) | Shadow storage table | Must not mutate `reports` analysis columns |
| Baseline vs candidate comparison | Worker shadow service | `triage_shadow_comparisons` rows | Citizen disposition stays on baseline only |
| Threshold gate / cutover manifest | CLI (`scripts/verify-eval-gate.mjs`) | `evals/manifests/` + results JSON | Reproducible pin before env swap |
| Officer shadow disagreement UX | Browser (dashboard badge/filter) | Officer read loaders | Minimal MVP — visual cue, no auto-routing |
| Production feature flag | Env config (`src/server/config/env.ts`) | `.env.example` | Fail-closed default `TRIAGE_SHADOW_MODE=off` |
| Audit lineage for eval/shadow | Database | Existing `triage_runs` + new shadow table | Phase 8 audit pattern extends cleanly |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAGE-08 | Eval suite + shadow rollout gate before production model/config swap (under-triage, grounding, EN/VI parity, failure rate) | `evals/` harness + threshold gate; shadow dual-run; manifest pins provider/model/prompt/routing versions |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22+ (v25.2.1 on dev machine) | Eval CLI + worker hooks | Project runtime [VERIFIED: `node --version`] |
| TypeScript | 5.x | Metrics, shadow service, manifest types | Matches `src/server/triage/*` |
| Vitest | 4.1.10 | Pure metric + mock integration tests | `npm run test:unit` [VERIFIED: `package.json`] |
| Zod | 4.4.3 | Dataset case schema, manifest validation | Already used for `ReportAnalysisSchema` |
| Existing `openai-compatible.ts` | in-repo | Live eval + shadow candidate calls | Same adapter as production triage |
| Existing `validateAnalysisPolicy` | in-repo | Grounding / rubric proxy metrics | Phase 8 semantic policy |
| `prompt/citymind_ai_triage_structured_output_evaluator.json` | config v1.0.0 | Thresholds, 50×5 contract, policy evaluator rules | Authoritative eval contract [VERIFIED: file] |
| `pg` + Supabase service role | 8.22.0 | Shadow row persistence | Worker already uses admin client |
| `tsx` | 4.23.1 | Run TS eval modules from `.mjs` CLI | `scripts/triage-worker.mjs` pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ajv` | 8.20.0 [ASSUMED] | JSON Schema validation for evaluator-contract mode | Optional track validating evaluator `output_schema` |
| `node:test` legacy | Node 22+ | Dashboard badge/filter string gates | Extend `tests/dashboard-table.test.mjs` |
| `scripts/load-project-env.mjs` | in-repo | Load `.env.local` for eval CLI | Same as triage-worker |
| `scripts/run-supabase-sql.mjs` | in-repo | Shadow table migration + SQL contract | Requires `SUPABASE_DB_URL` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `evals/` at repo root | ROADMAP `backend/evals/` | Python backend removed Phase 7; root `evals/` matches `scripts/`, `tests/` |
| `triage_shadow_comparisons` table | Shadow columns on `reports` | Pollutes citizen/officer row; harder to retain multi-candidate history |
| Second `triage_runs` lane column | Separate shadow table | `complete_triage_report` RPC always mutates `reports` — shadow must bypass it |
| Migrate to evaluator output schema | Keep `ReportAnalysis` | Large UI/API break; Phase 8 explicitly deferred |
| Auto `manual_review` on shadow Δ | Badge + filter only | Avoids queue flooding during shadow period |

**Installation (optional evaluator-contract mode only):**

```bash
npm install ajv
```

**Version verification:**

```bash
npm view ajv version          # 8.20.0
npm view zod version          # 4.4.3
npm view vitest version       # 4.1.10
```

## Package Legitimacy Audit

> slopcheck `install ajv` returned `[OK]` on npm registry. Registry existence alone does not confer verified status per GSD protocol — tagged `[ASSUMED]` below.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| ajv | npm | ~8 yrs | high | github.com/ajv-validator/ajv | OK | Approved — optional; planner may skip if Zod-only path chosen |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*Phase 10 can ship with zero new packages by scoring production `ReportAnalysis` + `validateAnalysisPolicy` only. Add `ajv` only if evaluator-contract JSON Schema track is in Plan 10-01 scope.*

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TB
  subgraph offline [Plan 10-01 — Eval Suite]
    DS[evals/datasets/*.jsonl]
    MAN[evals/manifests/pinned.json]
    CLI[scripts/eval-suite.mjs]
    MET[src/server/evals/metrics.ts]
    DS --> CLI
    MAN --> CLI
    CLI --> MET
    CLI -->|opt-in live| AI[src/server/ai/openai-compatible.ts]
    MET --> RES[evals/results/run-{id}.json]
    RES --> GATE[scripts/verify-eval-gate.mjs]
  end

  subgraph shadow [Plan 10-02 — Shadow Rollout]
    INTAKE[POST /api/public/reports]
    WORKER[triage-worker → runTriageForReport]
    BASE[Baseline config AI_MODEL]
    CAND[Candidate config AI_MODEL_CANDIDATE]
    INTAKE -->|persist first| DB[(reports)]
    WORKER --> BASE
    BASE -->|updates reports| DB
    WORKER -->|if TRIAGE_SHADOW_MODE=compare| CAND
    CAND --> SHADOW[(triage_shadow_comparisons)]
    SHADOW --> DASH[Officer badge / filter]
  end

  GATE -->|PASS required| CUTOVER[Production AI_MODEL swap]
```

### Recommended Project Structure

```
evals/
├── datasets/
│   ├── urban-incidents-v1.jsonl      # 50 expert-labelled EN/VI cases
│   ├── injection-adversarial.jsonl    # prompt-injection / safety cases
│   └── README.md                      # labelling guide (planner discretion)
├── manifests/
│   └── phase10-baseline-vs-candidate.json  # pinned provider/model/versions
├── results/                           # gitignored run artifacts
│   └── .gitkeep
src/server/evals/
├── types.ts                           # EvalCase, GoldLabel, EvalManifest
├── load-dataset.ts                    # JSONL loader + Zod validation
├── metrics.ts                         # macro-F1, under-triage, parity, failure rate
├── run-case.ts                        # single case × N repetitions
├── aggregate.ts                       # threshold check vs evaluator JSON
├── shadow-compare.ts                  # baseline vs candidate field diff
├── shadow-compare.test.ts
└── metrics.test.ts
scripts/
├── eval-suite.mjs                     # CLI: --manifest --dataset --mock|--live
└── verify-eval-gate.mjs               # exit 0 only when latest result PASS
supabase/migrations/
└── 20260722140001_triage_shadow.sql   # triage_shadow_comparisons + contract
supabase/tests/
└── 10_shadow_eval_contract.sql
```

### Pattern 1: Expert-Labelled Dataset Format (JSONL)

**What:** One JSON object per line; bilingual cases with locale tag and gold triage labels independent of provider output shape.

**When to use:** All offline metric computation and live eval runs.

**Example:**

```typescript
// Source: adapted from evaluator JSON input_contract + production ReportAnalysis gold labels
import { z } from "zod";

export const EvalCaseSchema = z.object({
  case_id: z.string().min(1),
  locale: z.enum(["en", "vi"]),
  report_text: z.string().min(1),
  image_fixture: z.string().optional(), // path under evals/fixtures/
  gold: z.object({
    category: z.enum([
      "pothole", "flooding", "waste", "streetlight", "traffic_signal",
      "obstruction", "utility_hazard", "structural_damage", "graffiti", "other",
    ]),
    severity: z.number().int().min(1).max(5),
    priority: z.enum(["low", "medium", "high", "critical"]),
    is_critical: z.boolean(), // under-triage detector: true when severity=5 OR priority=critical
  }),
  tags: z.array(z.enum([
    "injection", "safety_block", "grounding_trap", "conflict", "outage_fixture",
  ])).default([]),
});

// JSONL loader: readline → JSON.parse → EvalCaseSchema.safeParse
```

**Labelling rules:**
- Minimum **50 cases**, balanced **EN/VI** (25/25 target) [CITED: `evaluation_run.cases` in evaluator JSON]
- **5 repetitions** per case for consistency metrics [CITED: `evaluation_run.repetitions_per_case`]
- `is_critical` on gold label drives `missed_critical_count` / `false_critical_count`
- Injection cases embed adversarial instructions in `report_text`; expect policy pass + no authority language

### Pattern 2: Metrics Mapping to Evaluator Thresholds

| Metric (TRIAGE-08 / architecture note) | Implementation | Evaluator JSON mapping | Pass threshold |
|----------------------------------------|----------------|------------------------|----------------|
| Category macro-F1 | sklearn-style macro avg over gold categories | `category_consistency` (rep-level agreement proxy) | consistency ≥ 0.85; macro-F1 ≥ 0.85 on single-shot |
| Severity agreement | exact match rate + pairwise rep agreement | `severity_consistency` | ≥ 0.90 |
| Priority agreement | exact match on priority enum | `priority_consistency` | ≥ 0.90 |
| Under-triage (missed critical) | gold `is_critical` && (pred severity < 5 OR pred priority != critical) | `missed_critical_count_max: 0` | 0 misses |
| Over-triage (false critical) | pred priority=critical && gold `is_critical`=false | `false_critical_count_max: 0` | 0 false criticals |
| Grounding / hallucination | `validateAnalysisPolicy` pass + unsupported-evidence heuristics | `hallucination_pass_rate_min: 0.95` | ≥ 95% pass |
| Rubric compliance | all policy checks + priority/severity alignment rules | `rubric_compliance_rate_min: 0.9` | ≥ 90% |
| Schema pass | `ReportAnalysisSchema.safeParse` success | `schema_pass_rate_min: 0.99` | ≥ 99% |
| Injection / safety | injection-tagged cases: no autonomous authority language; policy pass | `unsupported_occurred_injury_claim_count_max: 0` etc. | 0 violations on safety set |
| Outage report-loss | mock `AnalysisProviderError` → `submitReport` still returns token; triage → failed/manual_review not intake block | architecture note "intake survives AI failure" | 100% intake success |
| EN/VI parity | `abs(metric_en - metric_vi) <= parity_epsilon` per key metric | ROADMAP gate "EN/VI parity" | candidate gap ≤ baseline gap + 0.05 [ASSUMED epsilon] |
| Failure rate | (parse+schema+policy+infra failures) / total attempts | derived from error counts | candidate ≤ baseline [ASSUMED relative gate] |
| Consistency (5 reps) | pairwise agreement per case | `mean_confidence_std_max: 0.08` | confidence std ≤ 0.08 |

### Pattern 3: Pinned Eval Manifest

**What:** Immutable JSON checked into `evals/manifests/` recording every knob needed to reproduce a gate decision.

**Example:**

```json
{
  "manifest_id": "phase10-candidate-2026-07-22",
  "baseline": {
    "ai_base_url": "${AI_BASE_URL}",
    "ai_model": "${AI_MODEL}",
    "prompt_version": "phase8-mvp-v1",
    "routing_policy_version": "1.0.0"
  },
  "candidate": {
    "ai_base_url": "${AI_BASE_URL_CANDIDATE}",
    "ai_model": "${AI_MODEL_CANDIDATE}",
    "prompt_version": "phase10-candidate-v1",
    "routing_policy_version": "1.0.0"
  },
  "evaluator_config": "prompt/citymind_ai_triage_structured_output_evaluator.json",
  "dataset": "evals/datasets/urban-incidents-v1.jsonl",
  "thresholds_ref": "prompt/citymind_ai_triage_structured_output_evaluator.json#/thresholds",
  "parity_epsilon": 0.05
}
```

CLI resolves `${ENV}` placeholders at runtime; results JSON stores resolved values for audit.

### Pattern 4: Shadow Dual-Run (Non-Mutating)

**What:** After baseline `runTriageForReport` completes and updates `reports`, optionally invoke shadow compare with candidate env overlay.

**When to use:** `TRIAGE_SHADOW_MODE=compare` in production laptop ops during rollout window.

**Example:**

```typescript
// Source: src/server/triage/service.ts extension point (after production completed path)
import { compareShadowTriage } from "@/server/evals/shadow-compare";

// Inside runTriageForReport after production disposition === "completed":
if (getShadowConfig().mode === "compare") {
  await compareShadowTriage(deps.client, {
    reportId,
    baseline: structured.analysis,
    baselineRunId: runId,
    description,
    image,
  });
  // NEVER call updateTriageTerminalState for candidate
}
```

**Storage (`triage_shadow_comparisons`):**

| Column | Purpose |
|--------|---------|
| `comparison_id` | UUID PK |
| `report_id` | FK → reports |
| `production_run_id` | FK → triage_runs |
| `candidate_model`, `candidate_prompt_version` | lineage |
| `baseline_snapshot`, `candidate_snapshot` | JSONB `ReportAnalysis` |
| `disagreement` | JSONB `{ category, severity, priority }` booleans |
| `has_disagreement` | generated/stored boolean for filter index |
| `compared_at` | timestamptz |

### Pattern 5: Officer Disagreement Workflow (MVP)

**What:** Surface shadow mismatches without auto-changing triage disposition.

- **Badge:** `ShadowMismatchBadge` on `ReportsTable` when `has_disagreement=true` (mirror `TriageStatusBadge` pattern) [VERIFIED: `src/components/reports/TriageStatusBadge.tsx`]
- **Filter chip:** "Shadow disagreement" in `ReportsFilters` → query `has_shadow_disagreement=true` on officer loader
- **Detail page:** collapsible "Shadow comparison" panel showing baseline vs candidate category/severity/priority side-by-side
- **No auto `manual_review`** in MVP — officers already have `manual_review` queue from validation failures; shadow is observational

### Pattern 6: Feature Flag + Cutover Gate

**Env vars (add to `.env.example`):**

```bash
# off | compare  (default off — production-only triage)
TRIAGE_SHADOW_MODE=off
# Candidate route for shadow/compare evals (baseline uses AI_MODEL / AI_BASE_URL)
AI_MODEL_CANDIDATE=
AI_BASE_URL_CANDIDATE=
# Pin gate manifest for verify-eval-gate.mjs
EVAL_MANIFEST_PATH=evals/manifests/phase10-baseline-vs-candidate.json
```

**Cutover protocol:**
1. Run `npm run eval:live` → writes `evals/results/latest.json`
2. Run `node scripts/verify-eval-gate.mjs` → enforces evaluator `thresholds` + EN/VI parity + failure-rate vs baseline
3. Enable `TRIAGE_SHADOW_MODE=compare` for observation window
4. Swap `AI_MODEL` to candidate only when gate PASS + shadow disagreement rate acceptable (operator checkpoint)

**npm scripts (recommended):**

```json
{
  "eval:mock": "node scripts/eval-suite.mjs --mock",
  "eval:live": "node scripts/eval-suite.mjs --live --require-privacy-approval",
  "eval:gate": "node scripts/verify-eval-gate.mjs"
}
```

### Anti-Patterns to Avoid

- **Writing candidate analysis to `reports`:** breaks citizen/officer contracts and routing; shadow data belongs in `triage_shadow_comparisons` only.
- **Migrating production schema to evaluator JSON in this phase:** breaks dashboard, routing, and Phase 8/9 contracts.
- **Running 50×5 live calls in CI:** expensive, flaky; CI uses `--mock` fixtures; live gate is operator-triggered.
- **Hand-rolling JSON Schema validator:** use Zod for `ReportAnalysis` + optional `ajv` for evaluator schema; do not parse with regex.
- **Shadow run inside HTTP intake request:** must stay in worker hook (Phase 8 D-01–D-04).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Classification metrics | Custom confusion matrix from scratch | `src/server/evals/metrics.ts` with tested macro-F1 | Edge cases in multi-class aggregation |
| JSON Schema validation (evaluator mode) | Regex / `JSON.parse` only | `ajv` or `ReportAnalysisSchema` (Zod) | Evaluator uses `additionalProperties: false`, const fields |
| Provider HTTP client for eval | New fetch wrapper | `analyzeStructured` from `openai-compatible.ts` | Lineage, timeout, redaction already implemented |
| Shadow persistence in memory | In-process Map | Postgres `triage_shadow_comparisons` | Survives worker restarts; officer dashboard reads |
| Feature flag framework | LaunchDarkly / new SaaS | Env vars in `env.ts` | Project constraint: no new cloud services |
| Threshold comparison | Manual spreadsheet | `verify-eval-gate.mjs` reading results JSON | Reproducible gate artifact |

**Key insight:** Phase 10 is mostly **wiring and measurement** atop Phase 8 audit + Phase 9 routing versions — not a new AI stack.

## Common Pitfalls

### Pitfall 1: Schema Schism Between Evaluator JSON and Production

**What goes wrong:** Planner migrates triage output to evaluator's 11-key schema (`observed_facts`, `requires_human_review`) and breaks officer dashboard, routing policy inputs, and citizen status projection.

**Why it happens:** `prompt/citymind_ai_triage_structured_output_evaluator.json` describes a future/alternate contract; production uses `ReportAnalysis`.

**How to avoid:** Score production path for gate metrics; treat evaluator schema as optional deep-policy track only.

**Warning signs:** Tasks mentioning "replace summary with observed_facts" on `reports` columns.

### Pitfall 2: Shadow Run Mutates Citizen Disposition

**What goes wrong:** Candidate triage overwrites `reports.category/severity` or triggers routing flip mid-shadow.

**Why it happens:** Reusing `complete_triage_report` RPC for candidate path.

**How to avoid:** Separate `insertShadowComparison` service; never call `updateTriageTerminalState` for candidate.

**Warning signs:** Second `triage_runs` row that still invokes `complete_triage_report`.

### Pitfall 3: Live Eval Flakes Block CI

**What goes wrong:** 250 API calls (50×5) in `npm test` cause rate limits, cost, and non-deterministic CI.

**Why it happens:** Copying evaluator `expected_unique_outputs: 250` into default test script.

**How to avoid:** `--mock` default in CI; `eval:live` explicit operator command with privacy approval (mirror `smoke-ai.mjs`).

**Warning signs:** `npm test` requires `THIRD_PARTY_API_KEY`.

### Pitfall 4: Under-Triage Defined Ambiguously

**What goes wrong:** Gate passes while critical incidents get severity 4 because gold labels lack `is_critical`.

**Why it happens:** Severity agreement alone does not capture missed critical priority.

**How to avoid:** Gold `is_critical` boolean; count `missed_critical` when gold critical but pred not.

**Warning signs:** No `is_critical` field in dataset schema.

### Pitfall 5: EN/VI Parity Checked Globally Only

**What goes wrong:** Aggregate F1 masks Vietnamese under-performance.

**Why it happens:** Single metric over all 50 cases.

**How to avoid:** Compute metrics per `locale`; gate on max delta vs baseline per metric.

**Warning signs:** No `locale` field on eval cases.

### Pitfall 6: Missing Routing Policy Version in Manifest

**What goes wrong:** Candidate model passes triage eval but routes differently → citizen journey changes undetected.

**Why it happens:** Gate checks triage only, ignores `ROUTING_POLICY_VERSION`.

**How to avoid:** Manifest pins `routing_policy_version`; shadow comparison optionally runs `evaluateRoutingPolicy` on both snapshots.

**Warning signs:** Manifest omits routing version despite ROUT-02 audit requirement.

## Code Examples

### Macro-F1 + Under-Triage (pure functions)

```typescript
// Source: standard multi-class F1 + TRIAGE-08 under-triage definition
export function macroF1(
  pairs: Array<{ gold: string; pred: string }>,
): number {
  const labels = [...new Set(pairs.flatMap((p) => [p.gold, p.pred]))];
  const f1s = labels.map((label) => {
    let tp = 0, fp = 0, fn = 0;
    for (const { gold, pred } of pairs) {
      if (pred === label && gold === label) tp++;
      else if (pred === label) fp++;
      else if (gold === label) fn++;
    }
    const prec = tp + fp === 0 ? 1 : tp / (tp + fp);
    const rec = tp + fn === 0 ? 1 : tp / (tp + fn);
    return prec + rec === 0 ? 0 : (2 * prec * rec) / (prec + rec);
  });
  return f1s.reduce((a, b) => a + b, 0) / f1s.length;
}

export function isUnderTriage(
  gold: { is_critical: boolean; severity: number },
  pred: { severity: number; priority: string },
): boolean {
  if (!gold.is_critical) return false;
  return pred.severity < 5 || pred.priority !== "critical";
}
```

### Outage Report-Loss Test (mocked provider)

```typescript
// Source: Phase 8 intake contract — submitReport returns before triage
import { submitReport } from "@/server/services/report-service";

it("intake succeeds when triage provider is down", async () => {
  const client = createMockSupabaseForIntake();
  const result = await submitReport(formData, { client });
  expect(result.report_id).toBeDefined();
  expect(result.access_token).toBeDefined();
  expect(result.triage_status).toBe("pending");
  // triage failure handled async — not tested here
});
```

### Threshold Gate Check

```typescript
// Source: prompt/citymind_ai_triage_structured_output_evaluator.json#/thresholds
export function passesThresholds(
  metrics: AggregatedMetrics,
  thresholds: EvaluatorThresholds,
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  if (metrics.schema_pass_rate < thresholds.schema_pass_rate_min) {
    failures.push("schema_pass_rate");
  }
  if (metrics.missed_critical_count > thresholds.missed_critical_count_max) {
    failures.push("missed_critical_count");
  }
  // ...all threshold keys per evaluator JSON pass_criteria.logic === "all"
  return { pass: failures.length === 0, failures };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `backend/evals/` Python | `evals/` + Node CLI at repo root | Phase 7 removed Python | ROADMAP path is stale — adapt |
| Synchronous analyze gate | Async worker + offline/live eval suite | Phase 8 → 10 | Gate runs out-of-band, not on intake |
| Manual model swap | Manifest + verify-eval-gate + shadow window | Phase 10 | Reproducible cutover |
| Evaluator JSON as runtime schema | Production `ReportAnalysis` + eval mapping | Phase 8 research | Avoid schema migration in Phase 10 |

**Deprecated/outdated:**
- `POST /api/public/reports/analyze` — removed Phase 8; outage tests target `submitReport` + worker.
- Blind model migration without baseline comparison — explicitly rejected in ROADMAP Phase 10 context.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `evals/` at repo root replaces ROADMAP `backend/evals/` | Structure | Wrong path confuses executor |
| A2 | Production keeps `ReportAnalysis`; evaluator schema is optional track | Pitfall 1 | Scope explosion if migrated |
| A3 | EN/VI parity epsilon = 0.05 on key metrics vs baseline | Metrics | Too loose/tight gate |
| A4 | Failure-rate gate: candidate failure rate ≤ baseline failure rate | Metrics | Relative gate may allow high absolute failures |
| A5 | Shadow MVP = badge + filter only; no auto manual_review | Pattern 5 | Product may want escalation |
| A6 | 50×5 live eval is operator-only, not CI default | Pitfall 3 | CI cost/flake if ignored |
| A7 | `ajv` optional; Zod sufficient for production-path eval | Standard Stack | Evaluator-contract mode deferred |

## Open Questions (RESOLVED)

1. **Migrate production to evaluator output schema in Phase 10?** — **RESOLVED: No.** Keep `ReportAnalysis` for triage persistence and shadow comparison. Map gate metrics to gold labels on production fields. Optional evaluator-schema track for deep policy eval if timeboxed in 10-01.

2. **`backend/evals/` vs `evals/`?** — **RESOLVED:** Use `evals/` at repo root + `src/server/evals/` modules. Update ROADMAP reference during planning.

3. **Shadow storage: new table vs extend `triage_runs`?** — **RESOLVED:** New `triage_shadow_comparisons` table. Avoid invoking `complete_triage_report` for candidate runs.

4. **Auto-route shadow disagreements to `manual_review`?** — **RESOLVED: No for MVP.** Badge + filter + detail panel only. Officer uses existing review workflow voluntarily.

5. **Run full 250-call eval in CI?** — **RESOLVED: No.** CI uses `--mock` deterministic fixtures; `npm run eval:live` + `eval:gate` for human-triggered production gate.

6. **How to test outage report-loss?** — **RESOLVED:** Unit test `submitReport` intake success independent of provider; integration test worker infra failure → `failed`/`manual_review` without blocking intake (extend `service.test.ts`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | eval CLI + worker | ✓ | v25.2.1 | — |
| npm | scripts | ✓ | (project default) | — |
| Vitest | metric unit tests | ✓ | 4.1.10 | — |
| `THIRD_PARTY_API_KEY` + `AI_*` | live eval / shadow candidate | operator-dependent | — | `--mock` mode for CI |
| `SUPABASE_DB_URL` | shadow table migration + SQL contract | operator-dependent | — | Blocked for SQL gate; unit tests still run |
| Phase 8–9 migrations | shadow FK to triage_runs | code present | — | Apply before Phase 10 SQL |
| `tsx` | eval-suite TS execution | ✓ | 4.23.1 | `npm install` |

**Missing dependencies with no fallback:**
- `SUPABASE_DB_URL` — blocks `10_shadow_eval_contract.sql` and shadow persistence integration tests.

**Missing dependencies with fallback:**
- Live AI credentials — `--mock` eval path for CI and local dev without API key.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + node:test legacy |
| Config file | `vitest.config.mts` |
| Quick run command | `npm run test:unit -- src/server/evals/metrics.test.ts` |
| Full suite command | `npm run test` |
| Live eval (operator) | `npm run eval:live && npm run eval:gate` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIAGE-08 | macro-F1 on gold categories | unit | `npm run test:unit -- src/server/evals/metrics.test.ts -t "macroF1"` | ❌ Wave 0 |
| TRIAGE-08 | under-triage / false critical counts | unit | same `-t "underTriage"` | ❌ Wave 0 |
| TRIAGE-08 | EN/VI parity delta computation | unit | same `-t "parity"` | ❌ Wave 0 |
| TRIAGE-08 | threshold gate all-pass logic | unit | `npm run test:unit -- src/server/evals/aggregate.test.ts` | ❌ Wave 0 |
| TRIAGE-08 | grounding via validateAnalysisPolicy | unit | extend `analysis-policy.test.ts` + eval fixtures | ❌ extend |
| TRIAGE-08 | injection cases policy pass | unit | `src/server/evals/metrics.test.ts` with injection fixtures | ❌ Wave 0 |
| TRIAGE-08 | outage report-loss (intake survives) | unit | `npm run test:unit -- src/server/services/report-service.test.ts` | ✅ extend |
| TRIAGE-08 | dataset loader validates JSONL | unit | `src/server/evals/load-dataset.test.ts` | ❌ Wave 0 |
| TRIAGE-08 | shadow compare flags disagreements | unit | `npm run test:unit -- src/server/evals/shadow-compare.test.ts` | ❌ Wave 0 |
| TRIAGE-08 | shadow hook does not mutate reports | unit | extend `src/server/triage/service.test.ts` | ❌ extend |
| TRIAGE-08 | verify-eval-gate exit code | unit/integration | `node scripts/verify-eval-gate.mjs` with fixture results | ❌ Wave 0 |
| TRIAGE-08 | shadow table invariants | SQL contract | `node scripts/run-supabase-sql.mjs -f supabase/tests/10_shadow_eval_contract.sql` | ❌ Wave 0 |
| TRIAGE-08 | officer shadow badge/filter | legacy | `npm run test:legacy -- tests/dashboard-table.test.mjs` | ❌ extend |

### Sampling Rate

- **Per task commit:** `npm run test:unit -- src/server/evals`
- **Per wave merge:** `npm run test`
- **Phase gate:** `npm run test` + SQL contract + operator `npm run eval:live && npm run eval:gate` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `evals/datasets/urban-incidents-v1.jsonl` — 50 EN/VI labelled cases (can start with 10-case stub for dev)
- [ ] `src/server/evals/types.ts`, `load-dataset.ts`, `metrics.ts`, `aggregate.ts` + tests
- [ ] `scripts/eval-suite.mjs` — `--mock` and `--live` modes
- [ ] `scripts/verify-eval-gate.mjs`
- [ ] `supabase/migrations/20260722140001_triage_shadow.sql`
- [ ] `supabase/tests/10_shadow_eval_contract.sql`
- [ ] `src/server/evals/shadow-compare.ts` + worker hook in `service.ts`
- [ ] `.env.example` keys: `TRIAGE_SHADOW_MODE`, `AI_MODEL_CANDIDATE`, `EVAL_MANIFEST_PATH`
- [ ] Dashboard badge/filter for shadow disagreement

## Suggested Wave Breakdown (2 Plans)

### Plan 10-01 — Eval Suite (vertical slice)

| Wave | Deliverable |
|------|-------------|
| W0 | `evals/` scaffold, dataset schema, `metrics.ts` + Vitest, JSONL loader |
| W1 | `scripts/eval-suite.mjs` `--mock` mode, aggregate + threshold check vs evaluator JSON |
| W2 | `--live` mode (privacy gate), injection + grounding case packs, results JSON writer |
| W3 | `verify-eval-gate.mjs`, pinned manifest, outage intake test, EN/VI parity report |

### Plan 10-02 — Shadow Rollout (vertical slice)

| Wave | Deliverable |
|------|-------------|
| W0 | Shadow migration + SQL contract; `shadow-compare.ts` pure diff logic |
| W1 | `TRIAGE_SHADOW_MODE` env + candidate config overlay; worker hook (non-mutating) |
| W2 | Comparison report CLI (`scripts/shadow-report.mjs` or eval-suite subcommand) |
| W3 | Officer badge/filter + detail panel; cutover runbook in plan verification steps |

**Dependency:** 10-02 should start after 10-01 W0 metrics exist (shared `shadow-compare.ts`), but shadow DB/worker can parallel once types are agreed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no new citizen auth | — |
| V3 Session Management | no change | Existing cookies |
| V4 Access Control | yes | Shadow rows service-role only; officer reads via existing RLS-backed loaders |
| V5 Input Validation | yes | Zod on dataset/manifest; eval cases treated as untrusted report text |
| V6 Cryptography | yes (existing) | Never log API keys; reuse `redactSensitiveText` in audit paths |

### Known Threat Patterns for Eval + Shadow

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Eval dataset prompt injection exfiltrating keys | Tampering / Disclosure | Cases run server-side only; never `eval` user input; redact raw output in artifacts |
| Shadow candidate config pointing to attacker endpoint | Tampering | `normalizeAiBaseUrl` HTTPS rule; manifest human review before cutover |
| Officer sees other tenants' shadow data | Information disclosure | RLS unchanged; shadow table service-role write, officer read via report join only |
| Gate bypass via forged results JSON | Elevation | `verify-eval-gate.mjs` validates schema + manifest hash; signed gate artifact optional checkpoint |
| Live eval sends PII to third-party AI | Disclosure | Privacy approval flag (mirror `smoke-ai.mjs`); synthetic fixtures preferred |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found. Enforce via `AGENTS.md`:

- GSD workflow: `/gsd-execute-phase` or `/gsd-quick` before repo edits.
- Node.js 22 + Next.js 16 only; no Python/Docker/new cloud services.
- AI advisory-only; officers retain decision authority.
- Access tokens hashed at rest.
- Bilingual EN/VI for any new citizen-facing copy (shadow UX is officer-only).
- Loopback-first laptop runtime.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md` — Phase 10 goal, 2 plans, TRIAGE-08
- `.planning/REQUIREMENTS.md` — TRIAGE-08 definition
- `.planning/notes/async-triage-architecture.md` — eval suite metric list (lines 170–182)
- `prompt/citymind_ai_triage_structured_output_evaluator.json` — thresholds, 50×5, policy evaluator
- `src/server/triage/service.ts` — shadow hook insertion after production complete
- `src/server/triage/audit.ts`, `supabase/migrations/20260722120002_async_triage_audit.sql` — audit pattern
- `src/server/routing/policy.ts` — `ROUTING_POLICY_VERSION`
- `src/server/validation/analysis-policy.ts` — grounding/rubric proxy
- `src/server/domain/report-analysis.ts` — production schema
- `scripts/triage-worker.mjs`, `scripts/smoke-ai.mjs`, `scripts/load-project-env.mjs` — CLI patterns
- `package.json`, `vitest.config.mts` — test infrastructure
- `.planning/phases/08-async-triage-platform-refactor/08-RESEARCH.md` — schema deferral Pitfall 6
- `.planning/phases/09-self-help-vs-government-routing/09-RESEARCH.md` — RESEARCH template + validation architecture

### Secondary (MEDIUM confidence)
- `.planning/phases/08-async-triage-platform-refactor/08-04-SUMMARY.md` — audit ready for Phase 10
- `src/server/config/env.ts` — env extension point for shadow/candidate keys

### Tertiary (LOW confidence)
- EN/VI parity epsilon 0.05 — [ASSUMED] pending discuss-phase lock

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — extends existing Node/Vitest/triage modules; optional ajv only
- Architecture: HIGH — hook points and schema boundary verified in live code
- Pitfalls: HIGH — schema schism and shadow mutation risks documented in Phase 8 research

**Research date:** 2026-07-22
**Valid until:** 2026-08-21 (30 days)

## RESEARCH COMPLETE
