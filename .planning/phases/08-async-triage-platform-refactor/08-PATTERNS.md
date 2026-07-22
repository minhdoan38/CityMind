# Phase 8: Async Triage Platform Refactor - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 32 new/modified files
**Analogs found:** 28 / 32

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/public/reports/route.ts` | route | request-response | `src/app/api/public/reports/analyze/route.ts` + `report-service.ts` | exact |
| `src/app/api/v1/reports/route.ts` | route | request-response | `src/app/api/v1/reports/analyze/route.ts` | exact |
| `src/app/api/public/reports/analyze/route.ts` | route | request-response | `src/server/http/errors.ts` (410 pattern — new) | partial |
| `src/app/api/v1/reports/analyze/route.ts` | route | request-response | same as public analyze 410 | partial |
| `src/server/services/report-service.ts` | service | CRUD + file-I/O | itself (`analyzeReport` → `submitReport`) | exact |
| `src/server/triage/worker.ts` | service | event-driven (poll) | `scripts/smoke-ai.mjs` (long-lived script loop) | role-match |
| `src/server/triage/claim.ts` | utility | batch (SQL) | `src/server/repositories/reports.ts` (`client.rpc`) | role-match |
| `src/server/triage/service.ts` | service | transform + request-response | `report-service.ts` + `openai-compatible.ts` | exact |
| `src/server/triage/audit.ts` | service | CRUD | `update_report_with_status_event` RPC pattern | role-match |
| `src/server/triage/config.ts` | config | — | `src/server/ai/openai-compatible.ts` (`SYSTEM_INSTRUCTION`) | partial |
| `src/server/triage/disposition.ts` | utility | transform | `src/server/validation/analysis-policy.ts` | role-match |
| `src/server/validation/analysis-policy.ts` | utility | transform | itself (extend) | exact |
| `scripts/triage-worker.mjs` | config/script | event-driven | `scripts/run-supabase-sql.mjs` + `smoke-ai.mjs` | role-match |
| `scripts/register-citymind-task.ps1` | config | — | itself (second task) | exact |
| `supabase/migrations/08_*_async_triage.sql` | migration | CRUD + batch | `20260721130004_evidence_path_additive.sql` + `20260721130003_officer_operations.sql` | exact |
| `supabase/tests/08_async_triage_contract.sql` | test | batch | `supabase/tests/07_next_backend_contract.sql` | exact |
| `src/server/repositories/reports.ts` | repository | CRUD | itself (`listRecentReports`, `getCitizenStatus`) | exact |
| `src/server/services/citizen-status.ts` | service | request-response | itself + `repositories/reports.ts` | exact |
| `src/components/ReportForm.tsx` | component | request-response | itself (endpoint retarget) | exact |
| `src/app/[locale]/status/page.tsx` | component | request-response | itself (conditional AI reveal) | exact |
| `src/app/[locale]/report/success/page.tsx` | component | — | itself (already token-only) | exact |
| `src/components/reports/ReportsTable.tsx` | component | CRUD (read) | itself (`statusVariant`, Badge) | exact |
| `src/components/reports/ReportsFilters.tsx` | component | — | itself (`STATUSES` select pattern) | exact |
| `src/components/reports/types.ts` | model | — | itself (`ReportRow`, `FILTER_PARAM_KEYS`) | exact |
| `src/server/officer/filters.ts` | utility | transform | itself (`VALID_STATUSES`, `parseReportFilters`) | exact |
| `src/server/services/officer-dashboard.ts` | service | CRUD | itself (`toReportRow`, `loadDashboardBundle`) | exact |
| `src/app/dashboard/reports/[reportId]/page.tsx` | component | CRUD (read) | itself (section order) | exact |
| `src/server/services/report-service.test.ts` | test | — | itself | exact |
| `src/server/services/citizen-status.test.ts` | test | — | itself | exact |
| `src/server/repositories/reports.test.ts` | test | — | itself | exact |
| `src/server/validation/analysis-policy.test.ts` | test | — | itself | exact |
| `src/server/triage/*.test.ts` | test | — | `report-service.test.ts` + `analysis-policy.test.ts` | role-match |
| `tests/report-form.test.mjs` | test | — | itself | exact |
| `tests/contracts/golden-contracts.test.ts` | test | — | itself + new `intake.json` fixture | role-match |
| `package.json` | config | — | existing `test` / `dev` scripts | partial |

## Pattern Assignments

### `src/server/services/report-service.ts` — intake split (`submitReport`)

**Analog:** `src/server/services/report-service.ts` (current sync path)

**Imports pattern** (lines 1-33):

```typescript
import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "@/lib/supabase/admin";
import { HttpError, imageTooLarge, jsonErrorResponse, unsupportedImageType } from "@/server/http/errors";
import { createReportWithAccessToken } from "@/server/repositories/reports";
import { issueAccessToken } from "@/server/security/access-tokens";
import { enforceReportRateLimit, type RateLimitRequest } from "@/server/security/rate-limit";
import { deleteEvidenceByUri, EvidenceServiceError, uploadEvidence, validateEvidenceBytes, formatEvidencePath, parseSupabaseEvidenceUri } from "./evidence-service";
```

**Core intake pattern — copy validation + evidence, skip AI** (lines 80-156, refactor):

```typescript
export async function analyzeReport(formData: FormData, deps: ReportServiceDeps): Promise<AnalyzeResponse> {
  // ... parse description, coords, image (lines 84-117) — REUSE UNCHANGED for submitReport
  const reportId = randomUUID();
  let evidenceUri: string | null = null;

  try {
    if (imageBytes && imageMime) {
      evidenceUri = await uploadEvidence({ client: deps.client, reportId, bytes: imageBytes, ... });
    }

    // REMOVE: const analysisResult = await deps.provider.analyze(...)
    const { plaintext, tokenHash, expiresAt } = issueAccessToken();
    await createIntakeReportWithAccessToken(deps.client, {
      reportId,
      tokenHash,
      tokenExpiresAt: expiresAt,
      description: description.trim() || null,
      latitude,
      longitude,
      evidencePath: evidenceUri ? formatEvidencePath(...) : null,
      triageStatus: "pending",
    });

    return {
      report_id: reportId,
      access_token: plaintext,
      intake_status: "received",
      triage_status: "pending",
    };
  } catch (error) {
    if (evidenceUri) {
      try { await deleteEvidenceByUri({ client: deps.client, uri: evidenceUri }); } catch { /* best-effort */ }
    }
    // ... same HttpError / EvidenceServiceError mapping (lines 173-189)
  }
}
```

**Request handler pattern — rate limit + FormData + json** (lines 193-244):

```typescript
export async function handleAnalyzeReportRequest(request: Request, options = {}): Promise<Response> {
  const rateLimit = enforceReportRateLimit(options.rateLimitRequest ?? { headers: request.headers });
  if (rateLimit) {
    return Response.json({ detail: rateLimit.detail }, { status: rateLimit.status, headers: { "Retry-After": rateLimit.retryAfter } });
  }
  let formData: FormData;
  try { formData = await request.formData(); } catch {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }
  try {
    const payload = await submitReport(formData, { client: options.client ?? getAdminClient() });
    return Response.json(payload, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    if (error instanceof HttpError) return jsonErrorResponse(error);
    return jsonErrorResponse(new HttpError(502, "Report submission failed"));
  }
}
```

**Error handling:** Intake must never call AI; persistence failures use same compensation delete + `HttpError` mapping. Do not use `reportAnalysisFailed()` on intake — use submission-specific 502 copy.

---

### `src/app/api/public/reports/route.ts` + `src/app/api/v1/reports/route.ts`

**Analog:** `src/app/api/public/reports/analyze/route.ts`

**Thin route delegate** (lines 1-5):

```typescript
import { handleSubmitReportRequest } from "@/server/services/report-service";

export async function POST(request: Request) {
  return handleSubmitReportRequest(request);
}
```

Mirror v1 route exactly like `src/app/api/v1/reports/analyze/route.ts` (identical one-liner delegate).

---

### `src/app/api/public/reports/analyze/route.ts` + v1 mirror — 410 Gone

**Analog:** `src/server/http/errors.ts` (`jsonErrorResponse`); no existing 410 in codebase — use `HttpError` convention.

**410 pattern** (new, follow `jsonErrorResponse` shape):

```typescript
import { HttpError, jsonErrorResponse } from "@/server/http/errors";

const GONE = new HttpError(
  410,
  "POST /api/public/reports/analyze is removed. Use POST /api/public/reports for intake.",
);

export async function POST() {
  return jsonErrorResponse(GONE);
}
```

Keep route file; do not shim to new intake. Update golden contracts to expect 410 for analyze cases.

---

### `src/server/repositories/reports.ts` — intake RPC, citizen projection, officer sort/filter

**Analog:** `createReportWithAccessToken` + `getCitizenStatus` + `listRecentReports`

**RPC call pattern** (lines 111-137):

```typescript
export async function createReportWithAccessToken(client: SupabaseClient, params: CreateReportWithTokenParams): Promise<void> {
  const { error } = await client.rpc("create_report_with_access_token", {
    p_report_id: params.reportId,
    p_token_hash: params.tokenHash,
    // ... mapped fields
  });
  if (error) throw error;
}
```

Add `createIntakeReportWithAccessToken` calling new `create_intake_report_with_access_token` RPC with NULL AI columns and `p_triage_status := 'pending'`.

**Citizen status select — extend with triage_status** (lines 45-78):

```typescript
export async function getCitizenStatus(client: SupabaseClient, reportId: string): Promise<CitizenStatusPayload | null> {
  const { data: reportRow, error: reportError } = await client
    .from("reports")
    .select("report_id, summary, current_status, triage_status, created_at")
    .eq("report_id", reportId)
    .limit(1)
    .maybeSingle();
  // ... project via citizen-status service; summary only when triage_status = 'completed'
}
```

**Officer filter extension** — mirror `applyReportFilters` (lines 249-257):

```typescript
function applyReportFilters(query: any, filters: ReportFilters) {
  if (filters.status != null) query = query.eq("current_status", filters.status);
  if (filters.triage_status != null) query = query.eq("triage_status", filters.triage_status);
  // ... existing filters
}
```

**Default triage bucket sort:** Add RPC or `order` by computed bucket (`manual_review`/`failed` → 0, `pending`/`processing` → 1, `completed` → 2) then `created_at ASC` within bucket. PostgREST cannot express this cleanly — prefer `list_recent_reports` RPC or server-side sort after fetch for MVP if index sort is insufficient.

---

### `src/server/services/citizen-status.ts` — triage-aware projection

**Analog:** itself + `lookupCitizenStatus` anti-enumeration

**Auth + uniform 401** (lines 29-44):

```typescript
export async function lookupCitizenStatus(body: CitizenStatusRequest, client = getAdminClient()) {
  const tokenHash = hashAccessToken(body.token);
  const tokenRow = await getAccessTokenByHash(client, tokenHash);
  if (!tokenBindsReport(tokenRow, body.report_id)) {
    throw citizenStatusUnauthorized();
  }
  const payload = await getCitizenStatus(client, body.report_id);
  if (!payload) throw citizenStatusUnauthorized();
  return projectCitizenTriageView(payload);
}
```

**Projection rules** (new function, D-13–D-16):

```typescript
function projectCitizenTriageView(row: ReportRow & { triage_status: string }): CitizenStatusPayload {
  if (row.triage_status === "pending" || row.triage_status === "processing") {
    return { step: "ai_review_pending", status: row.current_status, summary: null, history: row.history };
  }
  if (row.triage_status === "failed" || row.triage_status === "manual_review") {
    return { step: "automated_review_unavailable", status: row.current_status, summary: null, history: row.history };
  }
  // completed: expose summary, category, etc.
}
```

Never return `triage_error`, provider codes, or retry counts. Keep `citizenStatusUnauthorized()` for all auth failures.

---

### `src/server/triage/service.ts` — `runTriageForReport`

**Analog:** `src/server/services/report-service.ts` (orchestration) + `src/server/ai/openai-compatible.ts` (provider)

**Provider call without policy throw** — split from `openai-compatible.ts` (lines 232-240):

```typescript
// In triage service — schema parse only from provider; policy in triage layer
const schemaResult = ReportAnalysisSchema.safeParse(parsedJson);
if (!schemaResult.success) { /* record attempt, infra retry */ }

const policyResult = validateAnalysisPolicy(schemaResult.data);
if (!policyResult.ok) {
  // one validation retry with violations in prompt context, then disposition.manual_review
}
```

**Lineage capture** (from provider return, lines 242-250):

```typescript
return {
  analysis: schemaResult.data,
  lineage: {
    providerLabel: env.AI_PROVIDER_LABEL,
    responseModel: payload.model ?? env.AI_MODEL,
    requestId: payload.id ?? null,
    latencyMs: Date.now() - startedAt,
  },
};
```

Persist lineage to `triage_attempts`; update `reports` AI columns only on `completed` disposition.

---

### `src/server/triage/claim.ts` + `src/server/triage/worker.ts`

**Analog:** `src/server/repositories/reports.ts` (`client.rpc`) for wrappers; `scripts/run-supabase-sql.mjs` for env loading in entry script

**Claim wrapper** (new, parameterized RPC):

```typescript
import "server-only";
import type { PoolClient } from "pg";

export async function claimNextTriageReport(client: PoolClient) {
  const { rows } = await client.query("SELECT * FROM public.claim_triage_report()");
  return rows[0] ?? null;
}

export async function reclaimStuckTriageReports(client: PoolClient, stuckInterval = "15 minutes") {
  await client.query("SELECT public.reclaim_stuck_triage_reports($1)", [stuckInterval]);
}
```

**Poll loop** (worker.ts, transaction pattern from RESEARCH):

```typescript
async function tick(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await reclaimStuckTriageReports(client);
    const report = await claimNextTriageReport(client);
    await client.query("COMMIT");
    if (report) await runTriageForReport(report.report_id);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

Use `SUPABASE_DB_URL` via `pg` Pool — not Supabase JS client (cannot do `FOR UPDATE SKIP LOCKED`).

---

### `src/server/triage/audit.ts`

**Analog:** `supabase/migrations/20260721130003_officer_operations.sql` (atomic multi-table write)

**Audit insert pattern** (mirror status_events side-effect in RPC):

```typescript
export async function recordTriageAttempt(client: SupabaseClient, params: {
  runId: string;
  attemptNumber: number;
  model: string;
  promptVersion: string;
  rawOutput: string;
  latencyMs: number;
  validationErrors: string[] | null;
  disposition: string;
}) {
  const { error } = await client.from("triage_attempts").insert({ ...params });
  if (error) throw error;
}
```

Prefer `complete_triage_report` RPC for atomic report update + audit row in one transaction (same style as `update_report_with_status_event`).

---

### `src/server/triage/disposition.ts`

**Analog:** `src/server/validation/analysis-policy.ts` (`PolicyResult`)

```typescript
export type TriageDisposition = "completed" | "manual_review" | "failed" | "retry";

export function resolveDisposition(input: {
  infraAttempt: number;
  maxInfraAttempts: number;
  policyViolations: PolicyViolation[] | null;
  hadValidationRetry: boolean;
  unrecoverableError: boolean;
}): TriageDisposition {
  if (input.unrecoverableError) return "failed";
  if (input.policyViolations?.length && input.hadValidationRetry) return "manual_review";
  if (input.infraAttempt >= input.maxInfraAttempts) return "manual_review";
  return "retry";
}
```

Default terminal after exhausted retries: `manual_review` (D-10), not citizen-facing failure.

---

### `src/server/validation/analysis-policy.ts` — Phase 8 MVP rules

**Analog:** itself (extend `validateAnalysisPolicy`)

**Existing violation helper** (lines 28-30, 32-97):

```typescript
function violation(code: string, message: string): PolicyViolation {
  return { code, message };
}

export function validateAnalysisPolicy(analysis: ReportAnalysis): PolicyResult {
  const violations: PolicyViolation[] = [];
  // ... existing checks
  if (analysis.priority === "critical" && analysis.severity !== 5) {
    violations.push(violation("critical_requires_severity_5", "..."));
  }
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true };
}
```

Extend with D-21 rules; keep deterministic pure function (see test at lines 86-92 of `analysis-policy.test.ts`).

---

### `supabase/migrations/08_*_async_triage.sql`

**Analog:** `supabase/migrations/20260721130004_evidence_path_additive.sql` + `20260721130003_officer_operations.sql`

**Additive columns** (evidence_path pattern, lines 3-20):

```sql
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS triage_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS triage_error TEXT,
    ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS triage_next_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS triage_attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS triage_claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS reports_triage_pending_idx
    ON public.reports (created_at)
    WHERE triage_status = 'pending';
```

**Claim RPC** (CTE + SKIP LOCKED from RESEARCH):

```sql
CREATE OR REPLACE FUNCTION public.claim_triage_report()
RETURNS SETOF public.reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_report AS (
    SELECT report_id FROM public.reports
    WHERE triage_status = 'pending'
      AND (triage_next_attempt_at IS NULL OR triage_next_attempt_at <= now())
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.reports r
  SET triage_status = 'processing', triage_claimed_at = now()
  FROM next_report
  WHERE r.report_id = next_report.report_id
  RETURNING r.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_triage_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_triage_report() TO service_role;
```

**Audit tables + `create_intake_report_with_access_token`:** Follow `create_report_with_access_token` insert shape (lines 60-106 of evidence_path migration) with NULL AI fields; add `triage_runs` / `triage_attempts` tables with FK to `reports`.

---

### `supabase/tests/08_async_triage_contract.sql`

**Analog:** `supabase/tests/07_next_backend_contract.sql`

**Assert helper + DO block** (lines 4-51):

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
    v_report_id text := 'test-triage-' || gen_random_uuid()::text;
BEGIN
    -- seed pending report, call claim_triage_report, assert processing
    -- call reclaim after fake stale triage_claimed_at
    -- assert only one worker wins under concurrent claim
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

DROP FUNCTION IF EXISTS _test_assert(boolean, text);
```

Run via: `node scripts/run-supabase-sql.mjs supabase/tests/08_async_triage_contract.sql`

---

### `scripts/triage-worker.mjs`

**Analog:** `scripts/run-supabase-sql.mjs` (env) + `scripts/smoke-ai.mjs` (main loop)

**Env bootstrap** (from `load-project-env.mjs` usage in run-supabase-sql, lines 29-35):

```javascript
import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "./load-project-env.mjs";

const env = loadProjectEnv();
const missing = requireEnvKeys(env, ["SUPABASE_DB_URL", "THIRD_PARTY_API_KEY", "AI_BASE_URL"]);
if (missing.length > 0) { /* fail fast */ }
```

**Entry** (smoke-ai main pattern, lines 414-420):

```javascript
import { runWorkerLoop } from "../src/server/triage/worker.ts"; // or compiled import path

runWorkerLoop().catch((error) => {
  console.error(`TRIAGE_WORKER_FAILED: ${error.message}`);
  process.exit(1);
});
```

Add `package.json` script: `"triage:worker": "node scripts/triage-worker.mjs"`.

---

### `scripts/register-citymind-task.ps1`

**Analog:** itself — duplicate task registration for worker

**Start script pattern** (lines 68-81):

```powershell
function New-StartScript([string]$NodeExe, [string]$HostValue, [int]$ListenPort) {
  $lines = @(
    "@echo off",
    "cd /d `"$frontendRoot`"",
    "call npm run triage:worker >> `"$workerStdoutLog`" 2>> `"$workerStderrLog`""
  )
  Set-Content -Path $workerScriptPath -Value ($lines -join "`r`n") -Encoding ASCII
}
```

Register second scheduled task (e.g. `CityMind-Triage`) beside existing `CityMind` next start task.

---

### `src/components/ReportForm.tsx`

**Analog:** itself

**Submit target change** (lines 114-156):

```typescript
const res = await fetch("/api/public/reports", {  // was /analyze
  method: "POST",
  body: formData,
});

const body = await res.json();
const reportId = body?.report_id;
const accessToken = body?.access_token;
// Response no longer has analysis fields — flash unchanged
sessionStorage.setItem(FLASH_KEY, JSON.stringify({ reportId, accessToken }));
router.push("/report/success");
```

Update submit button copy from `analyzing` to submitting/receiving wording in messages catalogs.

---

### `src/app/[locale]/status/page.tsx`

**Analog:** itself (conditional render + i18n)

**Conditional summary** (lines 241-248):

```typescript
{result.summary ? (
  <div>
    <h2>{t("statusSummaryLabel")}</h2>
    <p>{result.summary}</p>
  </div>
) : null}
```

Extend `StatusResult` with `step` / `triage_status`; show four-step service labels; on `automated_review_unavailable` show calm copy from `messages/en.json` / `vi.json` (D-15). Never render provider errors.

---

### `src/components/reports/ReportsTable.tsx` + `ReportsFilters.tsx` + `types.ts`

**Analog:** `ReportsTable.tsx` `statusVariant` + Badge; `ReportsFilters.tsx` status Select

**Badge pattern** (lines 71-84, 165-180):

```typescript
function triageVariant(triageStatus: string): "secondary" | "outline" | "destructive" {
  if (triageStatus === "manual_review" || triageStatus === "failed") return "destructive";
  if (triageStatus === "pending" || triageStatus === "processing") return "outline";
  return "secondary";
}

// In column cell:
<Badge variant={triageVariant(row.triage_status)}>{t(`triage_${row.triage_status}`)}</Badge>
```

**Filter chip** — copy `STATUSES` pattern in `ReportsFilters.tsx` (lines 29-38, 82-89):

```typescript
const TRIAGE_STATUSES = ["pending", "processing", "completed", "manual_review", "failed"] as const;
// Add triage_status to FILTER_PARAM_KEYS in types.ts
```

Extend `ReportRow` in `types.ts` with `triage_status: string`.

---

### `src/app/dashboard/reports/[reportId]/page.tsx`

**Analog:** itself (section order)

**Reorder per D-20** — move triage badge before AI block; show NULL AI fields as empty/`—`, never placeholders:

```typescript
{/* 1. Citizen description + image (lines 184-234) */}
{/* 2. Triage status badge — NEW */}
{report.triage_status && (
  <Badge variant={triageVariant(report.triage_status)}>...</Badge>
)}
{/* 3. Observed facts (evidence) — only when triage completed */}
{report.triage_status === "completed" && (
  <SignalList items={report.evidence} ... />
)}
{/* confidence: label "model confidence — uncalibrated", no % (D-23) */}
```

Remove or guard meta grid (priority/severity/confidence) when `triage_status !== 'completed'`.

---

### Test files

#### `src/server/services/report-service.test.ts`

**Analog:** itself — copy `createClient` mock + `formWith` helpers (lines 50-74)

Add `submitReport` tests: returns `{ report_id, access_token, intake_status, triage_status }` without calling provider; assert `provider.analyze` never called.

#### `src/server/services/citizen-status.test.ts`

**Analog:** itself — extend `createClient` reportRow with `triage_status` (lines 12-41)

Add cases: `pending`/`processing` → `summary: null`; `manual_review` → calm step, no error detail.

#### `src/server/repositories/reports.test.ts`

**Analog:** itself — `listRecentReports` chain mock (lines 78-119)

Add triage_status filter and bucket sort order assertions.

#### `src/server/triage/*.test.ts`

**Analog:** `report-service.test.ts` (mocked deps) + `analysis-policy.test.ts` (pure functions)

Mock `pg` client for claim; mock provider for service disposition paths.

#### `tests/report-form.test.mjs`

**Analog:** itself (line 44) — change assertion:

```javascript
assert.match(form, /\/api\/public\/reports['"]/);
assert.doesNotMatch(form, /\/analyze/);
```

#### `tests/contracts/golden-contracts.test.ts`

**Analog:** itself — add `POST /api/v1/reports` → `intake.json`; map analyze → 410 fixture.

---

## Shared Patterns

### Authentication (citizen)

**Source:** `src/server/services/citizen-status.ts` (lines 33-42)
**Apply to:** status API, unchanged on intake (public FormData POST with rate limit only)

```typescript
const tokenHash = hashAccessToken(body.token);
const tokenRow = await getAccessTokenByHash(client, tokenHash);
if (!tokenBindsReport(tokenRow, body.report_id)) {
  throw citizenStatusUnauthorized();
}
```

### Rate limiting

**Source:** `src/server/services/report-service.ts` (lines 201-216)
**Apply to:** new intake handler (`enforceReportRateLimit`); status keeps `enforceStatusRateLimit`

### Error responses

**Source:** `src/server/http/errors.ts` (lines 16-28)

```typescript
export function jsonErrorResponse(error: HttpError): Response {
  return Response.json({ detail: error.message }, { status: error.status, headers });
}
```

### Atomic Postgres RPC

**Source:** `supabase/migrations/20260721130004_evidence_path_additive.sql` (lines 22-120)
**Apply to:** intake create, claim, complete, reclaim — all multi-row mutations

```sql
CREATE OR REPLACE FUNCTION public.create_report_with_access_token(...) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$ ... $$;
REVOKE ALL ON FUNCTION ... FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ... TO service_role;
```

### Officer session guard

**Source:** `src/app/dashboard/reports/[reportId]/page.tsx` (line 87)
**Apply to:** dashboard pages unchanged

```typescript
await requireOfficerSession();
```

### Evidence upload

**Source:** `src/server/services/report-service.ts` (lines 99-133) + `evidence-service.ts`
**Apply to:** intake only; worker reads `evidence_path` for vision triage

### Access token issuance

**Source:** `src/server/security/access-tokens.ts` via `issueAccessToken()` in report-service (line 140)
**Apply to:** intake path unchanged — hash at rest, plaintext once in response

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/api/*/reports/analyze/route.ts` (410) | route | request-response | No 410 routes exist; use `HttpError` + `jsonErrorResponse` convention |
| `src/server/triage/worker.ts` poll loop | service | event-driven | No background worker in codebase; closest is CLI scripts |
| `claim_triage_report` SQL | migration | batch | `FOR UPDATE SKIP LOCKED` queue pattern is new; follow RESEARCH CTE template |
| `triage_runs` / `triage_attempts` tables | migration | CRUD | No audit tables yet; analog is `status_events` side-effect in officer RPC |

---

## Metadata

**Analog search scope:** `src/server/`, `src/app/api/`, `src/components/`, `scripts/`, `supabase/migrations/`, `supabase/tests/`, `tests/`
**Files scanned:** ~149 TS/TSX + 18 scripts + 16 SQL
**Pattern extraction date:** 2026-07-22
