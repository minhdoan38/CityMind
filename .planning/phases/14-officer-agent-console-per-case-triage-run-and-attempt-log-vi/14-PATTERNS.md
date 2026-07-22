# Phase 14: Officer Agent Console — Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 16 new/modified files (hardening wave; core read path already shipped)
**Analogs found:** 15 / 16

## Phase Context

**Goal:** Harden and sign off the **officer triage audit console** — read-only inspection of `triage_runs` and `triage_attempts` per report case. Phase 14 is **verify and gate**, not greenfield (D-14-01).

**Delta from Phase 12/13:** Phase 12 shipped officer assistant chat + `phase12:gate` (vitest + legacy contract + SQL privilege deny). Phase 13 shipped sync citizen triage + `phase13:gate`. Phase 14 mirrors that gate composition for the **existing** agent console stack and adds UI polish (truncation notice D-14-15) plus DASH-11 traceability.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/repositories/triage-console.ts` | repository | CRUD (read) | same file (shipped) | exact |
| `src/server/services/officer-triage-console.ts` | service | request-response | `src/server/services/officer-assistant.ts` (GET/list branch) | exact |
| `src/app/api/officer/triage-console/route.ts` | route | request-response | `src/app/api/officer/assistant/messages/route.ts` | exact |
| `src/app/dashboard/agent-console/page.tsx` | component | request-response | `src/app/dashboard/agent-console/page.tsx` + dashboard pages using `requireOfficerSession` | exact |
| `src/components/dashboard/AgentConsoleViewer.tsx` | component | request-response | same file (shipped) + `AdvisoryAssistantWidget.tsx` (fetch/error) | exact |
| `src/components/DashboardSidebar.tsx` | component | — | existing nav (verify only) | exact |
| `src/app/dashboard/reports/[reportId]/page.tsx` | component | — | existing deep link (verify only) | exact |
| `src/server/repositories/triage-console.test.ts` (extend) | test | CRUD | same file + `officer-assistant-messages.test.ts` | exact |
| `src/server/services/officer-triage-console.test.ts` (new) | test | request-response | `src/server/services/officer-assistant.test.ts` | exact |
| `tests/agent-console-contract.test.mjs` (new) | test | batch | `tests/advisory-assistant-widget.test.mjs` + `tests/citizen-success-triage.test.mjs` | exact |
| `supabase/tests/14_phase14_contract.sql` (new) | test | transform | `supabase/tests/12_phase12_contract.sql` | exact |
| `package.json` (`phase14:gate`) | config | batch | `phase12:gate`, `phase13:gate` | exact |
| `messages/en.json`, `messages/vi.json` (modify) | config | transform | existing `dashboard.agentConsole` keys | exact |
| `14-UI-SPEC.md` (new) | config | transform | `12-UI-SPEC.md` | role-match |
| `14-VALIDATION.md` | config | transform | `13-VALIDATION.md` | exact |
| `.planning/REQUIREMENTS.md` (DASH-11) | config | transform | DASH-10 row + traceability | exact |
| `.planning/ROADMAP.md` | config | transform | Phase 12/13 ROADMAP entries | role-match |

## Pattern Assignments

### `src/server/repositories/triage-console.ts` (repository, CRUD read)

**Analog:** same file — already implements grouping + 50-run cap

**Imports + types** (lines 1-35):

```typescript
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type TriageConsoleCaseRow = {
  report_id: string;
  description: string | null;
  triage_status: string;
  category: string | null;
  runs: Array<TriageRunRow & { attempts: TriageAttemptRow[] }>;
};

const DEFAULT_RUN_LIMIT = 50;
```

**Three-query grouping pattern** (lines 37-130):

```typescript
export async function listTriageConsoleCases(
  client: SupabaseClient,
  options: { reportId?: string; runLimit?: number } = {},
): Promise<TriageConsoleCaseRow[]> {
  const runLimit = options.runLimit ?? DEFAULT_RUN_LIMIT;

  let runsQuery = client
    .from("triage_runs")
    .select("run_id, report_id, started_at, finished_at, final_disposition, prompt_version")
    .order("started_at", { ascending: false })
    .limit(runLimit);

  if (options.reportId?.trim()) {
    runsQuery = runsQuery.eq("report_id", options.reportId.trim());
  }

  const { data: runs, error: runsError } = await runsQuery;
  if (runsError) throw runsError;

  const runRows = (runs ?? []) as TriageRunRow[];
  if (!runRows.length) return [];

  const runIds = runRows.map((run) => run.run_id);
  const reportIds = [...new Set(runRows.map((run) => run.report_id))];

  const [{ data: attempts, error: attemptsError }, { data: reports, error: reportsError }] =
    await Promise.all([
      client.from("triage_attempts").select("...").in("run_id", runIds).order("created_at", { ascending: true }),
      client.from("reports").select("report_id, description, triage_status, category").in("report_id", reportIds),
    ]);

  // Map attempts by run_id, reports by report_id, fold into cases Map, sort by latest run started_at
}
```

**Apply:** No repository changes expected in Phase 14. Planner extends unit tests only — assert `reportId` filter calls `.eq()`, empty `runRows` returns `[]`, and `DEFAULT_RUN_LIMIT` is 50. FK integrity already covered in `supabase/tests/08_async_triage_contract.sql` §6 — do not duplicate in Phase 14 SQL.

---

### `src/server/services/officer-triage-console.ts` (service, request-response)

**Analog:** `src/server/services/officer-assistant.ts` — officer auth gate + admin client reads (no AI health/rate limit on read-only path)

**Officer auth + query param** (lines 28-47):

```typescript
export async function handleOfficerTriageConsoleRequest(
  request: Request,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const reportId = url.searchParams.get("report_id")?.trim() || undefined;

  try {
    const payload = await loadOfficerTriageConsole(reportId);
    return Response.json(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ detail: "Triage console lookup failed" }, { status: 502 });
  }
}
```

**Admin client loader** (lines 15-26):

```typescript
export async function loadOfficerTriageConsole(
  reportId?: string,
): Promise<TriageConsoleResponse> {
  const cases = await listTriageConsoleCases(getAdminClient(), { reportId });
  return { cases, generated_at: new Date().toISOString() };
}
```

**Apply:** Locked D-14-14 — keep `getAdminClient()` behind `requireOfficerContext()`; no officer RLS on audit tables. Do not add re-run, export, or shadow diff endpoints.

---

### `src/app/api/officer/triage-console/route.ts` (route, request-response)

**Analog:** `src/app/api/officer/assistant/messages/route.ts`

**Thin delegate** (lines 1-5):

```typescript
import { handleOfficerTriageConsoleRequest } from "@/server/services/officer-triage-console";

export async function GET(request: Request) {
  return handleOfficerTriageConsoleRequest(request);
}
```

**Apply:** Route stays one-liner; all auth and grouping logic lives in service + repository.

---

### `src/app/dashboard/agent-console/page.tsx` (component, request-response)

**Analog:** `src/app/dashboard/agent-console/page.tsx` + `src/lib/auth.ts` (`requireOfficerSession`)

**SSR officer gate + searchParams** (lines 10-28):

```typescript
export default async function AgentConsolePage({ searchParams }: Props) {
  await requireOfficerSession();
  const t = await getTranslations("dashboard.agentConsole");
  const params = await searchParams;
  const reportId = params.report_id?.trim() ?? "";

  return (
    <div className="w-full max-w-none space-y-6">
      <header className="dash-rise space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
          {t("pageTitle")}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground text-pretty">
          {t("pageSubtitle")}
        </p>
      </header>
      <AgentConsoleViewer initialReportId={reportId} />
    </div>
  );
}
```

**Auth helper** — `src/lib/auth.ts` (lines 41-45):

```typescript
export async function requireOfficerSession(): Promise<Session> {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  return claims;
}
```

**Apply:** D-14-03 standalone console; deep link via `?report_id=` only. No embedded log on report detail.

---

### `src/components/dashboard/AgentConsoleViewer.tsx` (component, request-response)

**Analog:** same file (shipped) + `AdvisoryAssistantWidget.tsx` (fetch/error/loading)

**Fetch officer API** (lines 63-86):

```typescript
const load = useCallback(async (reportId?: string) => {
  setLoading(true);
  setError(null);
  try {
    const params = new URLSearchParams();
    if (reportId?.trim()) {
      params.set("report_id", reportId.trim());
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/officer/triage-console${suffix}`);
    if (!res.ok) {
      setError(t("loadError"));
      setCases([]);
      return;
    }
    const body = (await res.json()) as { cases?: TriageConsoleCaseRow[] };
    setCases(body.cases ?? []);
  } catch {
    setError(t("loadError"));
    setCases([]);
  } finally {
    setLoading(false);
  }
}, [t]);
```

**Recent feed on mount** (lines 88-90):

```typescript
useEffect(() => {
  void load(initialReportId || undefined);
}, [initialReportId, load]);
```

**320-char preview + validation_errors warn block** (lines 362-409):

```typescript
const raw = attempt.raw_output ?? "";
const preview = raw.slice(0, 320);
const hasMore = raw.length > preview.length;

{Array.isArray(attempt.validation_errors) &&
attempt.validation_errors.length > 0 ? (
  <pre className="agent-console-log-warn overflow-x-auto p-2.5 whitespace-pre-wrap">
    {formatValidationErrors(attempt.validation_errors)}
  </pre>
) : null}
<pre className="max-w-[75ch] overflow-x-auto whitespace-pre-wrap text-[0.8125rem] leading-relaxed">
  {expanded ? raw || t("noOutput") : preview || t("noOutput")}
</pre>
{hasMore ? (
  <button type="button" className="agent-console-log-action ..." onClick={() => toggleAttempt(attempt.attempt_id)}>
    {expanded ? t("collapseOutput") : t("expandOutput")}
  </button>
) : null}
```

**Truncated case list IDs** (line 261):

```typescript
{item.report_id.slice(0, 8)}…
```

**Phase 14 polish delta (D-14-15)** — add after stats row, when unfiltered:

```tsx
{!filter.trim() ? (
  <p className="text-sm text-muted-foreground" role="note">
    {t("truncationNotice")}
  </p>
) : null}
```

**Optional empty-state split** (Claude discretion): use `emptyFiltered` when `filter.trim()` and `emptyRecent` when unfiltered — mirror Phase 13 copy polish pattern.

**Terminal styling** — `src/app/globals.css` (lines 259-293):

```css
.agent-console-log {
  border-radius: var(--radius-md);
  background: var(--console-surface);
  font-family: var(--font-code);
}
.agent-console-log-warn {
  background: var(--console-surface-raised);
  color: var(--console-warn);
}
```

**Apply:** D-14-05 raw_output primary (no 11-key parser). D-14-16 — no assistant chat imports or `/api/officer/assistant/messages` fetch.

---

### `src/components/DashboardSidebar.tsx` + report detail deep link (verify only)

**Analog:** existing wiring — legacy contract asserts, no code changes expected

**Sidebar nav** — `DashboardSidebar.tsx` (lines 102-107):

```typescript
{
  title: tSidebar('agentConsole'),
  url: '/dashboard/agent-console',
  icon: Terminal,
  active: pathname === '/dashboard/agent-console',
},
```

**Report detail link** — `src/app/dashboard/reports/[reportId]/page.tsx` (lines 288-293):

```typescript
<Link
  href={`/dashboard/agent-console?report_id=${encodeURIComponent(report.report_id)}`}
  className="text-sm font-medium text-primary hover:underline"
>
  {tt("detailAgentConsoleLink")}
</Link>
```

**Apply:** D-14-11 — entry points unchanged; no table context menu or quick-preview tab.

---

### `src/server/repositories/triage-console.test.ts` (test, CRUD — extend)

**Analog:** existing file + `src/server/repositories/officer-assistant-messages.test.ts` (mock chain)

**Existing grouping test** (lines 6-91):

```typescript
const client = {
  from: vi.fn((table: string) => {
    if (table === "triage_runs") {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: runs, error: null }),
        eq: vi.fn().mockReturnThis(),
      };
    }
    // triage_attempts, reports ...
  }),
};

const cases = await listTriageConsoleCases(client as never);
expect(cases[0]?.report_id).toBe("case-a");
expect(cases[0]?.runs[0]?.attempts).toHaveLength(1);
```

**Phase 14 additions:**
- `reportId` filter: assert `.eq("report_id", "case-a")` called when option set
- Empty runs: mock `limit` returning `{ data: [], error: null }` → `[]`
- Export `DEFAULT_RUN_LIMIT` or assert limit(50) via mock call args

---

### `src/server/services/officer-triage-console.test.ts` (test, request-response — new)

**Analog:** `src/server/services/officer-assistant.test.ts` (401 + success envelope)

**Mock setup** (officer-assistant.test.ts lines 1-13, 67-73):

```typescript
const requireOfficerContext = vi.fn();
const listTriageConsoleCases = vi.fn();

vi.mock("@/server/officer/guard", () => ({
  requireOfficerContext: () => requireOfficerContext(),
}));

vi.mock("@/server/repositories/triage-console", () => ({
  listTriageConsoleCases: (...args: unknown[]) => listTriageConsoleCases(...args),
}));
```

**401 test** (officer-assistant.test.ts lines 132-146):

```typescript
it("returns 401 when unauthenticated", async () => {
  requireOfficerContext.mockResolvedValue({
    ok: false,
    response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
  });

  const response = await handleOfficerTriageConsoleRequest(
    new Request("http://localhost/api/officer/triage-console"),
  );

  expect(response.status).toBe(401);
});
```

**200 envelope test** (proposed):

```typescript
it("returns grouped cases JSON for authenticated officer", async () => {
  requireOfficerContext.mockResolvedValue(officerContext);
  listTriageConsoleCases.mockResolvedValue([{ report_id: "case-a", runs: [], /* ... */ }]);

  const response = await handleOfficerTriageConsoleRequest(
    new Request("http://localhost/api/officer/triage-console?report_id=case-a"),
  );

  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.cases).toHaveLength(1);
  expect(body.generated_at).toBeTruthy();
  expect(listTriageConsoleCases).toHaveBeenCalledWith(expect.anything(), { reportId: "case-a" });
});
```

**502 test** (mirror service catch block):

```typescript
it("returns 502 when repository throws", async () => {
  requireOfficerContext.mockResolvedValue(officerContext);
  listTriageConsoleCases.mockRejectedValue(new Error("db down"));

  const response = await handleOfficerTriageConsoleRequest(
    new Request("http://localhost/api/officer/triage-console"),
  );

  expect(response.status).toBe(502);
  expect((await response.json()).detail).toBe("Triage console lookup failed");
});
```

---

### `tests/agent-console-contract.test.mjs` (test, batch — new)

**Analog:** `tests/advisory-assistant-widget.test.mjs` + `tests/citizen-success-triage.test.mjs`

**File read helper** (advisory-assistant-widget.test.mjs lines 1-10):

```javascript
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), "utf8");
}
```

**Assertions to include** (from RESEARCH gap analysis):

```javascript
test("AgentConsoleViewer fetches officer triage console API", () => {
  const src = read("src/components/dashboard/AgentConsoleViewer.tsx");
  assert.ok(src.includes('fetch(`/api/officer/triage-console'));
});

test("AgentConsoleViewer uses 320-char preview and expand/collapse", () => {
  const src = read("src/components/dashboard/AgentConsoleViewer.tsx");
  assert.ok(src.includes("raw.slice(0, 320)"));
  assert.ok(src.includes("expandOutput") && src.includes("collapseOutput"));
});

test("AgentConsoleViewer shows validation_errors warn block before raw output", () => {
  const src = read("src/components/dashboard/AgentConsoleViewer.tsx");
  assert.ok(src.includes("agent-console-log-warn"));
  assert.ok(src.includes("validation_errors"));
});

test("DashboardSidebar links agent console route", () => {
  const src = read("src/components/DashboardSidebar.tsx");
  assert.ok(src.includes("'/dashboard/agent-console'"));
});

test("Report detail deep-links agent console with report_id", () => {
  const src = read("src/app/dashboard/reports/[reportId]/page.tsx");
  assert.ok(src.includes("/dashboard/agent-console?report_id="));
});

test("Agent console page requires officer session", () => {
  const src = read("src/app/dashboard/agent-console/page.tsx");
  assert.ok(src.includes("requireOfficerSession"));
});

test("truncationNotice i18n key exists EN/VI", () => {
  const en = JSON.parse(read("messages/en.json"));
  const vi = JSON.parse(read("messages/vi.json"));
  assert.ok(en.dashboard.agentConsole.truncationNotice);
  assert.ok(vi.dashboard.agentConsole.truncationNotice);
});
```

**Apply:** Wave 2 updates legacy test when `truncationNotice` ships. Contract must **not** assert assistant API paths (D-14-16 boundary).

---

### `supabase/tests/14_phase14_contract.sql` (test, transform — new)

**Analog:** `supabase/tests/12_phase12_contract.sql`

**Assert helper** (12_phase12_contract.sql lines 9-17):

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

**Prerequisite check** (adapt table names):

```sql
DO $$
BEGIN
    IF to_regclass('public.triage_runs') IS NULL THEN
        RAISE EXCEPTION 'Missing public.triage_runs. Apply migration 20260722120002_async_triage_audit.sql.';
    END IF;
END;
$$;
```

**Privilege deny pattern** (12_phase12_contract.sql lines 39-55 — adapt for `triage_runs` + `triage_attempts`):

```sql
DO $$
DECLARE
    v_report_id text := 'test-phase14-audit-' || gen_random_uuid()::text;
    v_run_id uuid;
    v_attempt_id uuid;
BEGIN
  -- Insert fixture via service_role (create_intake_report + triage_runs + triage_attempts)
  -- Or use complete_triage_report RPC if simpler

  BEGIN
    SET LOCAL ROLE anon;
    PERFORM 1 FROM public.triage_runs WHERE run_id = v_run_id LIMIT 1;
    RAISE EXCEPTION 'anon must not read triage_runs';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM 1 FROM public.triage_attempts WHERE attempt_id = v_attempt_id LIMIT 1;
    RAISE EXCEPTION 'authenticated must not read triage_attempts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Cleanup fixture rows
END;
$$;
```

**Migration grants reference** — `20260722120002_async_triage_audit.sql` (lines 31-34):

```sql
REVOKE ALL ON TABLE public.triage_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.triage_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.triage_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.triage_attempts TO service_role;
```

**Apply:** Privilege deny only — FK smoke stays in Phase 8 contract per RESEARCH discretion.

---

### `package.json` (`phase14:gate`) (config, batch)

**Analog:** `phase12:gate`, `phase13:gate` (package.json lines 20-21)

**Phase 12 composition:**

```json
"phase12:gate": "npm run test:unit -- src/server/repositories/officer-assistant-messages.test.ts src/server/services/officer-assistant.test.ts src/server/ai/officer-assistant.test.ts && npm run test:legacy -- tests/advisory-assistant-widget.test.mjs && node scripts/run-supabase-sql.mjs -f supabase/tests/12_phase12_contract.sql"
```

**Phase 13 composition:**

```json
"phase13:gate": "npm run test:unit -- src/server/services/report-service.test.ts src/server/triage/dispatch.test.ts && npm run test:legacy -- tests/citizen-success-triage.test.mjs tests/report-form.test.mjs && node scripts/run-supabase-sql.mjs -f supabase/tests/13_phase13_contract.sql"
```

**Proposed `phase14:gate`:**

```json
"phase14:gate": "npm run test:unit -- src/server/repositories/triage-console.test.ts src/server/services/officer-triage-console.test.ts && npm run test:legacy -- tests/agent-console-contract.test.mjs && node scripts/run-supabase-sql.mjs -f supabase/tests/14_phase14_contract.sql"
```

**Apply:** D-14-02 full phase gate — vitest slice → legacy contract → SQL contract. Document SQL skip when `SUPABASE_DB_URL` unset in SUMMARY (mirror Phase 13).

---

### `messages/en.json` + `messages/vi.json` (config, transform)

**Analog:** existing `dashboard.agentConsole` namespace (en.json lines 260-284)

**Existing keys:**

```json
"agentConsole": {
  "pageTitle": "Agent console",
  "pageSubtitle": "Audit log for triage agent runs and attempts on each report case. Advisory output only — officers decide.",
  "filterLabel": "Filter by report ID",
  "loadError": "Could not load agent console logs. Try again.",
  "empty": "No triage agent activity found for this filter.",
  "expandOutput": "Show full output",
  "collapseOutput": "Show less"
}
```

**Phase 14 additions:**

```json
"truncationNotice": "Showing the latest 50 triage runs. Older activity may not appear.",
"emptyFiltered": "No triage agent activity found for this report ID.",
"emptyRecent": "No triage agent activity recorded yet."
```

**Apply:** Mirror all new keys in `messages/vi.json`. i18n namespace: `useTranslations("dashboard.agentConsole")` (AgentConsoleViewer line 54).

---

### `14-UI-SPEC.md` (config, transform — new)

**Analog:** `12-UI-SPEC.md` frontmatter + design system table

**Frontmatter pattern** (12-UI-SPEC.md lines 1-18):

```markdown
---
phase: 14
slug: officer-agent-console-per-case-triage-run-and-attempt-log-vi
status: draft
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables
created: 2026-07-22
inherits: .planning/phases/03-dashboard-polish/03-UI-SPEC.md
sources:
  - 14-CONTEXT.md (D-14-01..16)
  - src/components/dashboard/AgentConsoleViewer.tsx (live implementation)
  - src/app/globals.css (.agent-console-log*)
requirements:
  - DASH-11 (officer agent console)
ui_safety_gate: true
---
```

**Contract areas:** desktop-first two-column layout (`lg:grid-cols`), filter + recent feed, truncation notice (D-14-15), raw_output monospace terminal, validation_errors warn block, 320-char expand, truncated UUID in list / full ID in header, advisory disclaimer in `pageSubtitle`, empty/loading/error states, EN/VI keys, no shadow panel / no re-run actions.

---

### `14-VALIDATION.md` + `.planning/REQUIREMENTS.md` (config, transform)

**Analog:** `13-VALIDATION.md` + DASH-10 REQUIREMENTS row

**VALIDATION wave structure** (14-VALIDATION.md already drafted):

- Wave 1: vitest + legacy + SQL
- Wave 2: UI-SPEC file exists + legacy truncation assert
- Wave 3: `grep DASH-11`, `grep Phase 14`, `npm run phase14:gate`
- Human UAT-1..6 checklist

**DASH-11 REQUIREMENTS pattern** (mirror DASH-10, lines 116-121):

```markdown
- [ ] **DASH-11**: Officer **agent console** — per-case triage run and attempt log viewer; read-only audit of `triage_runs`/`triage_attempts`; officer session gate; bilingual EN/VI; 50-run cap with truncation notice
  - **DASH-11a**: `GET /api/officer/triage-console` — `requireOfficerContext`, admin client reads, generic 502
  - **DASH-11b**: `AgentConsoleViewer` — raw output primary, validation_errors warn, 320-char expand
  - **DASH-11c**: Entry points — sidebar nav + report detail deep link `?report_id=`
  - **DASH-11d**: SQL contract — anon/authenticated cannot read audit tables
  - **DASH-11e**: Automated tests — service 401/502, repo grouping, legacy wiring contract
```

Traceability row: `| DASH-11 | Phase 14 | Pending |`

---

## Shared Patterns

### Phase N Gate Script (mirror Phase 12/13)

**Source:** `package.json` `phase12:gate`, `phase13:gate`
**Apply to:** `phase14:gate` in Wave 1

```
vitest (repo + service tests) → legacy static contract → SQL privilege contract
```

### Officer Authentication (API)

**Source:** `src/server/officer/guard.ts`
**Apply to:** `handleOfficerTriageConsoleRequest`

```typescript
const auth = await requireOfficerContext();
if (!auth.ok) return auth.response;
```

### Officer Session Gate (SSR page)

**Source:** `src/lib/auth.ts` (`requireOfficerSession`)
**Apply to:** `agent-console/page.tsx`, all `/dashboard/*` via `proxy.ts` (AUTH-04)

```typescript
await requireOfficerSession(); // redirects to /login when unauthenticated
```

### Admin Client for Service-Role-Only Tables

**Source:** `src/lib/supabase/admin.ts` + `officer-triage-console.ts`
**Apply to:** All audit table reads (D-14-14 locked)

```typescript
const cases = await listTriageConsoleCases(getAdminClient(), { reportId });
```

Tables revoked from anon/authenticated in migration `20260722120002_async_triage_audit.sql`.

### Generic 502 on DB Errors

**Source:** `src/server/services/officer-triage-console.ts` (lines 45-47)
**Apply to:** Service handler catch — no stack traces to client

```typescript
} catch {
  return Response.json({ detail: "Triage console lookup failed" }, { status: 502 });
}
```

### Legacy Static Contract (dashboard wiring)

**Source:** `tests/advisory-assistant-widget.test.mjs`
**Apply to:** `tests/agent-console-contract.test.mjs`

Read source files with `fs.readFileSync`; assert fetch paths, nav links, i18n keys, presentation patterns — no browser.

### SQL Privilege Contract (service-role-only tables)

**Source:** `supabase/tests/12_phase12_contract.sql`
**Apply to:** `14_phase14_contract.sql` for `triage_runs` + `triage_attempts`

Insert fixture as service_role → `SET LOCAL ROLE anon` / `authenticated` → expect `insufficient_privilege`.

### Dashboard i18n Namespace

**Source:** `AgentConsoleViewer.tsx` (line 54)
**Apply to:** All console copy

```typescript
const t = useTranslations("dashboard.agentConsole");
```

### Read-Only Audit Presentation

**Source:** `AgentConsoleViewer.tsx` + `globals.css` `.agent-console-log*`
**Apply to:** Log panel only — no write actions, no structured field parser (D-14-05)

### Separation from Phase 12 Assistant

**Source:** D-14-16 in CONTEXT.md
**Apply to:** All Phase 14 files — triage audit console only; `AdvisoryAssistantWidget` and `/api/officer/assistant/messages` out of scope

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *(none)* | — | — | Phase 14 is hardening of shipped console; all deliverables have close analogs in Phases 8/12/13 gate stack |

## Planning Artifact Templates

| Artifact | Template | Phase 14 adaptation |
|----------|----------|---------------------|
| `12-PATTERNS.md` | Officer service + legacy widget contract | Replace assistant with triage console read path |
| `13-PATTERNS.md` | `phase13:gate` three-part composition | Same chain for `phase14:gate` |
| `12_phase12_contract.sql` | anon/authenticated privilege deny | Adapt table names to `triage_runs`/`triage_attempts` |
| `13-VALIDATION.md` | Per-plan gates + UAT-1..N | Already drafted as `14-VALIDATION.md` |
| `12-UI-SPEC.md` | Dashboard UI contract frontmatter | Agent console terminal styling + truncation notice |

## Metadata

**Analog search scope:** `src/components/dashboard/`, `src/server/repositories/triage-console.ts`, `src/server/services/officer-triage-console.ts`, `src/app/api/officer/triage-console/`, `src/app/dashboard/agent-console/`, `tests/advisory-assistant-widget.test.mjs`, `tests/citizen-success-triage.test.mjs`, `supabase/tests/12_phase12_contract.sql`, `supabase/migrations/20260722120002_async_triage_audit.sql`, `package.json`, `messages/`, `.planning/phases/12-*`, `.planning/phases/13-*`
**Files scanned:** ~30
**Pattern extraction date:** 2026-07-22
