# Phase 9: Self-help vs Government Routing - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 24 new/modified files
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/routing/policy.ts` | utility | transform | `src/server/validation/analysis-policy.ts` | exact |
| `src/server/routing/policy.test.ts` | test | transform | `src/server/validation/analysis-policy.test.ts` | exact |
| `src/server/routing/playbooks.ts` | utility | transform | `messages/en.json` (`public.statusWorkflow`) + `src/server/triage/config.ts` | role-match |
| `src/server/routing/apply-routing.ts` | service | CRUD | `src/server/triage/audit.ts` (`recordTriageAttempt` RPC) | role-match |
| `supabase/migrations/20260722130001_routing_columns.sql` | migration | CRUD | `supabase/migrations/20260722120001_async_triage_intake.sql` | exact |
| `supabase/tests/09_routing_contract.sql` | test | batch | `supabase/tests/08_async_triage_contract.sql` | exact |
| `src/server/triage/service.ts` | service | event-driven + transform | itself (`runTriageForReport` exit paths) | exact |
| `src/server/services/citizen-status.ts` | service | request-response | itself (`projectCitizenTriageView`) | exact |
| `src/server/services/citizen-escalate.ts` (optional split) | service | request-response | `src/server/services/citizen-status.ts` | exact |
| `src/app/api/public/reports/escalate/route.ts` | route | request-response | `src/app/api/public/reports/status/route.ts` | exact |
| `src/app/api/officer/reports/[reportId]/routing/route.ts` | route | request-response | `src/app/api/officer/reports/[reportId]/status/route.ts` | exact |
| `src/server/repositories/reports.ts` | repository | CRUD | itself (`applyReportFilters`, `getCitizenStatus`, `updateReportStatus`) | exact |
| `src/server/officer/filters.ts` | utility | transform | itself (`VALID_TRIAGE_STATUSES`, `parseReportFilters`) | exact |
| `src/components/reports/types.ts` | model | — | itself (`FILTER_PARAM_KEYS`, `ReportRow`) | exact |
| `src/components/reports/RoutingDestinationBadge.tsx` | component | — | `src/components/reports/TriageStatusBadge.tsx` | exact |
| `src/components/reports/ReportsTable.tsx` | component | CRUD (read) | itself (`TriageStatusBadge` column) | exact |
| `src/components/reports/ReportsFilters.tsx` | component | — | itself (`TRIAGE_FILTER_CHIPS`) | exact |
| `src/server/services/officer-dashboard.ts` | service | CRUD | itself (`toReportRow`, `searchParamsFromDashboard`) | exact |
| `src/app/[locale]/status/page.tsx` | component | request-response | itself (conditional AI block + workflow stepper) | exact |
| `src/app/dashboard/reports/[reportId]/page.tsx` | component | CRUD (read) | itself + `src/components/StatusActions.tsx` | role-match |
| `messages/en.json` + `messages/vi.json` | config | — | `public.statusWorkflow` + `dashboard.triage` keys | exact |
| `src/server/services/citizen-status.test.ts` | test | — | itself | exact |
| `src/server/repositories/reports.test.ts` | test | — | itself | exact |
| `src/server/triage/service.test.ts` | test | — | `report-service.test.ts` (mocked deps) | role-match |

## Pattern Assignments

### `src/server/routing/policy.ts` — deterministic routing rules (D-17, D-21..D-24)

**Analog:** `src/server/validation/analysis-policy.ts`

**Imports pattern** (lines 1-10):

```typescript
import type { ReportAnalysis } from "../domain/report-analysis";

export type PolicyViolation = {
  code: string;
  message: string;
};

export type PolicyResult =
  | { ok: true }
  | { ok: false; violations: PolicyViolation[] };
```

**Pure function + semver constant pattern** (mirror lines 26-27, 73-75, 77-185):

```typescript
const CONFLICT_CONFIDENCE_CAP = 0.64;

function violation(code: string, message: string): PolicyViolation {
  return { code, message };
}

export function validateAnalysisPolicy(
  analysis: ReportAnalysis,
  options: { description?: string } = {},
): PolicyResult {
  const violations: PolicyViolation[] = [];
  // ... ordered guard clauses, early returns via violations array
  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true };
}
```

**Routing policy shape to copy:**

```typescript
export const ROUTING_POLICY_VERSION = "1.0.0";

export type RoutingDestination = "self_help" | "government";

export type RoutingDecision = {
  destination: RoutingDestination;
  reasonCode: string;
  policyVersion: typeof ROUTING_POLICY_VERSION;
};

export function evaluateRoutingPolicy(input: {
  triageStatus: string;
  category: string | null;
  severity: number | null;
  priority: string | null;
  confidence: number | null;
}): RoutingDecision {
  const base = { policyVersion: ROUTING_POLICY_VERSION };
  // Ordered rules: manual_review/failed → government; severity≥4 or high/critical → government;
  // confidence < 0.65 → government; eligible category + severity≤2 → self_help; else government
}
```

Reuse `CONFLICT_CONFIDENCE_CAP = 0.64` from analysis-policy (line 27) as `CONFIDENCE_GOV_THRESHOLD = 0.65` for routing (D-24). Keep function pure — no DB, no side effects.

---

### `src/server/routing/policy.test.ts`

**Analog:** `src/server/validation/analysis-policy.test.ts`

**Fixture helper** (lines 6-18):

```typescript
function validAnalysis(overrides: Partial<ReportAnalysis> = {}): ReportAnalysis {
  return {
    category: "pothole",
    severity: 4,
    confidence: 0.82,
    // ...
    ...overrides,
  };
}
```

**Matrix test pattern** (lines 64-72, 125-131):

```typescript
it("rejects critical priority without severity 5", () => {
  const result = validateAnalysisPolicy(
    validAnalysis({ priority: "critical", severity: 4 }),
  );
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.violations.some((v) => v.code === "critical_requires_severity_5")).toBe(true);
  }
});

it("is deterministic and does not mutate or override officer decisions", () => {
  const analysis = validAnalysis();
  const first = validateAnalysisPolicy(analysis);
  const second = validateAnalysisPolicy(analysis);
  expect(first).toEqual(second);
});
```

Add one test per D-21..D-24 rule; include `graffiti` forward-compat case per RESEARCH Pitfall 3.

---

### `src/server/routing/playbooks.ts` — static category → playbook catalog (D-05..D-07)

**Analog:** `messages/en.json` (`public.statusWorkflow`, lines 112-118) + `src/server/triage/config.ts` (`PROMPT_VERSION` constant pattern)

**i18n key pattern** (messages/en.json lines 112-118):

```json
"statusWorkflow": {
  "title": "Service progress",
  "stepReceived": "Report received",
  "stepAiPending": "AI review pending",
  "stepOfficerReview": "Under officer review",
  "stepResolved": "Resolved",
  "stepRejected": "Rejected"
}
```

**Recommended split:**

```typescript
// playbooks.ts — IDs and category mapping only (no citizen-facing strings)
export const PLAYBOOK_BY_CATEGORY: Record<string, string> = {
  pothole: "pothole",
  waste: "waste",
  streetlight: "streetlight",
  graffiti: "graffiti",
};

export function resolvePlaybookId(category: string | null): string | null {
  if (!category) return null;
  return PLAYBOOK_BY_CATEGORY[category] ?? null;
}
```

Store EN/VI title, 3–5 step bullets, optional links under `public.routing.playbooks.{id}.*` in `messages/en.json` + `messages/vi.json`. Server returns `playbook_id` only; client resolves via `useTranslations("public.routing.playbooks")`.

---

### `src/server/routing/apply-routing.ts` — persist routing decision (D-18..D-20)

**Analog:** `src/server/triage/audit.ts` (`recordTriageAttempt` RPC call, lines 44-71)

**RPC / update pattern:**

```typescript
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateRoutingPolicy } from "./policy";

export async function applyRoutingForReport(
  client: SupabaseClient,
  reportId: string,
  context: {
    triageStatus: string;
    category: string | null;
    severity: number | null;
    priority: string | null;
    confidence: number | null;
  },
): Promise<void> {
  const decision = evaluateRoutingPolicy(context);

  const { error } = await client
    .from("reports")
    .update({
      routing_destination: decision.destination,
      routing_reason: decision.reasonCode,
      routing_policy_version: decision.policyVersion,
      routed_at: new Date().toISOString(),
    })
    .eq("report_id", reportId);

  if (error) throw error;
}
```

Prefer `apply_routing_for_report` SECURITY DEFINER RPC if escalate/override need atomic status_events side-effects (mirror `update_report_with_status_event` in `20260721130003_officer_operations.sql`).

---

### `src/server/triage/service.ts` — post-triage worker hook (D-01, D-20, D-23)

**Analog:** itself — terminal exit paths after `finishRun`

**Hook insertion points** (lines 252-253, 315-316, 342-343):

```typescript
await finishRun(deps.client, runId, "completed");
// INSERT: await applyRoutingForReport(deps.client, reportId, { triageStatus: "completed", ...structured.analysis });
return { reportId, disposition: "completed" };

// failed path (lines 252-253):
await finishRun(deps.client, runId, "failed");
// INSERT: await applyRoutingForReport(..., { triageStatus: "failed", category: null, ... });

// manual_review path (lines 342-343):
await finishRun(deps.client, runId, "manual_review");
// INSERT: await applyRoutingForReport(..., { triageStatus: "manual_review", ... });
```

Also hook `handleInfraFailure` terminal paths (lines 220-224). Inject `applyRoutingForReport` via `TriageServiceDeps` for unit tests (same pattern as `finishTriageRun?: typeof finishTriageRun` at line 49). Do **not** route on `pending`/`processing` — `routing_destination` stays NULL until terminal disposition.

---

### `src/server/services/citizen-status.ts` — self-help projection (D-08..D-12)

**Analog:** itself (`projectCitizenTriageView`, lines 52-109)

**Existing triage gating** (lines 69-91):

```typescript
if (row.triage_status === "pending" || row.triage_status === "processing") {
  return {
    ...base,
    service_step: "ai_review_pending",
    category: null,
    severity: null,
    priority: null,
    summary: null,
    recommendation: null,
  };
}
```

**Extend for self-help path** (after triage completed branch):

```typescript
export type CitizenServiceStep =
  | "received"
  | "ai_review_pending"
  | "self_help_guidance"   // new (D-10)
  | "officer_review"
  | "resolved"
  | "rejected"
  | "automated_review_unavailable";

// After triage completed, before government officer_review:
if (
  row.routing_destination === "self_help" &&
  row.status !== "resolved" &&
  row.status !== "rejected"
) {
  return {
    ...base,
    service_step: "self_help_guidance",
    category: null,
    severity: null,
    priority: null,
    summary: null,
    recommendation: null,
    playbook_id: resolvePlaybookId(row.category),
    can_escalate: row.routing_destination === "self_help",
  };
}
```

Extend `CitizenStatusRawPayload` + `getCitizenStatus` select with `routing_destination`. Never expose `routing_reason` or `routing_policy_version` to citizens (RESEARCH Pitfall 4).

**Auth handler to mirror for escalate** (lines 111-127, 129-177):

```typescript
export async function lookupCitizenStatus(body: CitizenStatusRequest, client = getAdminClient()) {
  const tokenHash = hashAccessToken(body.token);
  const tokenRow = await getAccessTokenByHash(client, tokenHash);
  if (!tokenBindsReport(tokenRow, body.report_id)) {
    throw citizenStatusUnauthorized();
  }
  // ...
}

export async function handleCitizenStatusRequest(request: Request, options = {}) {
  const rateLimit = enforceStatusRateLimit(rateLimitRequest);
  if (rateLimit) {
    return Response.json({ detail: rateLimit.detail }, { status: rateLimit.status, headers: { "Retry-After": rateLimit.retryAfter } });
  }
  // Zod parse → lookup → jsonErrorResponse on HttpError
}
```

---

### `src/app/api/public/reports/escalate/route.ts` — citizen escalate (D-11, D-12)

**Analog:** `src/app/api/public/reports/status/route.ts` + `handleCitizenStatusRequest`

**Thin route delegate** (status/route.ts lines 1-5):

```typescript
import { handleCitizenEscalateRequest } from "@/server/services/citizen-escalate";

export async function POST(request: Request) {
  return handleCitizenEscalateRequest(request);
}
```

**Handler pattern:** Same Zod body `{ report_id, token }`; `hashAccessToken` + `tokenBindsReport`; uniform 401; `enforceStatusRateLimit` (or dedicated `escalate:{ip}` key). Mutation: `routing_destination = 'government'`, `routing_reason = 'citizen_escalated'`, append `status_events` note — **no new token** (D-12). Return updated citizen-safe projection via `projectCitizenTriageView`.

---

### `src/app/api/officer/reports/[reportId]/routing/route.ts` — officer override (D-14)

**Analog:** `src/app/api/officer/reports/[reportId]/status/route.ts` + `officer-write.ts`

**Route delegate** (status/route.ts lines 1-8):

```typescript
import { handleOfficerRoutingOverrideRequest } from "@/server/services/officer-write";

type RouteContext = { params: Promise<{ reportId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { reportId } = await context.params;
  return handleOfficerRoutingOverrideRequest(request, reportId);
}
```

**Officer guard + validation** (officer-write.ts lines 19-70):

```typescript
export async function handleUpdateReportStatusRequest(request: Request, reportId: string) {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const status = searchParams.get("status");
  // validate → getOfficerReport → updateReportStatus via RPC
}
```

Override actions: `escalate_to_government` (flip `routing_destination`) and `mark_resolved` (reuse `updateReportStatus` with note). Extend `StatusActions.tsx` or add `RoutingActions.tsx` for self-help-routed reports only.

---

### `src/server/repositories/reports.ts` — filters, citizen select, escalate RPC

**Analog:** itself

**Citizen select extension** (lines 63-67):

```typescript
.select(
  "report_id, created_at, triage_status, current_status, category, severity, priority, summary, recommendation",
)
```

Add `routing_destination` to select and `CitizenStatusRawPayload`.

**Officer default filter** (extend `applyReportFilters`, lines 320-331):

```typescript
function applyReportFilters(query: any, filters: ReportFilters) {
  if (filters.status != null) query = query.eq("current_status", filters.status);
  if (filters.triage_status?.length) {
    query = query.in("triage_status", filters.triage_status);
  }
  // NEW — D-03: NULL routing = government-visible
  if (filters.routing_scope === "government_default" || filters.routing_scope == null) {
    query = query.or("routing_destination.is.null,routing_destination.eq.government");
  } else if (filters.routing_scope === "self_help") {
    query = query.eq("routing_destination", "self_help");
  }
  // "all" → no routing filter
  return query;
}
```

**Triage bucket sort — preserve** (lines 302-317, 369-392): Keep `sort === "triage_bucket"` path unchanged; routing filter applies before bucket sort (D-16).

**Status update RPC** (lines 673-694):

```typescript
export async function updateReportStatus(client, params) {
  const { data, error } = await client.rpc("update_report_with_status_event", {
    p_report_id: params.reportId,
    p_status: params.status,
    p_note: params.note,
    p_actor_id: params.actorId,
  });
  if (error) throw error;
  return { report_id: String(payload.report_id), status: String(payload.status), updated: true };
}
```

Add `escalateReportToGovernment(client, { reportId, reasonCode, note? })` calling new RPC.

---

### `src/server/officer/filters.ts` + `src/components/reports/types.ts` — routing filter param

**Analog:** `VALID_TRIAGE_STATUSES` + `parseTriageStatusFilter` (lines 31-37, 121-128)

```typescript
export const VALID_ROUTING_SCOPES = new Set([
  "government_default",
  "self_help",
  "all",
] as const);

export type ReportFilters = {
  // ...existing
  routing_scope?: "government_default" | "self_help" | "all" | null;
};

export function parseRoutingScopeFilter(value: string | null): ReportFilters["routing_scope"] {
  if (value == null || value.trim() === "") return "government_default"; // D-13 default
  if (value === "self_help" || value === "all") return value;
  return "government_default";
}
```

**types.ts FILTER_PARAM_KEYS** (lines 63-72) — add `"routing_scope"`; extend `ReportRow`:

```typescript
export type ReportRow = {
  // ...existing
  routing_destination?: string | null;
};
```

---

### `src/components/reports/RoutingDestinationBadge.tsx` (D-15)

**Analog:** `src/components/reports/TriageStatusBadge.tsx`

**Variant + i18n pattern** (lines 14-50):

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function routingVariant(
  destination: string | null,
): "outline" | "secondary" {
  if (destination === "self_help") return "secondary";
  return "outline";
}

export default function RoutingDestinationBadge({
  destination,
  className,
}: {
  destination: string | null;
  className?: string;
}) {
  const t = useTranslations("dashboard.routing");
  if (!destination) return <span aria-hidden>—</span>;
  const label =
    destination === "self_help" ? t("badgeSelfHelp") : t("badgeGovernment");
  return (
    <Badge variant={routingVariant(destination)} className={cn("capitalize", className)}>
      {label}
    </Badge>
  );
}
```

Add `dashboard.routing.badgeSelfHelp` / `badgeGovernment` keys in messages catalogs.

---

### `src/components/reports/ReportsTable.tsx` — destination column (D-15)

**Analog:** itself — `TriageStatusBadge` column (lines 146-152)

```typescript
import RoutingDestinationBadge from "./RoutingDestinationBadge";

{
  accessorKey: "routing_destination",
  header: tr("columnHeader"),
  enableSorting: false,
  cell: ({ getValue }) => (
    <RoutingDestinationBadge destination={(getValue() as string | null) ?? null} />
  ),
},
```

Place after `triage_status` column. Extend `toReportRow` in `officer-dashboard.ts` (lines 28-39) to pass `routing_destination`.

---

### `src/components/reports/ReportsFilters.tsx` — routing scope chip (D-13)

**Analog:** `TRIAGE_FILTER_CHIPS` (lines 41-46, 108-149)

```typescript
const ROUTING_FILTER_CHIPS = [
  { key: "government", param: null },           // default: government + unrouted
  { key: "selfHelp", param: "self_help" },
  { key: "all", param: "all" },
] as const;

function setRoutingChip(param: string | null) {
  const next = currentParams();
  if (!param) {
    next.delete("routing_scope");
  } else {
    next.set("routing_scope", param);
  }
  navigate(next);
}
```

Mirror chip button styling from triage chips (lines 137-148): `variant={active ? "default" : "outline"}`, `aria-pressed`, `disabled={pending}`.

---

### `src/app/[locale]/status/page.tsx` — playbook + escalate CTA (D-09..D-11)

**Analog:** itself

**Conditional AI reveal** (lines 255-256, 366-423):

```typescript
const showCalmNotice = result?.service_step === "automated_review_unavailable";
const showAiBlock = result?.triage_status === "completed";

// Change to:
const showAiBlock =
  result?.triage_status === "completed" && result?.service_step !== "self_help_guidance";
const showPlaybook =
  result?.service_step === "self_help_guidance" && result?.playbook_id;
```

**Workflow steps — adapt for self-help** (lines 72-86, 242-253):

```typescript
function stepIndexForServiceStep(serviceStep: ServiceStep): number {
  switch (serviceStep) {
    case "received": return 0;
    case "ai_review_pending": return 1;
    case "self_help_guidance": return 2;  // guidance available (no officer step)
    case "automated_review_unavailable":
    case "officer_review": return 2;
    case "resolved":
    case "rejected": return 3;
    default: return 0;
  }
}

// Self-help workflow: received → guidance available → resolved (3 steps, not 4)
const workflowSteps =
  result?.service_step === "self_help_guidance"
    ? [
        { id: "received", label: tw("stepReceived") },
        { id: "guidance", label: tw("stepGuidanceAvailable") },
        { id: "terminal", label: tw("stepResolved") },
      ]
    : [ /* existing 4-step government path */ ];
```

**Escalate CTA** — POST to `/api/public/reports/escalate` with same `report_id` + `token`; on success refresh `result` state. Copy: `public.routing.escalateCta` = *"Still need city help?"* (bilingual).

---

### `src/app/dashboard/reports/[reportId]/page.tsx` — destination badge + override UI

**Analog:** itself (TriageStatusBadge at line 217) + `StatusActions.tsx`

```typescript
<TriageStatusBadge triageStatus={report.triage_status} />
<RoutingDestinationBadge destination={report.routing_destination ?? null} />
```

Show `RoutingActions` when `routing_destination === "self_help"` — mirror `StatusActions` fetch pattern (lines 37-70):

```typescript
const res = await fetch(`/api/officer/reports/${reportId}/routing?action=escalate`, {
  method: "PATCH",
});
```

---

### `supabase/migrations/20260722130001_routing_columns.sql` (D-18, D-19)

**Analog:** `supabase/migrations/20260722120001_async_triage_intake.sql` (lines 3-28)

**Additive columns + CHECK** (intake migration lines 3-24):

```sql
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS routing_destination TEXT,
    ADD COLUMN IF NOT EXISTS routing_reason TEXT,
    ADD COLUMN IF NOT EXISTS routing_policy_version TEXT,
    ADD COLUMN IF NOT EXISTS routed_at TIMESTAMPTZ;

ALTER TABLE public.reports
    DROP CONSTRAINT IF EXISTS reports_routing_destination_chk;

ALTER TABLE public.reports
    ADD CONSTRAINT reports_routing_destination_chk
    CHECK (routing_destination IS NULL OR routing_destination IN ('self_help', 'government'));

CREATE INDEX IF NOT EXISTS reports_routing_destination_idx
    ON public.reports (routing_destination)
    WHERE routing_destination IS NOT NULL;
```

**Escalate RPC** — mirror `update_report_with_status_event` grant pattern (`20260721130003_officer_operations.sql` lines 66-67):

```sql
CREATE OR REPLACE FUNCTION public.escalate_report_to_government(
    p_report_id text,
    p_token_hash text,
    p_reason text DEFAULT 'citizen_escalated'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;

REVOKE ALL ON FUNCTION public.escalate_report_to_government(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_report_to_government(text, text, text) TO service_role;
```

---

### `supabase/tests/09_routing_contract.sql`

**Analog:** `supabase/tests/08_async_triage_contract.sql` (lines 1-76)

**Assert helper + DO block** (lines 4-13, 16-46):

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
    v_report_id text := 'test-routing-' || gen_random_uuid()::text;
BEGIN
    -- seed completed triage report
    -- assert routing columns populated after apply
    -- assert escalate flips destination to government, token unchanged
    -- assert manual_review/failed never NULL routing_destination
    DELETE FROM public.reports WHERE report_id = v_report_id;
END;
$$;

DROP FUNCTION IF EXISTS _test_assert(boolean, text);
```

Run via: `node scripts/run-supabase-sql.mjs supabase/tests/09_routing_contract.sql`

---

### Test extensions

#### `src/server/services/citizen-status.test.ts`

**Analog:** itself (lines 48-91)

```typescript
it("returns self_help_guidance with null AI fields when routing_destination is self_help", () => {
  const payload = projectCitizenTriageView({
    ...base,
    triage_status: "completed",
    routing_destination: "self_help",
    status: "new",
  });
  expect(payload.service_step).toBe("self_help_guidance");
  expect(payload.summary).toBeNull();
  expect(payload.category).toBeNull();
  expect(payload).not.toHaveProperty("routing_reason");
});
```

#### `src/server/repositories/reports.test.ts`

**Analog:** `listRecentReports` chain mock — assert `.or("routing_destination.is.null,routing_destination.eq.government")` called when `routing_scope` is default.

#### `src/server/triage/service.test.ts`

Mock `applyRoutingForReport` in deps; assert called after `completed`, `manual_review`, and `failed` dispositions; assert **not** called mid-retry.

---

## Shared Patterns

### Citizen token validation (CIT-03)

**Source:** `src/server/services/citizen-status.ts` (lines 115-119)
**Apply to:** escalate handler, status lookup

```typescript
const tokenHash = hashAccessToken(body.token);
const tokenRow = await getAccessTokenByHash(client, tokenHash);
if (!tokenBindsReport(tokenRow, body.report_id)) {
  throw citizenStatusUnauthorized();
}
```

### Rate limiting (CIT-04)

**Source:** `src/server/services/citizen-status.ts` (lines 136-150)
**Apply to:** escalate endpoint

```typescript
const rateLimit = enforceStatusRateLimit(rateLimitRequest);
if (rateLimit) {
  return Response.json(
    { detail: rateLimit.detail },
    { status: rateLimit.status, headers: { "Retry-After": rateLimit.retryAfter } },
  );
}
```

### Officer session guard (AUTH-04)

**Source:** `src/server/services/officer-write.ts` (lines 23-24)
**Apply to:** routing override route

```typescript
const auth = await requireOfficerContext();
if (!auth.ok) return auth.response;
```

### Error responses

**Source:** `src/server/http/errors.ts` via `jsonErrorResponse` / `citizenStatusUnauthorized()`
**Apply to:** all new API handlers

### Atomic Postgres RPC + audit

**Source:** `supabase/migrations/20260721130003_officer_operations.sql` (lines 42-56)
**Apply to:** escalate + officer routing override with `status_events` note

```sql
UPDATE public.reports SET current_status = p_status WHERE report_id = p_report_id;
INSERT INTO public.status_events (report_id, status, note, actor_id) VALUES (...);
```

### Bilingual copy (PUB-02)

**Source:** `messages/en.json` + `messages/vi.json`
**Apply to:** playbook steps, escalate CTA, routing badges, self-help workflow step labels

### Officer default queue (D-03, D-13)

**Source:** `applyReportFilters` extension above
**Apply to:** `listRecentReports`, `getReportsSummary`, geo pins, export — all officer list paths

```typescript
query = query.or("routing_destination.is.null,routing_destination.eq.government");
```

### Hide AI on self-help (D-08, PRODUCT.md)

**Source:** `projectCitizenTriageView` null-field pattern (citizen-status.ts lines 69-78)
**Apply to:** citizen API + status page `showAiBlock` guard

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `escalate_report_to_government` RPC | migration | CRUD | No token-validated routing mutation RPC exists; compose from `create_intake_report_with_access_token` grant style + `update_report_with_status_event` audit |
| Citizen escalate handler | service | request-response | No flip-destination mutation exists; mirror status handler shape (closest partial match) |
| Self-help 3-step workflow stepper | component | — | Phase 8 stepper is 4-step government-only; adapt `stepIndexForServiceStep` locally |
| `RoutingActions` officer component | component | request-response | No routing-specific actions; extend `StatusActions.tsx` or split new component using same fetch pattern |

---

## Metadata

**Analog search scope:** `src/server/routing/` (new), `src/server/validation/`, `src/server/triage/`, `src/server/services/`, `src/server/repositories/`, `src/server/officer/`, `src/app/api/public/`, `src/app/api/officer/`, `src/components/reports/`, `src/app/[locale]/status/`, `src/app/dashboard/reports/`, `messages/`, `supabase/migrations/`, `supabase/tests/`
**Files scanned:** ~165 TS/TSX + 18 SQL + message catalogs
**Pattern extraction date:** 2026-07-22
