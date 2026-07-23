# Phase 13: Immediate Citizen Triage on Submit — Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 22 new/modified files (inferred from ROADMAP goal + live codebase delta vs Phase 11 poll-primary)
**Analogs found:** 20 / 22

## Phase Context

**Goal:** Run evaluator-spec triage **synchronously** on every citizen submit, then show immediate self-help guidance or government-queue messaging on a redesigned success page.

**Delta from Phase 11:** Phase 11 shipped push-primary dispatch (`enqueueTriageDispatch`) and success-page **polling** (`SuccessTriagePanel`). Phase 13 inverts the citizen hot path: `dispatchTriageAndWait` blocks in `submitReport`, projects outcome via `projectCitizenTriageView`, and flashes it to `CitizenTriageOutcome` — keeping `SuccessTriagePanel` only as fallback when sync triage fails or is still pending.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/services/report-service.ts` (modify) | service | request-response + transform | `src/server/services/report-service.ts` (`submitReport`) | exact |
| `src/server/triage/dispatch.ts` (modify) | service | event-driven | `src/server/triage/dispatch.ts` (`dispatchTriage`) | exact |
| `src/server/triage/service.ts` | service | transform | `src/server/triage/service.ts` (`runTriageForReport`) | exact |
| `src/server/ai/evaluator.ts` | utility | transform | `src/server/ai/evaluator.ts` | exact |
| `src/server/ai/openai-compatible.ts` (`analyzeStructured`) | service | transform | same file | exact |
| `prompt/citymind_ai_triage_structured_output_evaluator.json` | config | transform | same file | exact |
| `src/server/routing/apply-routing.ts` | service | CRUD | `src/server/routing/apply-routing.ts` | exact |
| `src/server/routing/policy.ts` | utility | transform | `src/server/routing/policy.ts` | exact |
| `src/server/routing/playbooks.ts` | utility | transform | `src/server/routing/playbooks.ts` | exact |
| `src/server/services/citizen-status.ts` (`projectCitizenTriageView`) | service | transform | same function | exact |
| `src/components/ReportForm.tsx` (modify) | component | request-response | `src/components/ReportForm.tsx` | exact |
| `src/app/[locale]/report/success/page.tsx` (modify) | component | request-response | `src/app/[locale]/report/success/page.tsx` | exact |
| `src/components/coach/CitizenTriageOutcome.tsx` | component | request-response | `src/app/[locale]/status/page.tsx` (branch UI) + Phase 11 success poll | role-match |
| `src/components/coach/SuccessTriagePanel.tsx` | component | request-response | `src/app/[locale]/status/page.tsx` (status poll) | exact |
| `src/components/coach/CoachPanel.tsx` | component | request-response | `src/components/coach/CoachPanel.tsx` | exact |
| `src/app/api/public/reports/route.ts` | route | request-response | `src/app/api/public/reports/route.ts` | exact |
| `src/server/services/report-service.test.ts` (modify) | test | request-response | same file (`submitReport` describe) | exact |
| `src/server/triage/dispatch.test.ts` (extend) | test | event-driven | same file | role-match |
| `messages/en.json`, `messages/vi.json` (modify) | config | transform | `public.successOutcome` namespace | exact |
| `supabase/tests/13_phase13_contract.sql` (new) | test | batch | `supabase/tests/11_phase11_contract.sql` | role-match |
| `package.json` (`phase13:gate`) | config | batch | `phase12:gate` script | exact |

## Pattern Assignments

### `src/server/services/report-service.ts` (service, request-response + transform)

**Analog:** `src/server/services/report-service.ts` — current `submitReport` + `buildIntakeTriageOutcome`

**Imports — triage dispatch seam** (lines 26-33):

```typescript
import {
  dispatchTriageAndWait,
  enqueueTriageDispatch,
} from "@/server/triage/dispatch";
import {
  projectCitizenTriageView,
  type CitizenServiceStep,
} from "@/server/services/citizen-status";
```

**Outcome projection after triage** (lines 156-177):

```typescript
async function buildIntakeTriageOutcome(
  client: SupabaseClient,
  reportId: string,
): Promise<Omit<ReportSubmissionResponse, "report_id" | "access_token" | "intake_status">> {
  const raw = await getCitizenStatus(client, reportId);
  if (!raw) {
    return { triage_status: "pending" };
  }

  const view = projectCitizenTriageView(raw);
  return {
    triage_status: view.triage_status,
    service_step: view.service_step,
    routing_destination: raw.routing_destination,
    category: view.category,
    severity: view.severity,
    priority: view.priority,
    summary: view.summary,
    recommendation: view.recommendation,
    playbook_id: view.playbook_id ?? null,
    can_escalate: view.can_escalate ?? false,
  };
}
```

**Synchronous triage + async fallback** (lines 222-237):

```typescript
const runTriage = deps.dispatchTriageAndWait ?? dispatchTriageAndWait;
try {
  await runTriage(reportId, { client: deps.client });
} catch (triageError) {
  console.error(`submitReport: synchronous triage failed for ${reportId}`, triageError);
  enqueueTriageDispatch(reportId);
}

const outcome = await buildIntakeTriageOutcome(deps.client, reportId);

return {
  report_id: reportId,
  access_token: plaintext,
  intake_status: "received",
  ...outcome,
};
```

**Apply:** Phase 13 planner should preserve intake-never-blocks contract: citizen always gets `report_id` + `access_token`; sync triage enriches response; `enqueueTriageDispatch` is safety net only. Do **not** call legacy `provider.analyze` on intake path. Extend `ReportSubmissionResponse` only if new citizen fields are required.

**Test pattern** — `src/server/services/report-service.test.ts` (lines 264-301):

```typescript
it("returns intake response with synchronous triage outcome without calling provider.analyze", async () => {
  const result = await submitReport(form, { client: client as never });
  expect(result.triage_status).toBe("completed");
  expect(result.service_step).toBe("self_help_guidance");
  expect(dispatchTriageAndWait).toHaveBeenCalled();
  expect(provider.analyze).not.toHaveBeenCalled();
});
```

---

### `src/server/triage/dispatch.ts` (service, event-driven)

**Analog:** `dispatchTriage` + new `dispatchTriageAndWait`

**Wait mode on claim** (lines 109-126):

```typescript
const runTriage = deps.runTriage ?? runTriageForReport;
if (deps.wait) {
  try {
    await runTriage(reportId, { client: deps.client });
  } catch (dispatchError) {
    console.error(`dispatchTriage: failed report ${reportId}`, dispatchError);
  }
} else {
  void runTriage(reportId, { client: deps.client }).catch((dispatchError) => {
    console.error(`dispatchTriage: failed report ${reportId}`, dispatchError);
  });
}
```

**Public sync entry** (lines 129-135):

```typescript
export async function dispatchTriageAndWait(
  reportId: string,
  deps: DispatchDeps = { client: getAdminClient() },
): Promise<void> {
  await dispatchTriage(reportId, { ...deps, force: true, wait: true });
}
```

**Apply:** `force: true` bypasses `triage_next_attempt_at` backoff for citizen submit hot path. Reuse existing claim/update pattern; do not add a second claim mechanism. Keep `enqueueTriageDispatch` unchanged for officer/internal async paths.

---

### `src/server/triage/service.ts` + evaluator prompt (service, transform)

**Analog:** `runTriageForReport` + `src/server/ai/openai-compatible.ts` (`analyzeStructured`)

**Evaluator policy gate** (lines 298-337):

```typescript
const legacyAnalysis = structured.analysis;
const policyResult = validateEvaluatorPolicy(structured.evaluatorAnalysis, {
  description,
});
if (policyResult.ok) {
  await persistAttempt(deps, { /* disposition: "completed" */ });
  await finishRun(deps.client, runId, "completed");
  await applyTerminalRouting(deps, reportId, "completed", legacyAnalysis);
  return { reportId, disposition: "completed" };
}
await persistAttempt(deps, { disposition: "manual_review", /* ... */ });
await applyTerminalRouting(deps, reportId, "manual_review", legacyAnalysis);
```

**Structured provider call** — `openai-compatible.ts` (lines 267-286):

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
    max_tokens: 1200,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: buildUserContent(input, includeVision) },
    ],
    response_format: OPENAI_COMPATIBLE_RESPONSE_FORMAT,
  }),
});
```

**Evaluator config loader** — `evaluator.ts` (lines 12-31):

```typescript
export function loadEvaluatorConfig(configPath?: string): EvaluatorConfig {
  const absolutePath = path.resolve(
    process.cwd(),
    configPath ?? "prompt/citymind_ai_triage_structured_output_evaluator.json",
  );
  const raw = JSON.parse(readFileSync(absolutePath, "utf8")) as EvaluatorConfig;
  return raw;
}

export function buildEvaluatorSystemPrompt(configPath?: string): string {
  return loadEvaluatorConfig(configPath).system_prompt;
}
```

**Apply:** Phase 13 does not change triage internals — it **awaits** this pipeline on submit. Planner should reference `prompt/citymind_ai_triage_structured_output_evaluator.json` as single source for 11-key schema, system prompt, and `policy_assertions`. Routing runs inside `applyTerminalRouting` → `applyRoutingForReport` after disposition is known.

---

### `src/server/routing/*` (service + utility, transform)

**Analog:** `apply-routing.ts` + `policy.ts` + `playbooks.ts`

**Post-triage routing write** — `apply-routing.ts` (lines 13-45):

```typescript
export async function applyRoutingForReport(
  client: SupabaseClient,
  reportId: string,
  context: ApplyRoutingContext,
): Promise<void> {
  const triageStatus =
    context.disposition === "completed" ? "completed"
      : context.disposition === "manual_review" ? "manual_review" : "failed";

  const decision = evaluateRoutingPolicy({
    triageStatus,
    category: context.analysis?.category ?? null,
    severity: context.analysis?.severity ?? null,
    priority: context.analysis?.priority ?? null,
    confidence: context.analysis?.confidence ?? null,
  });

  await client.from("reports").update({
    routing_destination: decision.destination,
    routing_reason: decision.reasonCode,
    routing_policy_version: decision.policyVersion,
    routed_at: new Date().toISOString(),
  }).eq("report_id", reportId);
}
```

**Routing decision tree** — `policy.ts` (lines 27-46):

```typescript
if (input.triageStatus === "manual_review" || input.triageStatus === "failed") {
  return { ...base, destination: "government", reasonCode: "triage_manual_or_failed" };
}
if ((input.severity ?? 0) >= 4 || GOVERNMENT_PRIORITIES.has(input.priority ?? "")) {
  return { ...base, destination: "government", reasonCode: "severity_or_priority" };
}
if ((input.confidence ?? 0) < CONFIDENCE_GOV_THRESHOLD) {
  return { ...base, destination: "government", reasonCode: "low_confidence" };
}
if (SELF_HELP_CATEGORIES.has(input.category ?? "") && (input.severity ?? 99) <= 2) {
  return { ...base, destination: "self_help", reasonCode: "eligible_category_low_severity" };
}
return { ...base, destination: "government", reasonCode: "default_government" };
```

**Playbook id for coach** — `playbooks.ts` (lines 8-11):

```typescript
export function resolvePlaybookId(category: string | null): string | null {
  if (!category) return null;
  return PLAYBOOK_BY_CATEGORY[category] ?? null;
}
```

**Apply:** Citizen success UI branches on `service_step` / `routing_destination` from `projectCitizenTriageView`, which already encodes routing policy outcomes. Do not duplicate routing logic in UI.

---

### `src/server/services/citizen-status.ts` (`projectCitizenTriageView`, transform)

**Analog:** same function — citizen-facing projection layer

**Pending vs terminal branches** (lines 73-134):

```typescript
if (
  row.triage_status === "pending" ||
  row.triage_status === "processing" ||
  row.triage_status === "retry"
) {
  return { ...base, service_step: "ai_review_pending", category: null, /* ... */ };
}

if (row.triage_status === "failed" || row.triage_status === "manual_review") {
  return { ...base, service_step: "automated_review_unavailable", /* ... */ };
}

if (
  row.routing_destination === "self_help" &&
  row.status !== "resolved" &&
  row.status !== "rejected"
) {
  return {
    ...base,
    service_step: "self_help_guidance",
    category: row.category,
    playbook_id: resolvePlaybookId(row.category),
    can_escalate: true,
    /* summary, recommendation, severity, priority */
  };
}

return { ...base, service_step: "officer_review" /* or resolved/rejected */ };
```

**Apply:** `buildIntakeTriageOutcome` and success-page flash both consume this projection. Any new citizen fields for guided success must be added here first, then mapped through `ReportSubmissionResponse` and flash payload.

---

### `src/components/ReportForm.tsx` (component, request-response)

**Analog:** existing form — extended flash payload

**Submit + flash outcome** (lines 125-171):

```typescript
const res = await fetch("/api/public/reports", {
  method: "POST",
  body: formData,
});

const body = await res.json();

sessionStorage.setItem(
  FLASH_KEY,
  JSON.stringify({
    reportId,
    accessToken,
    outcome: {
      service_step: body.service_step ?? "ai_review_pending",
      triage_status: body.triage_status ?? "pending",
      routing_destination: body.routing_destination ?? null,
      category: body.category ?? null,
      severity: body.severity ?? null,
      priority: body.priority ?? null,
      summary: body.summary ?? null,
      recommendation: body.recommendation ?? null,
      playbook_id: body.playbook_id ?? null,
      can_escalate: body.can_escalate ?? false,
    },
  }),
);

router.push("/report/success");
```

**Loading copy** (line 332):

```typescript
{isSubmitting ? t("formAnalyzing") : t("submitReport")}
```

**Apply:** `formAnalyzing` / `successOutcome` i18n keys signal sync triage wait. Keep `FLASH_KEY = "citymind:report-success"` shared with success page. Do not poll from the form — server returns outcome in one round trip.

---

### `src/app/[locale]/report/success/page.tsx` (component, request-response)

**Analog:** Phase 11 success page + new immediate-outcome branch

**Flash consume** (lines 25-56):

```typescript
function consumeFlash(): FlashPayload | null {
  const raw = sessionStorage.getItem(FLASH_KEY);
  sessionStorage.removeItem(FLASH_KEY);
  // parse reportId + accessToken + outcome
}
```

**Immediate vs poll branch** (lines 119-155):

```typescript
const showImmediateOutcome =
  outcome &&
  outcome.service_step !== "ai_review_pending" &&
  outcome.triage_status !== "pending" &&
  outcome.triage_status !== "processing";

{showImmediateOutcome ? (
  <CitizenTriageOutcome
    reportId={reportId}
    accessToken={accessToken}
    outcome={outcome}
  />
) : (
  <SuccessTriagePanel reportId={reportId} accessToken={accessToken} />
)}
```

**Apply:** Phase 13 primary path is `CitizenTriageOutcome` when sync triage completes in submit handler. `SuccessTriagePanel` remains fallback for `pending`/`processing`/sync failure — same poll contract as Phase 11 (`POST /api/public/reports/status`, 2s then 5s interval, 120s timeout).

---

### `src/components/coach/CitizenTriageOutcome.tsx` (component, request-response)

**Analog:** `src/app/[locale]/status/page.tsx` branch UI + `CoachPanel` embed

**Service-step branches** (lines 70-87, 88-197):

```typescript
if (outcome.service_step === "automated_review_unavailable") {
  return (/* calm amber alert — tt("calmNoticeTitle") */);
}

if (outcome.service_step === "ai_review_pending") {
  return (/* poll timeout copy */);
}

const isSelfHelp = outcome.service_step === "self_help_guidance";

{isSelfHelp ? (
  <CoachPanel reportId={reportId} accessToken={accessToken} />
) : (
  <Alert>{/* government path + status link */}</Alert>
)}
```

**Apply:** New component for Phase 13 guided success. Reuse `public.successOutcome`, `public.triage`, `public.routing` namespaces. Government path: no coach-first (D-04 from Phase 11). Self-help: embed existing `CoachPanel` unchanged.

---

### `src/components/coach/SuccessTriagePanel.tsx` (component, request-response)

**Analog:** Phase 11 success polling — `src/app/[locale]/status/page.tsx` `lookupStatus`

**Poll loop** (lines 40-81):

```typescript
async function poll() {
  while (!cancelled) {
    if (elapsed > 120_000) { setTimedOut(true); return; }
    const res = await fetch("/api/public/reports/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: reportId, token: accessToken }),
    });
    if (res.ok) {
      const data = (await res.json()) as StatusResult;
      setResult(data);
      if (TERMINAL_TRIAGE.has(data.triage_status)) return;
    }
    await new Promise((resolve) => {
      window.setTimeout(resolve, elapsed > 30_000 ? 5_000 : 2_000);
    });
  }
}
```

**Apply:** Retain as fallback only. Phase 13 success page should hit this path rarely (sync failure or slow AI). Consider extracting shared poll hook if planner deduplicates with status page.

---

### `src/components/coach/CoachPanel.tsx` (component, request-response)

**Analog:** Phase 11/12 coach stack — unchanged embed

**Health gate + message load** (lines 40-77):

```typescript
const healthRes = await fetch("/api/health/ai");
setAiDown(health.status === "down");

const res = await fetch(`/api/public/reports/coach/messages?${params}`);
```

**Apply:** Embed from `CitizenTriageOutcome` when `service_step === "self_help_guidance"`. No Phase 13 changes required unless success-page-specific copy is needed.

---

### `src/app/api/public/reports/route.ts` (route, request-response)

**Analog:** thin delegate pattern

```typescript
import { handleSubmitReportRequest } from "@/server/services/report-service";

export async function POST(request: Request) {
  return handleSubmitReportRequest(request);
}
```

**Apply:** Route stays one-liner; all sync triage logic lives in `report-service.ts`.

---

### `messages/en.json` + `messages/vi.json` (config, transform)

**Analog:** `public.successOutcome` namespace (en.json lines 58-68)

```json
"successOutcome": {
  "eyebrow": "AI review",
  "title": "What we found",
  "advisoryNote": "Advisory only — a city officer makes the final decision.",
  "summaryLabel": "Summary",
  "pathSelfHelp": "Try these steps first",
  "pathGovernment": "Sent to city officers",
  "selfHelpNext": "You can try the safe steps below on your own...",
  "governmentNext": "Your report is in the officer review queue..."
},
"formAnalyzing": "Reviewing your report…"
```

**Apply:** Mirror all keys in `messages/vi.json`. Update `successBody` to reference immediate guidance. Follow Phase 11 nested namespace pattern (`public.coach`, `public.triage`, `public.routing`).

---

### `supabase/tests/13_phase13_contract.sql` + `package.json` (test/config)

**Analog:** `supabase/tests/11_phase11_contract.sql` + `phase12:gate`

**Assert helper** (11_phase11_contract.sql lines 5-14):

```sql
CREATE OR REPLACE FUNCTION _test_assert(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF NOT condition THEN
        RAISE EXCEPTION 'ASSERTION FAILED: %', message;
    END IF;
END;
$$;
```

**Proposed `phase13:gate`:**

```json
"phase13:gate": "npm run test:unit -- src/server/services/report-service.test.ts src/server/triage/dispatch.test.ts && node scripts/run-supabase-sql.mjs -f supabase/tests/13_phase13_contract.sql"
```

**Apply:** Contract tests should assert intake row exists after submit even when triage times out; `retry` status in CHECK constraint (`20260722170002_reports_triage_status_retry.sql`).

---

## Shared Patterns

### Synchronous triage orchestration (Phase 13 core)

**Source:** `src/server/services/report-service.ts` + `src/server/triage/dispatch.ts`
**Apply to:** Intake path only — officer/internal dispatch stays async

```typescript
await dispatchTriageAndWait(reportId, { client });
// on failure:
enqueueTriageDispatch(reportId);
const outcome = await buildIntakeTriageOutcome(client, reportId);
```

### Citizen outcome projection

**Source:** `src/server/services/citizen-status.ts` (`projectCitizenTriageView`)
**Apply to:** `buildIntakeTriageOutcome`, status API, success flash

```typescript
const view = projectCitizenTriageView(raw);
// service_step drives UI branch: self_help_guidance | officer_review | automated_review_unavailable
```

### Session flash handoff

**Source:** `src/components/ReportForm.tsx` + `src/app/[locale]/report/success/page.tsx`
**Apply to:** All post-submit citizen data

```typescript
const FLASH_KEY = "citymind:report-success";
sessionStorage.setItem(FLASH_KEY, JSON.stringify({ reportId, accessToken, outcome }));
// success page: consumeFlash() then removeItem
```

### Evaluator-spec triage (unchanged from Phase 11)

**Source:** `prompt/citymind_ai_triage_structured_output_evaluator.json` → `evaluator.ts` → `analyzeStructured` → `runTriageForReport`
**Apply to:** All triage runs including sync submit path

### Routing after triage completion

**Source:** `src/server/routing/apply-routing.ts` via `applyTerminalRouting` in triage service
**Apply to:** Determines `routing_destination` before citizen outcome is projected

### Coach embed on self-help only

**Source:** `src/components/coach/CitizenTriageOutcome.tsx` + `CoachPanel.tsx`
**Apply to:** `service_step === "self_help_guidance"` only; government path shows queue messaging

### Rate limiting + token auth (unchanged)

**Source:** `src/server/security/rate-limit.ts` + `src/server/security/access-tokens.ts`
**Apply to:** Submit (`enforceReportRateLimit`), status poll, coach messages

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/coach/CitizenTriageOutcome.tsx` (summary card UX) | component | request-response | No existing immediate post-submit triage summary card; closest is status page workflow + Phase 11 poll panel — compose from both |
| `src/server/triage/dispatch.test.ts` (`wait: true` path) | test | event-driven | Existing tests cover async fire-and-forget only; add `dispatchTriageAndWait` await test |

## Planning Artifact Templates

Use Phase 11/12 artifacts as structural templates for Phase 13 plans:

| Artifact | Template | Phase 13 adaptation |
|----------|----------|---------------------|
| `11-PATTERNS.md` | Intake enqueue → push dispatch | Replace with sync `dispatchTriageAndWait` + outcome in response |
| `11-04-PLAN.md` | Success poll primary | Flip: `CitizenTriageOutcome` primary, `SuccessTriagePanel` fallback |
| `12-PATTERNS.md` | Service test + gate script | Mirror `phase12:gate` for `report-service.test.ts` + contract SQL |
| `11-RESEARCH.md` §Architectural Responsibility Map | Layer ownership table | Update "Success/status polling UI" row to "sync submit + flash outcome" |

## Metadata

**Analog search scope:** `src/server/services/`, `src/server/triage/`, `src/server/routing/`, `src/server/ai/`, `src/server/services/citizen-status.ts`, `src/components/`, `src/app/[locale]/report/`, `src/app/api/public/reports/`, `prompt/`, `messages/`, `supabase/migrations/`, `supabase/tests/`, `.planning/phases/11-*`, `.planning/phases/12-*`
**Files scanned:** ~40
**Pattern extraction date:** 2026-07-22
