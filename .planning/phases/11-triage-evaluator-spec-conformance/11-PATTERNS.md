# Phase 11: Triage Spec & Guided Self-Help - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 28 new/modified files (inferred from 11-CONTEXT.md + 11-GAP-ANALYSIS.md)
**Analogs found:** 24 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/health/ai/route.ts` | route | request-response | `src/app/api/ready/route.ts` | exact |
| `src/server/health/ai-readiness.ts` | service | request-response | `src/server/health/readiness.ts` | exact |
| `src/app/api/internal/triage/[reportId]/route.ts` | route | event-driven | `src/app/api/officer/reports/[reportId]/routing/route.ts` | role-match |
| `src/server/services/triage-dispatch.ts` | service | event-driven | `src/server/triage/service.ts` | exact |
| `src/app/api/officer/reports/[reportId]/triage/route.ts` | route | request-response | `src/app/api/officer/reports/[reportId]/status/route.ts` | exact |
| `src/app/api/officer/reports/bulk-triage/route.ts` | route | batch | `src/app/api/officer/reports/export/route.ts` | role-match |
| `src/app/api/public/reports/coach/route.ts` | route | request-response | `src/app/api/public/reports/escalate/route.ts` | exact |
| `src/server/services/citizen-coach.ts` | service | CRUD + transform | `src/server/services/citizen-escalate.ts` | exact |
| `src/server/repositories/chat-messages.ts` | model/repository | CRUD | `src/server/repositories/reports.ts` | role-match |
| `src/server/domain/evaluator-analysis.ts` | model | transform | `src/server/domain/report-analysis.ts` | exact |
| `src/server/ai/evaluator.ts` | service | transform | `src/server/ai/openai-compatible.ts` | exact |
| `src/server/ai/coach.ts` | service | request-response | `src/server/ai/openai-compatible.ts` | role-match |
| `src/server/adapters/evaluator-read.ts` | utility | transform | `src/server/services/citizen-status.ts` (`projectCitizenTriageView`) | role-match |
| `src/server/validation/evaluator-policy.ts` | utility | transform | `src/server/validation/analysis-policy.ts` | exact |
| `src/server/services/report-service.ts` (modify) | service | event-driven | `src/server/services/report-service.ts` (`submitReport`) | exact |
| `src/server/triage/service.ts` (modify) | service | transform | `src/server/triage/service.ts` | exact |
| `supabase/migrations/*_evaluator_columns.sql` | migration | CRUD | `supabase/migrations/20260722130001_routing_columns.sql` | exact |
| `supabase/migrations/*_chat_messages.sql` | migration | CRUD | `supabase/migrations/20260722140001_triage_shadow.sql` | exact |
| `supabase/tests/11_*_contract.sql` | test | batch | `supabase/tests/09_routing_contract.sql` | exact |
| `src/app/[locale]/report/success/page.tsx` (modify) | component | request-response | `src/app/[locale]/status/page.tsx` | role-match |
| `src/app/[locale]/status/page.tsx` (modify) | component | request-response | `src/app/[locale]/status/page.tsx` | exact |
| `src/components/coach/CoachPanel.tsx` | component | request-response | `src/app/[locale]/status/page.tsx` (playbook + escalate) | role-match |
| `src/components/dashboard/AiHealthChip.tsx` | component | request-response | `src/components/reports/TriageStatusBadge.tsx` | role-match |
| `src/components/reports/ReportsTable.tsx` (modify) | component | request-response | `src/components/RoutingOverrideActions.tsx` | role-match |
| `src/components/reports/TriageDispatchActions.tsx` | component | request-response | `src/components/StatusActions.tsx` | exact |
| `src/app/dashboard/page.tsx` (modify) | component | request-response | `src/app/dashboard/page.tsx` | exact |
| `messages/en.json`, `messages/vi.json` (modify) | config | transform | `messages/en.json` (`public.routing`, `dashboard.triage`) | exact |
| `src/app/api/public/reports/analyze/route.ts` (document only) | route | request-response | `src/app/api/public/reports/analyze/route.ts` | exact |

## Pattern Assignments

### `src/app/api/health/ai/route.ts` (route, request-response)

**Analog:** `src/app/api/ready/route.ts`

**Imports + handler pattern** (lines 1-12):

```typescript
import { checkReadiness } from "@/server/health/readiness";

export async function GET() {
  const readiness = await checkReadiness();
  const status = readiness.status === "ready" ? 200 : 503;
  return Response.json(readiness, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
```

**Apply:** Thin route delegates to `checkAiHealth()`; map `up`→200, `degraded`→200, `down`→503; same `Cache-Control: no-store`; never return secrets.

---

### `src/server/health/ai-readiness.ts` (service, request-response)

**Analog:** `src/server/health/readiness.ts`

**Types + timeout wrapper** (lines 5-31):

```typescript
export type DependencyStatus = {
  name: string;
  status: "up" | "down";
  latency_ms: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
```

**Probe + degraded response** (lines 33-88):

```typescript
export async function checkReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReadinessResponse> {
  const started = Date.now();
  // ... env guard ...
  try {
    await withTimeout(/* minimal provider call */, READINESS_TIMEOUT_MS);
    return {
      status: "ready",
      dependencies: [{ name: "supabase", status: "up", latency_ms: Date.now() - started }],
    };
  } catch {
    return { status: "not_ready", dependencies: [{ name: "supabase", status: "down", latency_ms: ... }] };
  }
}
```

**Apply:** Mirror structure for AI — minimal `chat/completions` with tiny max_tokens; return `{ status: "up"|"degraded"|"down", model_id, latency_ms }`; use `getServerEnv()` + `buildChatCompletionsUrl()` from `src/server/config/env.ts`; reference `scripts/smoke-ai.mjs` for request shape only (not full smoke per-request).

---

### `src/app/api/internal/triage/[reportId]/route.ts` (route, event-driven)

**Analog:** `src/app/api/officer/reports/[reportId]/routing/route.ts` + `src/server/triage/service.ts`

**Thin route with dynamic param** (lines 1-8):

```typescript
import { handleOfficerRoutingOverrideRequest } from "@/server/services/officer-write";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleOfficerRoutingOverrideRequest(request, reportId);
}
```

**Core dispatch** — call existing hook (lines 276-279):

```typescript
export async function runTriageForReport(
  reportId: string,
  deps: TriageServiceDeps = { client: getAdminClient() },
): Promise<TriageRunResult> {
```

**Apply:** Route is one-liner → `handleInternalTriageDispatch(request, reportId)`; service validates internal auth secret/header (new — no existing analog; use env `TRIAGE_INTERNAL_SECRET` pattern similar to service-role key check in readiness); fire-and-forget or await `runTriageForReport`; return `{ report_id, disposition }`.

---

### `src/app/api/officer/reports/[reportId]/triage/route.ts` (route, request-response)

**Analog:** `src/app/api/officer/reports/[reportId]/status/route.ts`

**Route shell** (lines 1-8):

```typescript
import { handleUpdateReportStatusRequest } from "@/server/services/officer-write";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleUpdateReportStatusRequest(request, reportId);
}
```

**Auth in service** (lines 27-32):

```typescript
export async function handleUpdateReportStatusRequest(
  request: Request,
  reportId: string,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;
```

**Apply:** `POST` (not PATCH) → `handleOfficerTriageDispatchRequest`; guard with `requireOfficerContext()`; validate `triage_status in (pending, failed, retry)` before dispatch.

---

### `src/app/api/public/reports/coach/route.ts` (route, request-response)

**Analog:** `src/app/api/public/reports/escalate/route.ts`

**Thin route** (lines 1-5):

```typescript
import { handleCitizenEscalateRequest } from "@/server/services/citizen-escalate";

export async function POST(request: Request) {
  return handleCitizenEscalateRequest(request);
}
```

**Apply:** Identical one-liner delegating to `handleCitizenCoachRequest`.

---

### `src/server/services/citizen-coach.ts` (service, CRUD + transform)

**Analog:** `src/server/services/citizen-escalate.ts`

**Zod request schema + token verify** (lines 21-36):

```typescript
const CitizenEscalateRequestSchema = z.object({
  report_id: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
});

export async function escalateCitizenReport(
  body: CitizenEscalateRequest,
  client: SupabaseClient = getAdminClient(),
): Promise<{ ok: true; routing_destination: "government" }> {
  const tokenHash = hashAccessToken(body.token);
  const tokenRow = await getAccessTokenByHash(client, tokenHash);
  if (!tokenBindsReport(tokenRow, body.report_id)) {
    throw citizenStatusUnauthorized();
  }
```

**HTTP handler with rate limit** (lines 46-98):

```typescript
export async function handleCitizenEscalateRequest(
  request: Request,
  options: { client?: SupabaseClient; rateLimitRequest?: RateLimitRequest } = {},
): Promise<Response> {
  const rateLimit = enforceStatusRateLimit(rateLimitRequest);
  if (rateLimit) {
    return Response.json({ detail: rateLimit.detail }, { status: rateLimit.status, headers: { "Retry-After": rateLimit.retryAfter } });
  }
  // parse JSON → safeParse → lookup → Response.json / jsonErrorResponse
}
```

**Apply:** Extend schema with `message: z.string().min(1).max(2000)`; after token verify, load report + assert `routing_destination === "self_help"` and `triage_status === "completed"`; gate on AI health; persist user + assistant rows; return assistant message only (no routing/status mutation).

---

### `src/server/ai/evaluator.ts` + `src/server/domain/evaluator-analysis.ts` (service/model, transform)

**Analog:** `src/server/ai/openai-compatible.ts` + `src/server/domain/report-analysis.ts`

**Zod strict schema** (lines 3-29):

```typescript
export const ReportAnalysisSchema = z
  .object({
    category: CategorySchema,
    severity: z.number().int().min(1).max(5),
    // ...
  })
  .strict();
```

**Structured completion request** (lines 220-256):

```typescript
response = await fetchImpl(endpoint, {
  method: "POST",
  redirect: "error",
  signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
  headers: {
    Authorization: `Bearer ${env.THIRD_PARTY_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: env.AI_MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: buildUserContent(input, includeVision) },
    ],
    response_format: OPENAI_COMPATIBLE_RESPONSE_FORMAT,
  }),
});
```

**Apply:** Load `system_prompt` + `output_schema` from `prompt/citymind_ai_triage_structured_output_evaluator.json`; build Zod from 11 keys; reuse `readBoundedBody`, `parseChatCompletionResponseBody`, `AnalysisProviderError` from `openai-compatible.ts`; wire into `runTriageForReport` via `analyzeStructured` dep.

---

### `src/server/adapters/evaluator-read.ts` (utility, transform)

**Analog:** `src/server/services/citizen-status.ts` (`projectCitizenTriageView`)

**Projection function** (lines 56-131):

```typescript
export function projectCitizenTriageView(
  row: CitizenStatusRawPayload,
): CitizenStatusResponse {
  const base = { report_id: row.report_id, received_at: row.received_at, triage_status: row.triage_status, status: row.status, history };
  if (row.triage_status === "pending" || row.triage_status === "processing") {
    return { ...base, service_step: "ai_review_pending", category: null, /* ... */ };
  }
  // branch on routing_destination, triage_status ...
}
```

**Dual-read precedent** — `tests/migration/evidence-reconciliation.test.ts` (lines 9-20):

```typescript
it("prefers evidence_path over legacy supabase URI", () => {
  expect(resolveEvidenceLocation({
    evidencePath: "evidence/reports/r1/evidence.jpg",
    legacyUri: "supabase://evidence/reports/r1/legacy.jpg",
  })).toEqual({ bucket: "evidence", objectPath: "reports/r1/evidence.jpg" });
});
```

**Apply:** `projectEvaluatorAnalysis(row)` maps new JSONB columns when present, else legacy `category/severity/summary/...`; consumers (dashboard, citizen status) read through adapter until cutover.

---

### `src/server/validation/evaluator-policy.ts` (utility, transform)

**Analog:** `src/server/validation/analysis-policy.ts`

**Policy violation pattern** (lines 77-129):

```typescript
export function validateAnalysisPolicy(
  analysis: ReportAnalysis,
  options: { description?: string } = {},
): PolicyResult {
  const violations: PolicyViolation[] = [];
  if (analysis.priority === "critical" && analysis.severity !== 5) {
    violations.push(
      violation("critical_requires_severity_5", "Critical priority requires severity 5 alignment."),
    );
  }
  // ...
  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}
```

**Apply:** Import `policy_assertions` from evaluator JSON; enforce `critical` ↔ `severity === 5`; keep violation code strings stable for triage retry instruction in `buildValidationRetryInstruction`.

---

### `src/server/services/report-service.ts` (modify — intake enqueue)

**Analog:** `src/server/services/report-service.ts` (`submitReport`)

**Intake persist return** (lines 160-181):

```typescript
await createIntakeReportWithAccessToken(deps.client, {
  reportId,
  tokenHash,
  tokenExpiresAt: expiresAt,
  description: description.trim() || null,
  latitude,
  longitude,
  evidencePath: evidenceUri ? formatEvidencePath(...) : null,
});

return {
  report_id: reportId,
  access_token: plaintext,
  intake_status: "received",
  triage_status: "pending",
};
```

**Apply:** After successful `createIntakeReportWithAccessToken`, call internal triage dispatch (non-blocking `fetch` to loopback or direct `runTriageForReport` in-process); do not block citizen response on triage completion.

---

### `supabase/migrations/*_evaluator_columns.sql` (migration)

**Analog:** `supabase/migrations/20260722130001_routing_columns.sql`

**Additive columns + CHECK** (lines 3-17):

```sql
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS routing_destination TEXT,
    ADD COLUMN IF NOT EXISTS routing_reason TEXT,
    -- ...

ALTER TABLE public.reports
    DROP CONSTRAINT IF EXISTS reports_routing_destination_chk;

ALTER TABLE public.reports
    ADD CONSTRAINT reports_routing_destination_chk
    CHECK (routing_destination IS NULL OR routing_destination IN ('self_help', 'government'));
```

**Apply:** Add JSONB `evaluator_output` (or per-key columns per planner); keep legacy columns populated during dual-write; index triage dispatch columns if needed.

---

### `supabase/migrations/*_chat_messages.sql` (migration)

**Analog:** `supabase/migrations/20260722140001_triage_shadow.sql`

**New table + RLS + grants** (lines 3-26):

```sql
CREATE TABLE IF NOT EXISTS public.triage_shadow_comparisons (
    comparison_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    -- ...
);

ALTER TABLE public.triage_shadow_comparisons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.triage_shadow_comparisons FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.triage_shadow_comparisons TO service_role;
```

**Apply:** `chat_messages(report_id, role, content, created_at)` with FK to `reports`; service_role only; index `(report_id, created_at)`.

---

### `supabase/tests/11_*_contract.sql` (test)

**Analog:** `supabase/tests/09_routing_contract.sql`

**Assert helper + DO block** (lines 5-37):

```sql
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
    v_report_id text := 'test-routing-pending-' || gen_random_uuid()::text;
BEGIN
    PERFORM public.create_intake_report_with_access_token(...);
    PERFORM _test_assert(v_row.triage_status = 'pending', 'intake triage_status must be pending');
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;
```

**Apply:** Contract tests for chat_messages RLS, coach eligibility, evaluator policy, failed-copy calmness.

---

### `src/app/[locale]/report/success/page.tsx` (modify)

**Analog:** `src/app/[locale]/status/page.tsx` + existing success flash

**Session flash consume** (success page lines 12-30):

```typescript
const FLASH_KEY = "citymind:report-success";

function consumeFlash(): FlashPayload | null {
  const raw = sessionStorage.getItem(FLASH_KEY);
  sessionStorage.removeItem(FLASH_KEY);
  // parse reportId + accessToken
}
```

**Status fetch pattern** (status page lines 190-240):

```typescript
async function lookupStatus(id: string, accessToken: string) {
  setLoading(true);
  try {
    const res = await fetch("/api/public/reports/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: id, token: accessToken }),
    });
    if (res.status === 401) { setErrorKind("verify"); return; }
    if (res.status === 429) { /* rate limit */ return; }
    const data = (await res.json()) as StatusResult;
    setResult(data);
  } finally {
    setLoading(false);
  }
}
```

**Apply:** After flash load, poll status on interval until `triage_status` terminal; branch UI on `service_step` / `routing_destination`; embed `CoachPanel` when self_help + completed; show government messaging otherwise; disable coach when `/api/health/ai` is `down`.

---

### `src/components/reports/TriageDispatchActions.tsx` + `ReportsTable.tsx` (modify)

**Analog:** `src/components/StatusActions.tsx` + `src/components/RoutingOverrideActions.tsx`

**Officer fetch + refresh** (StatusActions lines 37-69):

```typescript
async function updateStatus(status: string, decisionNote?: string) {
  setLoading(status);
  setError("");
  try {
    const res = await fetch(url.toString(), { method: "PATCH" });
    if (!res.ok) { setError(t("statusUpdateFailed")); return; }
    router.refresh();
  } catch {
    setError(t("statusUpdateFailed"));
  } finally {
    setLoading("");
  }
}
```

**Apply:** Per-row button calls `POST /api/officer/reports/{id}/triage`; stop row click propagation (`e.stopPropagation()`); bulk selection is new — add checkbox column following TanStack Table `rowSelection` (no existing bulk analog; use `DropdownMenu` batch pattern from column menu in ReportsTable lines 403-431).

---

### `src/components/dashboard/AiHealthChip.tsx`

**Analog:** `src/components/reports/TriageStatusBadge.tsx`

**Badge with variant + i18n** (lines 14-50):

```typescript
export function triageVariant(triageStatus: string): "outline" | "secondary" | "elevated" {
  if (triageStatus === "manual_review" || triageStatus === "failed") return "elevated";
  // ...
}

export default function TriageStatusBadge({ triageStatus, className }: Props) {
  const t = useTranslations("dashboard.triage");
  return (
    <Badge variant={...} className={cn("gap-1 capitalize", variant === "elevated" && "border-amber-500/50 bg-amber-50 text-amber-900")}>
      {variant === "outline" ? <Loader2 className="size-3.5 shrink-0" /> : null}
      {label}
    </Badge>
  );
}
```

**Apply:** Poll `GET /api/health/ai` on mount + interval; green/amber/red classes; place in dashboard header beside `ReportsDateRangeFilter` (`src/app/dashboard/page.tsx` lines 49-53).

---

### `messages/en.json` + `messages/vi.json` (modify)

**Analog:** `messages/en.json`

**Nested public routing keys** (lines 121-134):

```json
"routing": {
  "playbookPanelTitle": "What you can do now",
  "escalateTitle": "Still need city help?",
  "escalateCta": "Send to city officers",
  "escalateError": "Could not send your report to the city. Check your connection and try again."
}
```

**Dashboard triage namespace** (lines 331-348):

```json
"triage": {
  "columnHeader": "AI triage",
  "badgePending": "AI review pending",
  "badgeElevated": "Needs officer review",
  "badgeComplete": "AI review complete"
}
```

**Apply:** Add `public.coach.*` (chat UI, AI down warning), `dashboard.aiHealth.*` (chip labels), `dashboard.triage.runNow` / `bulkRetry` under existing `dashboard.triage`; mirror all keys in `messages/vi.json`.

---

## Shared Patterns

### Officer API authentication

**Source:** `src/server/officer/guard.ts`
**Apply to:** All `src/app/api/officer/**` routes and officer dispatch services

```typescript
export async function requireOfficerContext(): Promise<
  { ok: true; context: OfficerContext } | { ok: false; response: Response }
> {
  const session = await getClaims();
  if (!session) {
    return { ok: false, response: Response.json({ detail: "Unauthorized" }, { status: 401 }) };
  }
  const client = await createClient();
  return { ok: true, context: { session, client } };
}
```

### Citizen token-scoped APIs

**Source:** `src/server/services/citizen-status.ts` + `src/server/security/access-tokens.ts`
**Apply to:** Coach API, status polling extensions

```typescript
const tokenHash = hashAccessToken(body.token);
const tokenRow = await getAccessTokenByHash(client, tokenHash);
if (!tokenBindsReport(tokenRow, body.report_id)) {
  throw citizenStatusUnauthorized();
}
```

### Rate limiting (citizen endpoints)

**Source:** `src/server/security/rate-limit.ts`
**Apply to:** Coach POST; reuse `enforceStatusRateLimit` or add `enforceCoachRateLimit` with same `Retry-After` header pattern

```typescript
const rateLimit = enforceStatusRateLimit(rateLimitRequest);
if (rateLimit) {
  return Response.json({ detail: rateLimit.detail }, {
    status: rateLimit.status,
    headers: { "Retry-After": rateLimit.retryAfter },
  });
}
```

### HTTP error responses

**Source:** `src/server/http/errors.ts`
**Apply to:** All new route handlers

```typescript
export function jsonErrorResponse(error: HttpError): Response {
  return Response.json({ detail: error.message }, { status: error.status, headers });
}
```

### AI provider config (shared triage + coach)

**Source:** `src/server/config/env.ts`
**Apply to:** Evaluator, coach, AI health

```typescript
const ServerEnvSchema = z.object({
  AI_BASE_URL: z.string().min(1).transform((value) => normalizeAiBaseUrl(value)),
  AI_MODEL: z.string().min(1),
  THIRD_PARTY_API_KEY: z.string().min(1),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(60_000),
});
```

### Thin API route convention

**Source:** `src/app/api/public/reports/status/route.ts`, `escalate/route.ts`, `officer/.../status/route.ts`
**Apply to:** All new routes

```typescript
export async function POST(request: Request) {
  return handleXxxRequest(request);
}
```

Business logic lives in `src/server/services/*`; routes stay import + delegate only.

### next-intl client components

**Source:** `src/components/RoutingOverrideActions.tsx`
**Apply to:** CoachPanel, TriageDispatchActions, AiHealthChip

```typescript
const t = useTranslations("dashboard.routing");
```

Server pages use `getTranslations` from `next-intl/server` (`src/app/dashboard/page.tsx` line 31).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/api/internal/triage/[reportId]/route.ts` (auth layer) | middleware | request-response | No internal/service-to-service auth route exists; mirror env secret check from `readiness.ts` missing-config guard |
| `src/app/api/officer/reports/bulk-triage/route.ts` | route | batch | No bulk officer mutation endpoint; compose from single dispatch + officer auth |
| `src/components/reports/ReportsTable.tsx` (row selection) | component | request-response | Table has no checkbox/selection column yet; TanStack `rowSelection` is new |
| `src/server/ai/coach.ts` (conversational, non-JSON) | service | request-response | Triage uses structured JSON only; coach needs multi-turn messages without `response_format: json_object` |

## Metadata

**Analog search scope:** `src/app/api/**`, `src/server/**`, `src/components/**`, `src/app/[locale]/**`, `src/app/dashboard/**`, `supabase/migrations/**`, `supabase/tests/**`, `messages/**`, `prompt/**`, `scripts/smoke-ai.mjs`
**Files scanned:** ~45
**Pattern extraction date:** 2026-07-22
