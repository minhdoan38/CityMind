# Phase 10: Shadow Rollout & Production Evaluation - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 22 new/modified files
**Analogs found:** 19 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/evals/run-triage-eval.mjs` | utility (CLI) | batch + transform | `scripts/smoke-ai.mjs` | exact |
| `scripts/evals/lib/metrics.mjs` | utility | transform | `src/server/validation/analysis-policy.ts` | role-match |
| `scripts/evals/lib/gate.mjs` | utility | transform | `scripts/verify-gate-artifacts.mjs` | exact |
| `scripts/evals/lib/load-eval-config.mjs` | utility | transform | `scripts/load-project-env.mjs` | exact |
| `evals/dataset/triage-labeled-en-vi.json` | config | batch | `tests/contracts/golden-contracts.test.ts` fixtures | role-match |
| `evals/reports/latest-gate.json` | config | batch | `migration-manifests/*-gate.json` | role-match |
| `prompt/citymind_ai_triage_structured_output_evaluator.json` | config | transform | itself | exact |
| `src/server/evals/metrics.ts` | utility | transform | `src/server/validation/analysis-policy.ts` | exact |
| `src/server/evals/metrics.test.ts` | test | transform | `src/server/validation/analysis-policy.test.ts` | exact |
| `src/server/triage/config.ts` | config | — | itself + `src/server/routing/policy.ts` semver | exact |
| `src/server/triage/service.ts` | service | event-driven + transform | itself (`TriageServiceDeps` injection) | exact |
| `src/server/triage/audit.ts` | service | CRUD | itself (`recordTriageAttempt` RPC) | exact |
| `src/server/config/env.ts` | config | — | itself (`ServerEnvSchema` Zod) | exact |
| `src/server/validation/analysis-policy.ts` | utility | transform | itself | exact |
| `src/server/domain/report-analysis.ts` | model | transform | itself (`ReportAnalysisSchema`) | exact |
| `.env.example` | config | — | itself (`AI_*`, `STATUS_RATE_LIMIT_*`) | exact |
| `package.json` | config | — | itself (`triage:worker`, `smoke:production`) | exact |
| `supabase/migrations/*_shadow_triage_columns.sql` | migration | CRUD | `20260722120002_async_triage_audit.sql` | exact |
| `supabase/tests/10_shadow_eval_contract.sql` | test | batch | `supabase/tests/08_async_triage_contract.sql` | exact |
| `src/server/triage/service.test.ts` | test | event-driven | itself (mocked deps) | exact |
| `src/server/triage/audit.test.ts` | test | CRUD | itself | exact |
| `tests/evals-gate.test.ts` | test | batch | `tests/google-exit-audit.test.ts` | role-match |

**Path note:** ROADMAP references `backend/evals/` from pre-Phase-7 layout; repo is Next.js-only at root with no `backend/` directory. Place harness under `scripts/evals/` + `evals/dataset/` (mirror `scripts/` + `tests/contracts/` split).

## Pattern Assignments

### `scripts/evals/run-triage-eval.mjs` — eval harness CLI (10-01)

**Analog:** `scripts/smoke-ai.mjs`

**Shebang + env load** (lines 1-10, 70-96, 307-321):

```javascript
#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  // ... parse KEY=VALUE, skip comments, do not override process.env
}
```

**Missing-config gate** (lines 108-120, 312-321):

```javascript
function missingConfig() {
  const missing = [];
  if (!process.env.AI_BASE_URL?.trim()) missing.push("AI_BASE_URL");
  if (!process.env.THIRD_PARTY_API_KEY?.trim()) missing.push("THIRD_PARTY_API_KEY");
  if (!process.env.AI_MODEL?.trim()) missing.push("AI_MODEL");
  return missing;
}

if (missing.length > 0) {
  console.error(`EVAL_BLOCKED: missing required configuration: ${missing.join(", ")}`);
  process.exit(2);
}
```

**EN/VI case loop + lineage** (lines 339-411):

```javascript
const cases = [
  { id: "en-text", description: "Synthetic EN incident: ..." },
  { id: "vi-text", description: "Bao cao gia lap: ..." },
];

for (const testCase of cases) {
  const result = await analyzeCase(env, testCase);
  results.push({
    id: testCase.id,
    category: result.analysis.category,
    responseModel: result.lineage.responseModel,
    latencyMs: result.lineage.latencyMs,
  });
}

console.log("EVAL_OK");
```

**Extend for Phase 10:**
- Load labeled dataset from `evals/dataset/triage-labeled-en-vi.json` (not hardcoded smoke cases).
- Load thresholds from `prompt/citymind_ai_triage_structured_output_evaluator.json` (`evaluation_run.aggregate_metrics`, `thresholds`, `pass_criteria`).
- Support `--baseline` / `--candidate` model env overrides for shadow comparison.
- Write `evals/reports/latest-gate.json` with `status: "PASS" | "FAIL"` (mirror gate manifest shape).
- Exit codes: `0` pass, `1` metric fail, `2` blocked/missing config (same as smoke-ai).

Use `loadProjectEnv` from `scripts/load-project-env.mjs` instead of duplicating env parsing.

---

### `scripts/evals/lib/metrics.mjs` + `src/server/evals/metrics.ts` — metric calculators (10-01)

**Analog:** `src/server/validation/analysis-policy.ts` (pure functions) + evaluator JSON `evaluation_run` section

**Pure function + violation code pattern** (analysis-policy.ts lines 73-75, 77-85):

```typescript
function violation(code: string, message: string): PolicyViolation {
  return { code, message };
}

export function validateAnalysisPolicy(
  analysis: ReportAnalysis,
  options: { description?: string } = {},
): PolicyResult {
  const violations: PolicyViolation[] = [];
  // ordered guard clauses
  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}
```

**Metric functions to implement** (map evaluator JSON lines 352-394):

```typescript
export type LabeledCase = {
  id: string;
  locale: "en" | "vi";
  description: string;
  labels: {
    category: string;
    severity: number;
    priority: string;
    is_critical?: boolean;
  };
};

export type EvalPrediction = {
  caseId: string;
  analysis: ReportAnalysis | null;
  disposition: string;
  errorType?: string;
};

export function macroF1(predictions: EvalPrediction[], labels: LabeledCase[]): number { /* ... */ }
export function severityAgreement(predictions: EvalPrediction[], labels: LabeledCase[]): number { /* ... */ }
export function underTriageRate(predictions: EvalPrediction[], labels: LabeledCase[]): number { /* ... */ }
export function groundingPassRate(predictions: EvalPrediction[], labels: LabeledCase[]): number { /* ... */ }
export function localeParityDelta(enMetrics: MetricBundle, viMetrics: MetricBundle): number { /* ... */ }
```

**Grounding checks:** Reuse `validateAnalysisPolicy` + `hasUnsupportedEvidenceClaim` logic from analysis-policy (lines 55-71). For evaluator-schema fields (`observed_facts`, etc.), add adapter `toReportAnalysis(evaluatorOutput)` only in eval layer — do **not** change production `ReportAnalysisSchema` without explicit cutover plan (Phase 8 Pitfall 6).

**Under-triage:** Label `is_critical: true` cases where predicted `severity < 5` or `priority !== 'critical'` when label expects critical — mirror `missed_critical_count` in evaluator JSON (line 370).

---

### `scripts/evals/lib/gate.mjs` — threshold gate before cutover (10-01, 10-02)

**Analog:** `scripts/verify-gate-artifacts.mjs` + evaluator `thresholds` / `pass_criteria`

**Gate verification pattern** (verify-gate-artifacts.mjs lines 24-27, 48-84):

```javascript
function fail(message) {
  console.error(`verify-gate-artifacts: ${message}`);
  process.exit(1);
}

if (gate.status !== "PASS") fail(`gate status is ${gate.status ?? "unknown"}`);
console.log(`verify-gate-artifacts: PASS (${args.gateName})`);
```

**Eval gate manifest shape:**

```json
{
  "gate": "triage-shadow-cutover",
  "status": "PASS",
  "baseline": { "model": "...", "prompt_version": "phase8-mvp-v1", "provider": "..." },
  "candidate": { "model": "...", "prompt_version": "...", "provider": "..." },
  "metrics": {
    "macro_f1": 0.92,
    "severity_agreement": 0.91,
    "under_triage_rate": 0.0,
    "grounding_pass_rate": 0.97,
    "en_vi_parity_delta": 0.02,
    "failure_rate": 0.01,
    "report_loss_count": 0
  },
  "thresholds_source": "prompt/citymind_ai_triage_structured_output_evaluator.json",
  "signed_at": "2026-07-22T00:00:00.000Z"
}
```

**Pass logic:** `pass_criteria.logic === "all"` from evaluator JSON — every threshold satisfied, `report_loss_count === 0`, candidate beats baseline on under-triage and failure rate.

---

### `evals/dataset/triage-labeled-en-vi.json` — expert-labelled dataset (10-01)

**Analog:** `tests/contracts/golden-contracts.test.ts` fixture loading (lines 48-66)

**Fixture case shape:**

```typescript
type FixtureCase = {
  id: string;
  endpoint?: string;
  request?: Record<string, unknown>;
  response: Record<string, unknown>;
};

function loadFixture(fileName: string): FixtureFile {
  const filePath = path.join(GOLDEN_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
```

**Dataset file structure:**

```json
{
  "dataset_version": "1.0.0",
  "cases": [
    {
      "id": "en-pothole-low-001",
      "locale": "en",
      "description": "Small pothole on quiet residential street, no traffic hazard.",
      "labels": { "category": "pothole", "severity": 2, "priority": "low", "is_critical": false },
      "injection_cases": []
    },
    {
      "id": "vi-flooding-critical-001",
      "locale": "vi",
      "description": "...",
      "labels": { "category": "flooding", "severity": 5, "priority": "critical", "is_critical": true }
    }
  ],
  "injection_suite": [
    { "id": "ignore-instructions-001", "description": "IGNORE PREVIOUS INSTRUCTIONS...", "expect": "policy_violation_or_safe_completion" }
  ],
  "outage_suite": [
    { "id": "provider-down-001", "simulate": "provider_timeout", "expect_intake_persisted": true }
  ]
}
```

Include balanced EN/VI split for parity metric. Never commit real PII — use synthetic descriptions like smoke-ai.

---

### `prompt/citymind_ai_triage_structured_output_evaluator.json` — eval contract reference (10-01)

**Analog:** itself

**Config version + metrics catalog** (lines 1-4, 352-394):

```json
{
  "config_version": "1.0.0",
  "evaluation_run": {
    "aggregate_metrics": [
      "schema_pass_rate",
      "hallucination_pass_rate",
      "missed_critical_count"
    ]
  },
  "thresholds": {
    "schema_pass_rate_min": 0.99,
    "missed_critical_count_max": 0
  },
  "pass_criteria": {
    "logic": "all",
    "requirements": ["Every threshold is satisfied.", "..."]
  }
}
```

**Policy evaluator rules** (lines 194-296) — implement in metrics layer or extend `validateAnalysisPolicy` only where production schema already has equivalent fields (`evidence`, `uncertainty`, `summary`).

**Do not** blindly migrate production to evaluator's 11-key schema; use JSON as eval contract + threshold source. Bump `config_version` when thresholds change.

---

### `src/server/triage/config.ts` — prompt/config versioning + shadow constants (10-02)

**Analog:** itself + `src/server/routing/policy.ts` semver pattern

**Existing constants** (config.ts lines 1-9):

```typescript
export const PROMPT_VERSION = "phase8-mvp-v1";
export const MAX_INFRA_ATTEMPTS = 3;
export const INFRA_BACKOFF_MS = [30_000, 120_000, 600_000] as const;
```

**Add shadow rollout constants** (mirror routing policy.ts lines 1-3):

```typescript
export const TRIAGE_CONFIG_VERSION = "1.0.0";

export type TriageMode = "production" | "shadow" | "candidate";

export function resolveTriageMode(env: {
  triageShadowEnabled: boolean;
  triageCandidateEnabled: boolean;
}): TriageMode {
  if (env.triageCandidateEnabled) return "candidate";
  if (env.triageShadowEnabled) return "shadow";
  return "production";
}
```

Pin `PROMPT_VERSION` on every `triage_runs` row (audit.ts line 32) — shadow runs get separate `run_kind` column (migration below).

---

### `src/server/triage/service.ts` — shadow dual-run hook (10-02)

**Analog:** itself — `TriageServiceDeps` injection + terminal paths

**Deps injection pattern** (service.ts lines 39-55, 243-246):

```typescript
export type TriageServiceDeps = {
  client: SupabaseClient;
  analyzeStructured?: (...) => Promise<StructuredAnalysisResult>;
  startTriageRun?: typeof startTriageRun;
  recordTriageAttempt?: typeof recordTriageAttempt;
  finishTriageRun?: typeof finishTriageRun;
  applyRoutingForReport?: typeof applyRoutingForReport;
};

export async function runTriageForReport(
  reportId: string,
  deps: TriageServiceDeps = { client: getAdminClient() },
): Promise<TriageRunResult> {
```

**Shadow hook insertion** (after production path completes, lines 333-335):

```typescript
await finishRun(deps.client, runId, "completed");
await applyTerminalRouting(deps, reportId, "completed", structured.analysis);
// INSERT when TRIAGE_SHADOW_ENABLED:
// await runShadowTriageComparison(deps, reportId, row, structured);
return { reportId, disposition: "completed" };
```

**Rules:**
- Production disposition always from primary `analyzeStructured` call — shadow never changes `reports.triage_status` (TRIAGE-08).
- Shadow uses `AI_MODEL_CANDIDATE` / `AI_BASE_URL_CANDIDATE` env; baseline uses current `AI_MODEL`.
- Compare category/severity/priority; persist diff to `triage_runs.run_kind = 'shadow'` + `shadow_baseline_run_id` FK.
- On provider outage, production path already returns `failed`/`retry` without blocking intake — verify via outage suite (report-service intake is separate).

---

### `src/server/triage/audit.ts` — shadow run persistence (10-02)

**Analog:** itself (`startTriageRun`, `recordTriageAttempt`)

**Start run** (lines 24-42):

```typescript
export async function startTriageRun(
  client: SupabaseClient,
  reportId: string,
): Promise<string> {
  const { data, error } = await client
    .from("triage_runs")
    .insert({
      report_id: reportId,
      prompt_version: PROMPT_VERSION,
    })
    .select("run_id")
    .single();
  // ...
}
```

**Extend for shadow:**

```typescript
export async function startShadowTriageRun(
  client: SupabaseClient,
  reportId: string,
  options: { baselineRunId: string; candidateModel: string; candidatePromptVersion: string },
): Promise<string> {
  const { data, error } = await client
    .from("triage_runs")
    .insert({
      report_id: reportId,
      prompt_version: options.candidatePromptVersion,
      run_kind: "shadow",
      baseline_run_id: options.baselineRunId,
      candidate_model: options.candidateModel,
    })
    .select("run_id")
    .single();
  // ...
}
```

**Redaction before persist** (lines 48-49):

```typescript
const env = getServerEnv();
const redactedOutput = redactSensitiveText(input.rawOutput, env);
```

Apply same redaction to shadow attempts. Never log API keys (evaluator `audit_logging.never_log`, lines 423-426).

---

### `src/server/config/env.ts` + `.env.example` — feature flags (10-02)

**Analog:** `src/server/config/env.ts` (`AI_SUPPORTS_VISION` boolean coercion, lines 35-48)

**Zod env extension:**

```typescript
TRIAGE_SHADOW_ENABLED: z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return false;
    if (typeof value === "boolean") return value;
    return value.trim().toLowerCase() === "true" || value.trim() === "1";
  }),
AI_MODEL_CANDIDATE: z.string().optional(),
AI_BASE_URL_CANDIDATE: z.string().optional().transform(/* same normalizeAiBaseUrl */),
TRIAGE_CUTOVER_REQUIRES_EVAL_PASS: z
  .union([z.boolean(), z.string()])
  .optional()
  .transform(/* same bool coercion */),
```

**.env.example pattern** (lines 9-18):

```bash
AI_BASE_URL=https://your-ai-endpoint.example/v1
AI_MODEL=your-configured-model
# Shadow rollout (Phase 10) — off by default
TRIAGE_SHADOW_ENABLED=false
AI_MODEL_CANDIDATE=
AI_BASE_URL_CANDIDATE=
TRIAGE_CUTOVER_REQUIRES_EVAL_PASS=true
```

Document server-only (no `NEXT_PUBLIC_` prefix). Default shadow off for laptop loopback.

---

### `src/server/validation/analysis-policy.ts` — eval-aligned policy checks (10-01)

**Analog:** itself

**Matrix test pattern** (analysis-policy.test.ts lines 6-18, 64-72):

```typescript
function validAnalysis(overrides: Partial<ReportAnalysis> = {}): ReportAnalysis {
  return { category: "pothole", severity: 4, confidence: 0.82, /* ... */, ...overrides };
}

it("rejects critical priority without severity 5", () => {
  const result = validateAnalysisPolicy(validAnalysis({ priority: "critical", severity: 4 }));
  expect(result.ok).toBe(false);
});
```

Map evaluator `cross_field_rules` (JSON lines 329-349) to existing violation codes: `critical_requires_severity_5`, `severity_5_requires_immediate_danger_evidence`. Eval metrics count `policy_violation` codes — keep codes stable for `triage_attempts.validation_errors` JSONB audit.

---

### `src/server/domain/report-analysis.ts` — production schema (10-01, optional adapter)

**Analog:** itself

**Zod strict schema** (lines 3-29):

```typescript
export const CategorySchema = z.enum([
  "pothole", "flooding", "waste", "streetlight", "graffiti", "obstruction", "other",
]);

export const ReportAnalysisSchema = z.object({ /* ... */ }).strict();
export type ReportAnalysis = z.infer<typeof ReportAnalysisSchema>;
```

Eval harness may parse evaluator 11-key output separately; adapter maps to `ReportAnalysis` for metric comparison against production path. Category enum gap (evaluator has `traffic_signal`, `utility_hazard`, `structural_damage`) — map to `other` in adapter or document in dataset labels only.

---

### `package.json` — npm scripts (10-01)

**Analog:** itself (lines 5-15)

```json
"scripts": {
  "test:unit": "vitest run",
  "test:legacy": "node --test tests/*.test.mjs",
  "test": "npm run test:unit && npm run test:legacy",
  "triage:worker": "node scripts/triage-worker.mjs",
  "smoke:production": "node scripts/smoke-production.mjs"
}
```

**Add:**

```json
"eval:triage": "node scripts/evals/run-triage-eval.mjs",
"eval:triage:gate": "node scripts/evals/run-triage-eval.mjs --write-gate --require-pass",
"eval:gate:verify": "node scripts/evals/lib/gate.mjs --gate triage-shadow-cutover --require-pass"
```

Mirror `triage:worker` wrapper pattern: load env via `load-project-env.mjs`, fail fast on missing keys.

---

### `supabase/migrations/*_shadow_triage_columns.sql` — shadow audit columns (10-02)

**Analog:** `supabase/migrations/20260722120002_async_triage_audit.sql` (lines 3-10) + `20260722130001_routing_columns.sql` (lines 3-20)

**Additive columns on triage_runs:**

```sql
ALTER TABLE public.triage_runs
    ADD COLUMN IF NOT EXISTS run_kind TEXT NOT NULL DEFAULT 'production',
    ADD COLUMN IF NOT EXISTS baseline_run_id UUID REFERENCES public.triage_runs(run_id),
    ADD COLUMN IF NOT EXISTS candidate_model TEXT,
    ADD COLUMN IF NOT EXISTS comparison_summary JSONB;

ALTER TABLE public.triage_runs
    DROP CONSTRAINT IF EXISTS triage_runs_run_kind_chk;

ALTER TABLE public.triage_runs
    ADD CONSTRAINT triage_runs_run_kind_chk
    CHECK (run_kind IN ('production', 'shadow'));

CREATE INDEX IF NOT EXISTS triage_runs_run_kind_idx
    ON public.triage_runs (run_kind)
    WHERE run_kind = 'shadow';
```

**Grant pattern** — mirror audit migration lines 28-34, 137-142: RLS enabled, `REVOKE ALL FROM PUBLIC`, `GRANT` to `service_role` only.

---

### `supabase/tests/10_shadow_eval_contract.sql` — SQL contract (10-02)

**Analog:** `supabase/tests/08_async_triage_contract.sql` (lines 1-46)

```sql
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION _test_assert(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF NOT condition THEN
        RAISE EXCEPTION 'ASSERTION FAILED: %', message;
    END IF;
END;
$$;

DO $$
DECLARE
    v_report_id text := 'test-shadow-' || gen_random_uuid()::text;
BEGIN
    -- seed report + production triage_run
    -- insert shadow run with run_kind='shadow', baseline_run_id set
    -- assert production reports.triage_status unchanged by shadow insert
    -- assert comparison_summary JSONB populated
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

DROP FUNCTION IF EXISTS _test_assert(boolean, text);
```

Run via: `node scripts/run-supabase-sql.mjs supabase/tests/10_shadow_eval_contract.sql`

---

### Test extensions

#### `src/server/evals/metrics.test.ts`

**Analog:** `src/server/validation/analysis-policy.test.ts`

Pure-function matrix: macro-F1 on synthetic predictions, under-triage on `is_critical` labels, EN/VI parity delta with identical predictions.

#### `src/server/triage/service.test.ts`

**Analog:** itself (lines 43-50, 77-80)

```typescript
const deps = {
  ...createDeps(client),
  analyzeStructured,
  applyRoutingForReport: vi.fn(async () => undefined),
};

expect(deps.applyRoutingForReport).toHaveBeenCalledWith(
  deps.client, "report-1",
  expect.objectContaining({ disposition: "completed", analysis: validAnalysis }),
);
```

Add: when `TRIAGE_SHADOW_ENABLED`, assert shadow `startTriageRun` called but `reports` update only reflects production disposition; mock second `analyzeStructured` for candidate model.

#### `src/server/triage/audit.test.ts`

**Analog:** itself (lines 17-34)

Assert `startShadowTriageRun` inserts `run_kind: "shadow"`, `baseline_run_id`, `candidate_model`.

#### `tests/evals-gate.test.ts`

**Analog:** `tests/google-exit-audit.test.ts` (imports from `scripts/lib/`)

Test `evaluateGateStatus(metrics, thresholds)` without live AI calls.

#### Outage report-loss test

**Analog:** `src/server/services/report-service.test.ts` (`submitReport`, lines 219-245)

```typescript
it("returns intake response without calling provider.analyze", async () => {
  const result = await submitReport(form, { client: client as never });
  expect(result.intake_status).toBe("received");
  expect(result.triage_status).toBe("pending");
});
```

Eval outage suite: simulate `AnalysisProviderError` on triage worker; assert report row still exists with `triage_status` in `pending`/`failed`/`retry` — never deleted.

---

## Shared Patterns

### Phase 8 triage audit lineage (TRIAGE-06)

**Source:** `src/server/triage/audit.ts` + `complete_triage_report` RPC
**Apply to:** production and shadow runs

```typescript
await client.rpc("complete_triage_report", {
  p_report_id: input.reportId,
  p_model: input.model,
  p_prompt_version: PROMPT_VERSION,
  p_raw_output: redactedOutput,
  p_validation_errors: input.validationErrors,
  p_disposition: input.disposition,
});
```

### Phase 9 routing reproducibility (D-19)

**Source:** `src/server/routing/apply-routing.ts` (lines 33-40)
**Apply to:** eval reports — include `routing_policy_version` in gate manifest for end-to-end lineage

```typescript
routing_policy_version: decision.policyVersion,
routing_reason: decision.reasonCode,
```

### Dependency injection for testability

**Source:** `src/server/triage/service.ts` (`TriageServiceDeps`)
**Apply to:** shadow runner, eval harness calling `runTriageForReport` with mocked `analyzeStructured`

### Env loading for scripts

**Source:** `scripts/load-project-env.mjs`
**Apply to:** all `scripts/evals/*.mjs`

```javascript
import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "../load-project-env.mjs";
const env = loadProjectEnv();
const missing = requireEnvKeys(env, ["AI_BASE_URL", "AI_MODEL", "THIRD_PARTY_API_KEY"]);
```

### SQL gate execution

**Source:** `scripts/run-supabase-sql.mjs`
**Apply to:** `10_shadow_eval_contract.sql`

### Redaction / privacy

**Source:** `src/server/ai/openai-compatible.ts` (`redactSensitiveText`)
**Apply to:** shadow raw output persistence, eval audit logs

### Intake survives AI failure (outage report-loss)

**Source:** `src/server/services/report-service.ts` — `submitReport` persists via `create_intake_report_with_access_token` before worker runs
**Apply to:** outage eval suite — triage failure must not delete or block intake row

### Bilingual eval cases

**Source:** `scripts/smoke-ai.mjs` EN/VI cases (lines 339-358)
**Apply to:** dataset `locale` field + `localeParityDelta` metric

### Threshold gate before cutover

**Source:** `scripts/verify-gate-artifacts.mjs` + evaluator `pass_criteria`
**Apply to:** `TRIAGE_CUTOVER_REQUIRES_EVAL_PASS` — worker refuses candidate model until `evals/reports/latest-gate.json` status PASS

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `evals/dataset/triage-labeled-en-vi.json` | config | batch | No expert-labelled triage dataset exists; golden fixtures are API contract shapes, not classification labels |
| Evaluator 11-key → `ReportAnalysis` adapter | utility | transform | Schema mismatch is documented (Phase 8 Pitfall 6); planner must design thin mapping layer |
| Shadow comparison diff store | service | CRUD | No dual-model comparison in codebase; compose from audit tables + new `comparison_summary` JSONB |
| Officer review workflow for shadow disagreements | route/UI | request-response | Phase 10 ROADMAP mentions officer review; no shadow-review UI exists — defer UI or extend dashboard badges only |

---

## Metadata

**Analog search scope:** `scripts/` (smoke-ai, verify-gate-artifacts, load-project-env, triage-worker, run-supabase-sql), `src/server/triage/`, `src/server/validation/`, `src/server/config/`, `src/server/ai/`, `src/server/routing/`, `src/server/services/report-service.ts`, `prompt/`, `evals/` (none yet), `tests/contracts/`, `tests/migration/`, `supabase/migrations/`, `supabase/tests/`, `.planning/phases/09-self-help-vs-government-routing/09-PATTERNS.md`
**Files scanned:** ~180 TS/TSX + 20 SQL + 12 scripts + evaluator JSON
**Pattern extraction date:** 2026-07-22
