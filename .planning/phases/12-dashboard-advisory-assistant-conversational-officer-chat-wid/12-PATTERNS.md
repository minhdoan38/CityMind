# Phase 12: Dashboard Advisory Assistant — Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/repositories/officer-assistant-messages.ts` | repository | CRUD | `src/server/repositories/chat-messages.ts` | exact |
| `supabase/migrations/*_officer_assistant_messages.sql` | migration | transform | `supabase/migrations/20260722160003_chat_messages.sql` | exact |
| `supabase/tests/12_phase12_contract.sql` | test | transform | `supabase/tests/11_phase11_contract.sql` | exact |
| `src/server/services/officer-assistant.ts` | service | request-response | `src/server/services/citizen-coach.ts` | exact |
| `src/server/ai/officer-assistant.ts` | utility | transform | `src/server/ai/coach.ts` | exact |
| `src/app/api/officer/assistant/messages/route.ts` | route | request-response | `src/app/api/public/reports/coach/messages/route.ts` | exact |
| `src/components/dashboard/widgets/AdvisoryAssistantWidget.tsx` | component | request-response | `src/components/coach/CoachPanel.tsx` + self | partial |
| `src/server/services/officer-assistant.test.ts` | test | request-response | `src/server/services/officer-assistant.test.ts` + `citizen-escalate.test.ts` | exact |
| `src/server/ai/officer-assistant.test.ts` | test | transform | `src/server/ai/coach.test.ts` | exact |
| `messages/en.json` | config | transform | existing `dashboard.widgets.assistant*` keys | exact |
| `messages/vi.json` | config | transform | existing `dashboard.widgets.assistant*` keys | exact |
| `.planning/REQUIREMENTS.md` | config | transform | DASH-09 row in same file | exact |
| `package.json` | config | batch | `phase11:gate` script | exact |
| `12-UI-SPEC.md` | config | transform | `.planning/phases/03-dashboard-polish/03-UI-SPEC.md` | role-match |

## Pattern Assignments

### `src/server/repositories/officer-assistant-messages.ts` (repository, CRUD)

**Analog:** `src/server/repositories/chat-messages.ts`

Mirror the coach repository shape but key by `officer_user_id` instead of `report_id`. Add optional `report_id` column on insert for attach audit.

**Imports pattern** (lines 1-3):

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatMessageRole = "user" | "assistant" | "system";
```

**Row type + list pattern** (lines 5-37) — adapt `report_id` → `officer_user_id`, add `report_id?: string | null`:

```typescript
export type ChatMessageRow = {
  message_id: string;
  report_id: string;
  role: ChatMessageRole;
  content: string;
  created_at: string;
  model: string | null;
  latency_ms: number | null;
};

export async function listChatMessagesByReportId(
  client: SupabaseClient,
  reportId: string,
): Promise<ChatMessageRow[]> {
  const { data, error } = await client
    .from("chat_messages")
    .select("message_id, report_id, role, content, created_at, model, latency_ms")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }
  // ... map rows with String() coercion
}
```

**Insert pattern** (lines 40-75):

```typescript
export async function insertChatMessage(
  client: SupabaseClient,
  input: {
    reportId: string;
    role: ChatMessageRole;
    content: string;
    model?: string | null;
    latencyMs?: number | null;
  },
): Promise<ChatMessageRow> {
  const { data, error } = await client
    .from("chat_messages")
    .insert({ report_id: input.reportId, role: input.role, content: input.content, ... })
    .select("message_id, report_id, role, content, created_at, model, latency_ms")
    .single();
  // ...
}
```

**Count pattern** (lines 77-94) — optional for officer daily cap; key by `officer_user_id`:

```typescript
export async function countChatMessagesLast24h(
  client: SupabaseClient,
  reportId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await client
    .from("chat_messages")
    .select("message_id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .gte("created_at", since);
  // ...
}
```

---

### `supabase/migrations/*_officer_assistant_messages.sql` (migration, transform)

**Analog:** `supabase/migrations/20260722160003_chat_messages.sql`

**Table + RLS revoke pattern** (lines 3-19):

```sql
CREATE TABLE IF NOT EXISTS public.chat_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    model TEXT,
    latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS chat_messages_report_id_created_at_idx
    ON public.chat_messages (report_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_messages TO service_role;
```

**Phase 12 adaptations:**
- Table name: `officer_assistant_messages`
- `officer_user_id UUID NOT NULL` (FK to `auth.users` optional; index required)
- `report_id TEXT NULL REFERENCES public.reports(report_id) ON DELETE SET NULL` (attach audit only)
- `content` max 2000 to match `MAX_MESSAGE_LENGTH` in service
- Index: `(officer_user_id, created_at)`
- Same RLS: service_role only — officers never query table directly; app uses service role via repository

---

### `supabase/tests/12_phase12_contract.sql` (test, transform)

**Analog:** `supabase/tests/11_phase11_contract.sql` (section 2, lines 80-108)

**Assert helper** (lines 5-14):

```sql
CREATE OR REPLACE FUNCTION _test_assert(condition boolean, message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT condition THEN
        RAISE EXCEPTION 'ASSERTION FAILED: %', message;
    END IF;
END;
$$;
```

**Anon cannot read pattern** (lines 96-103):

```sql
BEGIN
    SET LOCAL ROLE anon;
    PERFORM 1 FROM public.chat_messages WHERE report_id = v_report_id LIMIT 1;
    RAISE EXCEPTION 'anon must not read chat_messages';
EXCEPTION
    WHEN insufficient_privilege THEN
        NULL;
END;
```

**Phase 12 contract:** Insert fixture row into `officer_assistant_messages`; assert `anon` and `authenticated` cannot `SELECT`; cleanup fixture.

---

### `src/server/services/officer-assistant.ts` (service, request-response)

**Analog:** `src/server/services/citizen-coach.ts` (persistence flow) + existing `officer-assistant.ts` (auth/rate/health)

**Officer auth + rate limit** (existing, lines 56-70):

```typescript
export async function handleOfficerAssistantMessageRequest(
  request: Request,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) {
    return auth.response;
  }

  const rateLimited = enforceOfficerAssistantRateLimit(
    { headers: request.headers },
    auth.context.session.userId,
  );
  if (rateLimited) {
    return rateLimited;
  }
```

**Health gate** (existing, lines 84-91):

```typescript
const health = await checkAiHealth(env);
if (health.body.status === "down") {
  return Response.json(
    { detail: "AI assistant is temporarily unavailable." },
    { status: 503 },
  );
}
```

**Server-authoritative send flow** (mirror `sendCoachMessage`, citizen-coach.ts lines 128-177):

```typescript
export async function sendCoachMessage(
  body: z.infer<typeof CoachSendSchema>,
  client: SupabaseClient = getAdminClient(),
): Promise<{ assistant_message: ...; messages: ... }> {
  const health = await checkAiHealth();
  if (health.body.status === "down") {
    throw new HttpError(503, "Coach is temporarily unavailable.");
  }
  // ... authorize + eligibility ...

  const history = await listChatMessagesByReportId(client, body.report_id);
  await insertChatMessage(client, { reportId: body.report_id, role: "user", content: body.message.trim() });

  const reply = await generateCoachReply({ context: buildCoachReportContext(row), history, userMessage: body.message.trim() });

  const assistant = await insertChatMessage(client, { reportId: body.report_id, role: "assistant", content: reply.content, model: reply.model, latencyMs: reply.latencyMs });

  const messages = await listChatMessagesByReportId(client, body.report_id);
  return { assistant_message: serializeMessage(assistant), messages: messages.map(serializeMessage) };
}
```

**Report attach + 404** (mirror `handleReportDetailRequest`, officer-read.ts lines 167-174):

```typescript
const report = await getOfficerReport(auth.context.client, reportId);
if (!report) {
  return Response.json({ detail: "Report not found" }, { status: 404 });
}
```

**GET handler pattern** (mirror `handleCitizenCoachRequest` GET branch, citizen-coach.ts lines 191-218):

```typescript
if (request.method === "GET") {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;
  const messages = await listOfficerAssistantMessages(getAdminClient(), auth.context.session.userId);
  return Response.json({ messages: messages.map(serializeMessage) }, { status: 200 });
}
```

**Schema change:** Remove client `history` from `OfficerAssistantRequestSchema`; add optional `report_id: z.string().min(1).max(64).optional()`.

---

### `src/server/ai/officer-assistant.ts` (utility, transform)

**Analog:** `src/server/ai/coach.ts`

**System prompt + reply** (existing officer-assistant.ts lines 10-58) — extend `generateOfficerAssistantReply` input with optional `reportContext: OfficerReportContext | null`.

**Context block builder** (coach.ts lines 36-51):

```typescript
function buildCoachContextBlock(context: CoachReportContext): string {
  const facts =
    context.observedFacts.length > 0
      ? context.observedFacts.map((fact) => `- ${fact}`).join("\n")
      : "- No observed facts recorded.";
  return [
    `report_id: ${context.reportId}`,
    `routing_destination: ${context.routingDestination ?? "unknown"}`,
    `category: ${context.category ?? "unknown"}`,
  ].join("\n");
}
```

**Report context from evaluator** (coach.ts lines 75-101):

```typescript
export function buildCoachReportContext(row: Record<string, unknown>): CoachReportContext {
  const evaluator = projectEvaluatorAnalysis({
    category: (row.category as string | null) ?? null,
    severity: (row.severity as number | null) ?? null,
    // ... all evaluator columns ...
  });

  return {
    reportId: String(row.report_id ?? ""),
    routingDestination: (row.routing_destination as string | null) ?? null,
    category: evaluator.category,
    observedFacts: evaluator.observed_facts,
    recommendedAction: evaluator.recommended_action,
    playbookId: resolvePlaybookId(evaluator.category),
  };
}
```

**Phase 12 `buildOfficerReportContext`:** Use `projectEvaluatorAnalysis` + officer fields (`status`, `triage_status`, `routing_destination`, `severity`, `priority`, `observed_facts`). Append context to system message like coach:

```typescript
{ role: "system", content: `${OFFICER_ASSISTANT_SYSTEM_PROMPT}\n\nReport context:\n${contextBlock}` }
```

---

### `src/app/api/officer/assistant/messages/route.ts` (route, request-response)

**Analog:** `src/app/api/public/reports/coach/messages/route.ts`

**Thin route delegating to service** (coach route, lines 1-9):

```typescript
import { handleCitizenCoachRequest } from "@/server/services/citizen-coach";

export async function GET(request: Request) {
  return handleCitizenCoachRequest(request);
}

export async function POST(request: Request) {
  return handleCitizenCoachRequest(request);
}
```

**Phase 12:** Add `GET` export; optionally split `handleOfficerAssistantListRequest` vs `handleOfficerAssistantMessageRequest` or unify in one handler with method branch (coach pattern).

---

### `src/components/dashboard/widgets/AdvisoryAssistantWidget.tsx` (component, request-response)

**Analog:** `src/components/coach/CoachPanel.tsx` (mount + persisted history) + self (widget chrome)

**Health poll** (existing widget, lines 32-52):

```typescript
const refreshHealth = useCallback(async () => {
  try {
    const res = await fetch("/api/health/ai");
    if (!res.ok) { setAiStatus("down"); return; }
    const body = (await res.json()) as { status?: AiHealthStatus };
    setAiStatus(body.status ?? "down");
  } catch { setAiStatus("down"); }
}, []);
```

**P12-D-04 fix:** Change `aiUnavailable` from `down || unknown` to `down` only (align CoachPanel line 49):

```typescript
// CoachPanel.tsx
setAiDown(health.status === "down");
```

**Mount: load persisted history** (CoachPanel lines 40-77):

```typescript
useEffect(() => {
  let cancelled = false;
  async function load() {
    const healthRes = await fetch("/api/health/ai");
    // ... set aiDown ...
    const res = await fetch(`/api/officer/assistant/messages`);
    if (!res.ok) { if (!cancelled) setError(t("assistantError")); return; }
    const data = (await res.json()) as { messages?: CoachMessage[] };
    if (!cancelled) setMessages(Array.isArray(data.messages) ? data.messages : []);
  }
  void load();
  return () => { cancelled = true; };
}, [t]);
```

**Send without client history** (CoachPanel lines 87-98):

```typescript
const res = await fetch("/api/officer/assistant/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, report_id: attachedReportId ?? undefined }),
});
```

**Keep widget-specific UI:** `WidgetCard`, `.assistant-sphere`/`.assistant-orbit` empty state, pill input bar, optimistic user bubble + draft restore on error (existing lines 76-113).

---

### `src/server/services/officer-assistant.test.ts` (test, request-response)

**Analog:** existing file + `src/server/services/citizen-escalate.test.ts` (429)

**Mock setup** (existing, lines 1-53):

```typescript
const requireOfficerContext = vi.fn();
const checkAiHealth = vi.fn();
const generateOfficerAssistantReply = vi.fn();

vi.mock("@/server/officer/guard", () => ({
  requireOfficerContext: () => requireOfficerContext(),
}));
```

**429 rate limit test** (citizen-escalate.test.ts lines 95-126):

```typescript
it("returns 429 with Retry-After for rate limit violations", async () => {
  vi.stubEnv("STATUS_RATE_LIMIT_PER_MINUTE", "1");
  const first = await handleCitizenEscalateRequest(new Request(...), { client });
  const second = await handleCitizenEscalateRequest(new Request(...), { client });
  expect(first.status).toBe(200);
  expect(second.status).toBe(429);
  expect(second.headers.get("Retry-After")).toBe("60");
});
```

**Phase 12 additions:**
- 429: call `handleOfficerAssistantMessageRequest` twice with same officer; use `resetOfficerAssistantLimiter()` in `beforeEach`
- Persistence: mock repository; assert `listOfficerAssistantMessages` called instead of client `history`
- 404 attach: mock `getOfficerReport` returning null → 404

---

### `src/server/ai/officer-assistant.test.ts` (test, transform)

**Analog:** `src/server/ai/coach.test.ts`

**Context builder unit test** (coach.test.ts lines 6-22):

```typescript
it("builds report context from evaluator columns", () => {
  const context = buildCoachReportContext({
    report_id: "report-1",
    routing_destination: "self_help",
    category: "pothole",
    observed_facts: ["Pothole near curb."],
    // ...
  });
  expect(context.observedFacts).toContain("Pothole near curb.");
});
```

**Provider message shape test** (coach.test.ts lines 24-68):

```typescript
const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
  messages: Array<{ role: string; content: string }>;
};
const system = body.messages.find((message) => message.role === "system")?.content ?? "";
expect(system).toContain(COACH_SYSTEM_PROMPT);
expect(system).toContain("report_id: report-1");
```

**Phase 12:** Test `buildOfficerReportContext` + assert `OFFICER_ASSISTANT_SYSTEM_PROMPT` and officer fields (`triage_status`, `severity`) appear in system message when context attached.

---

### `messages/en.json` + `messages/vi.json` (config, transform)

**Analog:** existing `dashboard.widgets.assistant*` keys (en.json lines 423+)

Add keys only if new UX surfaces (degraded hint, attach enabled, load error). Keep EN/VI parity. Existing keys: `assistantTitle`, `assistantDisclaimer`, `assistantUnavailable`, `assistantPlaceholder`, `assistantError`, `assistantThinking`, `assistantAttach`, `assistantAttachSoon`, `assistantVoice`, `assistantVoiceSoon`, `assistantSend`, `assistantHint`.

---

### `.planning/REQUIREMENTS.md` (config, transform)

**Analog:** DASH-09 entry (line 110) + traceability row (line 222)

```markdown
- [ ] **DASH-09**: Officer dashboard **AI status chip** from health ping; per-row **Run triage now** quick action for pending/failed/retry reports
```

Add DASH-10 with sub-behaviors DASH-10a–e per RESEARCH.md; traceability row `| DASH-10 | Phase 12 | Pending |`.

---

### `package.json` (config, batch)

**Analog:** `phase11:gate` script (line 19)

```json
"phase11:gate": "npm run test:unit -- src/server/domain ... src/server/ai/coach.test.ts ... && node scripts/run-supabase-sql.mjs -f supabase/tests/11_phase11_contract.sql"
```

**Proposed `phase12:gate`:**

```json
"phase12:gate": "npm run test:unit -- src/server/services/officer-assistant.test.ts src/server/ai/officer-assistant.test.ts && node scripts/run-supabase-sql.mjs -f supabase/tests/12_phase12_contract.sql"
```

---

### `12-UI-SPEC.md` (config, transform)

**Analog:** `.planning/phases/03-dashboard-polish/03-UI-SPEC.md`

**Frontmatter pattern** (lines 1-17):

```markdown
---
phase: 3
slug: dashboard-polish
status: approved
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables
created: 2026-07-20
inherits: .planning/phases/02-public-experience/02-UI-SPEC.md
---
```

**Design system table** (lines 27-36): product register, shadcn, lucide-react, Source Sans 3.

**Phase 12 contract areas** (from RESEARCH UI-SPEC Needs): placement in insights rail, empty-state sphere animation (`globals.css` `.assistant-sphere`), thread bubbles, health down/degraded, attach v1.1, i18n keys, advisory disclaimer, error `role="alert"`.

---

## Shared Patterns

### Officer Authentication

**Source:** `src/server/officer/guard.ts`
**Apply to:** API route, service handlers

```typescript
export async function requireOfficerContext(): Promise<
  { ok: true; context: OfficerContext } | { ok: false; response: Response }
> {
  const session = await getClaims();
  if (!session) {
    return {
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    };
  }
  const client = await createClient();
  return { ok: true, context: { session, client } };
}
```

### AI Health Gating

**Source:** `src/server/health/ai-readiness.ts` + `src/app/api/health/ai/route.ts`
**Apply to:** Service POST handlers, widget health poll

```typescript
// Service: block send when down
const health = await checkAiHealth(env);
if (health.body.status === "down") {
  return Response.json({ detail: "AI assistant is temporarily unavailable." }, { status: 503 });
}

// Route: 503 response body for down
const status = result.body.status === "down" ? 503 : 200;
return Response.json(result.body, { status, headers: { "Cache-Control": "private, max-age=30" } });
```

### Rate Limiting

**Source:** `src/server/services/officer-assistant.ts` (lines 36-54)
**Apply to:** Officer assistant POST/GET

```typescript
const key = `officer-assistant:${officerId}`;
if (!officerAssistantLimiter.allow(key, limit)) {
  return Response.json(
    { detail: "Too many assistant requests. Try again shortly." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
```

### Evaluator Projection for Report Context

**Source:** `src/server/domain/analysis-projection.ts`
**Apply to:** `buildOfficerReportContext` in `officer-assistant.ts`

```typescript
import { projectEvaluatorAnalysis } from "@/server/domain/analysis-projection";
const evaluator = projectEvaluatorAnalysis(row);
// Use evaluator.category, evaluator.severity, evaluator.observed_facts, etc.
```

### Officer Report Read (IDOR-safe attach)

**Source:** `src/server/repositories/reports.ts` + `src/server/services/officer-read.ts`
**Apply to:** Report attach in officer-assistant service

```typescript
const report = await getOfficerReport(auth.context.client, reportId);
if (!report) {
  return Response.json({ detail: "Report not found" }, { status: 404 });
}
```

Use `auth.context.client` (officer RLS), not `getAdminClient()`, for report load on attach path.

### Conversational AI Completion

**Source:** `src/server/ai/openai-compatible.ts`
**Apply to:** `generateOfficerAssistantReply`

```typescript
const result = await completeConversationalChat(
  { env, fetchImpl: options.fetchImpl },
  messages,
);
return result.content;
```

### Provider Error Handling

**Source:** `src/server/services/officer-assistant.ts` (lines 102-110)

```typescript
} catch (error) {
  if (error instanceof AnalysisProviderError) {
    return Response.json(
      { detail: "Assistant request failed. Try again later." },
      { status: 502 },
    );
  }
  return Response.json({ detail: "Assistant request failed." }, { status: 502 });
}
```

### Widget i18n

**Source:** `AdvisoryAssistantWidget.tsx` (line 24)

```typescript
const t = useTranslations("dashboard.widgets");
```

Dashboard layout already provides `NextIntlClientProvider` — no layout changes needed.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *(none)* | — | — | All Phase 12 files have close analogs in Phase 11 coach stack or existing MVP |

## Metadata

**Analog search scope:** `src/server/repositories/`, `src/server/services/`, `src/server/ai/`, `src/app/api/`, `src/components/coach/`, `src/components/dashboard/widgets/`, `supabase/migrations/`, `supabase/tests/`, `messages/`, `.planning/`
**Files scanned:** ~25
**Pattern extraction date:** 2026-07-22
