# Phase 3: Dashboard Polish - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 19
**Analogs found:** 17 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/app/dashboard/page.tsx` | route | request-response | `frontend/src/app/dashboard/page.tsx` (self — replace cards) | exact |
| `frontend/src/components/reports/ReportsTable.tsx` | component | request-response | `frontend/src/components/dashboard/ReportCard.tsx` + list page | role-match |
| `frontend/src/components/reports/ReportsFilters.tsx` | component | request-response | `frontend/src/app/dashboard/page.tsx` (filter chrome absent; message keys exist) | partial |
| `frontend/src/components/reports/ReportsMetrics.tsx` | component | request-response | `backend/app/api/reports.py` `/summary` + dashboard message keys | partial |
| `frontend/src/components/reports/ExportButton.tsx` | component | streaming | `frontend/src/components/StatusActions.tsx` (client fetch + error) | role-match |
| `frontend/src/app/api/officer/reports/export/route.ts` | route | streaming | `frontend/src/app/api/officer/reports/[reportId]/image/route.ts` | exact |
| `frontend/src/app/dashboard/reports/[reportId]/page.tsx` | route | request-response | same file (reorder sections) | exact |
| `frontend/src/components/StatusActions.tsx` | component | request-response | same file + status BFF route | exact |
| `frontend/src/components/DashboardSidebar.tsx` | component | request-response | same file (Export `url: '#'`) | exact |
| `frontend/src/app/dashboard/layout.tsx` | route | request-response | same file (`requireOfficerSession`) | exact |
| `frontend/messages/{en,vi}.json` | config | transform | existing `dashboard` / `empty` / `error` namespaces | exact |
| `backend/app/api/reports.py` | controller | CRUD / streaming | same file (`/recent`, `/summary`, status PATCH) | exact |
| `backend/app/security.py` | middleware | request-response | `require_officer` (extend to Principal) | exact |
| `backend/app/services/supabase.py` | service | CRUD | same file (`list_recent`, `summary`, `update_status`) | exact |
| `supabase/migrations/*_dashboard_polish.sql` | migration | batch | `supabase/migrations/20260720_000001_foundation.sql` | exact |
| `backend/tests/test_reports.py` | test | request-response | same file (monkeypatch sink + TestClient) | exact |
| `backend/tests/test_export.py` | test | streaming | `backend/tests/test_reports.py` | role-match |
| `frontend/tests/dashboard-table.test.mjs` | test | transform | `frontend/tests/dashboard-shell.test.mjs` | exact |
| `frontend/tests/dashboard-detail.test.mjs` | test | transform | `frontend/tests/dashboard-shell.test.mjs` | exact |

## Pattern Assignments

### `frontend/src/app/dashboard/page.tsx` (route, request-response)

**Analog:** `frontend/src/app/dashboard/page.tsx`

**Imports / fetch pattern** (lines 1–28):
```typescript
import { officerFetch } from "@/lib/backend";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FetchResult<T> = { data: T; error: string | null };

async function getRecentReports(): Promise<FetchResult<Report[]>> {
  try {
    const res = await officerFetch("/api/v1/reports/recent?limit=5", {
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Could not load reports (HTTP ${res.status}).` };
    }
    const body = await res.json();
    return { data: body.items ?? [], error: null };
  } catch {
    return { data: [], error: "Could not connect to the CityMind API." };
  }
}
```

**Empty / error chrome** (lines 44–65) — reuse for DASH-07; swap card grid for table island:
```tsx
{result.error && (
  <Alert variant="destructive">
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      Could not load reports. Check your connection and try again.
    </AlertDescription>
  </Alert>
)}
{!result.error && reports.length === 0 && (
  <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
    <p className="text-lg font-medium">No reports yet</p>
  </div>
)}
```

**Extend for Phase 3:** Accept `searchParams` (see login page pattern below), pass `cursor`/`limit`/`filters`/`sort` into `officerFetch` for `/recent` and `/summary` together; render `ReportsFilters` + `ReportsMetrics` + `ReportsTable` + `ExportButton` instead of `ReportCard` map.

**URL `searchParams` analog** — `frontend/src/app/login/page.tsx` lines 9–17:
```typescript
type Props = {
  searchParams: Promise<{ error?: string; returnUrl?: string }>;
};
export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
```

---

### `frontend/src/components/reports/ReportsTable.tsx` (component, request-response)

**Analog:** `frontend/src/components/dashboard/ReportCard.tsx` (row → detail navigation) + list page error/empty states

**Navigation / row target** (ReportCard lines 49–54):
```tsx
<Link
  href={`/dashboard/reports/${report.report_id}`}
  className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold ..."
>
  View details
</Link>
```

**Core pattern to adopt (from RESEARCH, not yet in repo):** TanStack `useReactTable` with `manualPagination: true`, `manualSorting: true`, `initialState.columnVisibility: { severity: false }`, localStorage key `citymind.dashboard.columnVisibility`. Install shadcn `table` via CLI into `frontend/src/components/ui/table.tsx` (same alias style as existing `button`/`badge`).

**No TanStack analog in tree** — planner should treat RESEARCH Pattern 2 as the implementation template; wire row click/keyboard to `/dashboard/reports/[reportId]` (D-03).

---

### `frontend/src/components/reports/ReportsFilters.tsx` (component, request-response)

**Analog (API filters already exist):** `backend/app/api/reports.py` `recent_reports` query params (lines 127–150)

```python
@router.get("/recent")
async def recent_reports(
    limit: int = 20,
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    min_severity: int | None = Query(default=None, ge=1, le=5),
    max_severity: int | None = Query(default=None, ge=1, le=5),
    _officer: str = Depends(require_officer),
):
    if limit < 1 or limit > 100:
        raise HTTPException(422, "limit must be between 1 and 100")
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(422, "Invalid status filter")
```

**i18n keys already stubbed** — `frontend/messages/en.json` `dashboard.filters` / `clearFilters` / `empty.noMatch`. Collapsible UI: add shadcn `collapsible` + `select`; sync via `URLSearchParams` (no `nuqs`).

---

### `frontend/src/components/reports/ReportsMetrics.tsx` (component, request-response)

**Analog:** Backend summary response shape from `SupabaseReportSink.summary` (lines 146–176) and message keys `dashboard.totalReports` / `critical` / `avgSeverity` / `topCategory`.

```python
return {
    "total_reports": total_reports,
    "critical_reports": critical_reports,
    "avg_severity": avg_severity,
    "top_category": top_category,
}
```

**Phase 3 change:** Call `/summary` with the **same** filter query string as `/recent` (DATA-05). Current `/summary` ignores filters — extend API first, then strip UI.

---

### `frontend/src/components/reports/ExportButton.tsx` (component, streaming)

**Analog:** `frontend/src/components/StatusActions.tsx` — client island, fetch, loading/error, `role="alert"`

**Mutation / error pattern** (StatusActions lines 16–37):
```typescript
async function updateStatus(status: string) {
  setLoading(status);
  setError("");
  const url = new URL(
    `/api/officer/reports/${reportId}/status`,
    window.location.origin,
  );
  url.searchParams.set("status", status);
  try {
    const res = await fetch(url.toString(), { method: "PATCH" });
    if (!res.ok) {
      setError(`Status update failed (HTTP ${res.status}).`);
      return;
    }
    router.refresh();
  } catch {
    setError("Could not connect to the CityMind API.");
  } finally {
    setLoading("");
  }
}
```

**Export adaptation:** Build `/api/officer/reports/export?format=csv|xlsx&…filters` URL from current search params; trigger download via `window.location` or `fetch` + blob only if streaming proxy returns a file (prefer navigation/`Content-Disposition` so browser does not buffer JSON). Show UI-SPEC copy “Preparing export…” / failure Alert.

---

### `frontend/src/app/api/officer/reports/export/route.ts` (route, streaming)

**Analog:** `frontend/src/app/api/officer/reports/[reportId]/image/route.ts` (body passthrough + auth gate)

**Auth + stream proxy** (image route lines 1–18):
```typescript
import { getClaims } from "@/lib/auth";
import { officerFetch } from "@/lib/backend";

export async function GET(_request: Request, { params }: Context) {
  if (!(await getClaims())) return Response.json({ detail: "Unauthorized" }, { status: 401 });
  const response = await officerFetch(
    `/api/v1/reports/${encodeURIComponent(reportId)}/image`,
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
```

**Export adaptation:** Forward incoming query string to `/api/v1/reports/export?...`; pass through `Content-Type` and `Content-Disposition` from FastAPI. Do not `await response.json()`.

**Status BFF note-forwarding analog** — `frontend/src/app/api/officer/reports/[reportId]/status/route.ts` lines 6–20 (already forwards `note`):
```typescript
export async function PATCH(request: Request, { params }: Context) {
  if (!(await getClaims())) return Response.json({ detail: "Unauthorized" }, { status: 401 });
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  if (incoming.get("status")) query.set("status", incoming.get("status")!);
  if (incoming.get("note")) query.set("note", incoming.get("note")!);
  const response = await officerFetch(
    `/api/v1/reports/${encodeURIComponent(reportId)}/status?${query}`,
    { method: "PATCH" },
  );
  return new Response(response.body, { status: response.status, ... });
}
```

---

### `frontend/src/app/dashboard/reports/[reportId]/page.tsx` (route, request-response)

**Analog:** same file — RSC dual-fetch + advisory Alert + history list

**Auth + parallel fetch** (lines 109–115):
```tsx
await requireOfficerSession();
const { reportId } = await params;
const [reportResult, historyResult] = await Promise.all([
  getReport(reportId),
  getHistory(reportId),
]);
```

**Advisory AI disclaimer** (lines 156–161) — keep/relabel per D-20 / UI-SPEC:
```tsx
<Alert className="border border-primary bg-secondary/50">
  <AlertDescription className="text-foreground text-sm font-medium">
    AI-generated analysis is advisory. An officer remains responsible for
    verification and the final decision.
  </AlertDescription>
</Alert>
```

**Timeline newest-first** already via API `order("created_at", desc=True)`; extend event type with `actor_id` and show truncated actor / “Officer” (D-21).

**Reorder sections strictly per D-19:** header meta → citizen description → evidence (image + signals) → AI analysis (advisory) → urban context → status timeline → `StatusActions` (currently AI/summary/actions interleave differently — planner must reshuffle, not invent new fetch helpers).

---

### `frontend/src/components/StatusActions.tsx` (component, request-response)

**Analog:** same file — extend with Dialog + note gate

**Current one-click flow** (lines 43–48) — replace for `resolved`/`rejected`:
```tsx
{["reviewing", "resolved", "rejected"].map((status) => (
  <button
    type="button"
    key={status}
    onClick={() => updateStatus(status)}
    disabled={Boolean(loading) || currentStatus === status}
  >
```

**Required change:**
- `reviewing` → immediate `updateStatus("reviewing")` (no dialog).
- `resolved` / `rejected` → open shadcn Dialog; required note textarea; PATCH with `url.searchParams.set("note", note.trim())`.
- On 422, surface UI-SPEC validation string; on success keep `router.refresh()`.
- Confirm UI analog today: custom logout modal in `DashboardSidebar.tsx` lines 110–136 — prefer shadcn Dialog (UI-SPEC lock) over Card overlay.

---

### `frontend/src/components/DashboardSidebar.tsx` (component, request-response)

**Analog:** same file — Export nav item currently dead

**Export stub** (lines 41–46):
```typescript
{
  title: 'Export',
  url: '#',
  icon: Download,
  active: false,
},
```

**D-17 change:** `url: '/dashboard?focus=export'`; keep Reports → `/dashboard`. Logout confirm overlay pattern stays; do not reuse for resolve (use Dialog on detail).

---

### `frontend/src/app/dashboard/layout.tsx` (route, request-response)

**Analog:** same file

**Guard + shell** (lines 12–28):
```tsx
const session = await requireOfficerSession();
// ...
<main className="flex-grow p-6 md:p-8 max-w-6xl w-full mx-auto">
  {children}
</main>
```

**Phase 3 note:** UI-SPEC allows widening `max-w-6xl` on Reports view only if needed for table density — prefer page-level override over breaking Settings/other children.

---

### `frontend/src/lib/backend.ts` (utility, request-response) — shared, likely unmodified

**Analog / reuse as-is** (lines 16–23):
```typescript
export async function officerFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = await getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(backendEndpoint(path), { ...init, headers });
}
```

All RSC dashboard fetches and BFF proxies must continue using this Bearer bridge.

---

### `backend/app/api/reports.py` (controller, CRUD + streaming)

**Analog:** same file

**Officer-gated list** (lines 127–164) — extend with `cursor`, `sort`, `order`, date-range params; return `next_cursor`:
```python
@router.get("/recent")
async def recent_reports(
    limit: int = 20,
    status: str | None = None,
    ...
    _officer: str = Depends(require_officer),
):
    try:
        items = get_sink().list_recent(..., caller_token=_officer)
        return {"items": items, "count": len(items)}
    except Exception as exc:
        raise HTTPException(502, f"Database query failed: {exc}") from exc
```

**Status PATCH** (lines 175–194) — add note gate before sink call:
```python
@router.patch("/{report_id}/status")
async def update_report_status(
    report_id: str,
    status: str,
    note: str | None = None,
    _officer: str = Depends(require_officer),
):
    if status not in VALID_STATUSES:
        raise HTTPException(422, "Invalid status")
    # ADD: if status in {"resolved", "rejected"} and not (note or "").strip():
    #          raise HTTPException(422, "Note is required for resolved/rejected")
```

**Route order pitfall:** Register `GET /export` **before** `GET /{report_id}` so `export` is not captured as an id (RESEARCH pitfall 6). Image/status-history static paths already precede `/{report_id}` — follow that ordering.

**Streaming:** No existing `StreamingResponse` in repo — use RESEARCH Pattern 3 (`StreamingResponse` + `csv` / XlsxWriter `constant_memory`). Closest binary response analog is `get_report_image` returning `Response(content=data, media_type=mime_type)` (lines 197–207).

---

### `backend/app/security.py` (middleware, request-response)

**Analog:** `require_officer` (lines 39–78)

**Current return is raw JWT string:**
```python
def require_officer(
    authorization: str | None = Header(default=None),
) -> str:
    ...
    role = payload.get("app_metadata", {}).get("role")
    if role not in ("officer", "admin"):
        raise HTTPException(403, "Access forbidden: insufficient role")
    return token
```

**Phase 3:** Return a frozen Principal (`token`, `actor_id=payload["sub"]`, `role`) per RESEARCH; update all `Depends(require_officer)` call sites and tests (`mock_require_officer` currently returns `"mock_token"` — adjust to Principal).

**Frontend already extracts `sub` as `userId`** — `frontend/src/lib/auth.ts` lines 9–17:
```typescript
function roleFromClaims(claims: { sub?: string; ... }): Session | null {
  if (!claims?.sub) return null;
  ...
  return { role, userId: claims.sub };
}
```

---

### `backend/app/services/supabase.py` (service, CRUD)

**Analog:** same file — replace Python post-filter with SQL keyset

**Anti-pattern to remove** (lines 109–119) — status filtered in Python after full select:
```python
for row in response.data:
    events = row.get("status_events", [])
    ...
    current_status = latest_event.get("status", "new") if latest_event else "new"
    if status is not None and current_status != status:
        continue
```

**Caller JWT → RLS** (lines 22–32) — keep:
```python
def get_client(self, caller_token: str | None = None) -> Client:
    if caller_token and self.settings.supabase_url:
        options = ClientOptions(headers={"Authorization": f"Bearer {caller_token}"})
        return create_client(
            self.settings.supabase_url,
            self.settings.supabase_publishable_key,
            options=options
        )
```

**`update_status` insert** (lines 178–191) — add `actor_id` column:
```python
row = {
    "report_id": report_id,
    "status": status,
    "note": note,
    "created_at": datetime.now(timezone.utc).isoformat(),
    # ADD: "actor_id": actor_id,
}
client.table("status_events").insert(row).execute()
```

Also update `reports.current_status` atomically on status change (migration Wave 0). Extend `status_history` select to include `actor_id`.

---

### `supabase/migrations/*_dashboard_polish.sql` (migration, batch)

**Analog:** `supabase/migrations/20260720_000001_foundation.sql`

**Current `status_events`** (lines 22–28) — no `actor_id`:
```sql
CREATE TABLE IF NOT EXISTS public.status_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

**Current `reports`** — no `current_status`. Additive migration should:
1. `ALTER TABLE reports ADD COLUMN current_status TEXT NOT NULL DEFAULT 'new';`
2. Backfill from latest `status_events`
3. `ALTER TABLE status_events ADD COLUMN actor_id TEXT;`
4. Indexes e.g. `(current_status, created_at DESC)`, keep RLS policies (inherit; no rewrite unless CHECK added)

---

### Tests

**Backend analog** — `backend/tests/test_reports.py` lines 14–19, 89–100:
```python
@pytest.fixture(autouse=True)
def mock_require_officer():
    app.dependency_overrides[require_officer] = lambda: "mock_token"
    ...

def test_status_update_requires_existing_report(monkeypatch) -> None:
    response = client.patch(
        "/api/v1/reports/missing/status", params={"status": "reviewing"}
    )
    assert response.status_code == 404
```

Add: cursor pagination, filtered summary, resolve-requires-note → 422, actor_id recorded, export auth + content-type.

**Frontend smoke analog** — `frontend/tests/dashboard-shell.test.mjs` (fs.existsSync + string assertions). New `dashboard-table.test.mjs` should assert table/filter/metrics wiring. New `dashboard-export.test.mjs` (Plan 03-04) asserts ExportButton + BFF + Export URL `?focus=export`. New `dashboard-detail.test.mjs` (Plan 03-03) asserts D-19 section order + Dialog note-gate markers — same shell-test style as `dashboard-shell.test.mjs`.

---

## Shared Patterns

### Officer auth (frontend BFF + RSC)

**Source:** `frontend/src/lib/auth.ts`, `frontend/src/lib/backend.ts`, officer API routes  
**Apply to:** All dashboard RSC pages, export/status/image BFF routes

```typescript
// Fail closed on BFF
if (!(await getClaims())) return Response.json({ detail: "Unauthorized" }, { status: 401 });

// RSC shell
const session = await requireOfficerSession(); // redirects /login

// Server → FastAPI
await officerFetch(path, { cache: "no-store", ... });
```

### Officer auth (FastAPI)

**Source:** `backend/app/security.py` `require_officer`  
**Apply to:** `/recent`, `/summary`, `/export`, status, detail, history, image

```python
_officer: str = Depends(require_officer)  # → Principal in Phase 3
# sink.*(..., caller_token=principal.token)
# never accept client-supplied actor_id
```

### Error handling (RSC FetchResult)

**Source:** `frontend/src/app/dashboard/page.tsx`, detail page  
**Apply to:** List, metrics, detail, history

```typescript
try {
  const res = await officerFetch(...);
  if (!res.ok) return { data: null, error: `... (HTTP ${res.status}).` };
  return { data: await res.json(), error: null };
} catch {
  return { data: null, error: "Could not connect to the CityMind API." };
}
```

UI: shadcn `Alert variant="destructive"` for load errors; dashed empty region for zero rows.

### Error handling (FastAPI)

**Source:** `backend/app/api/reports.py`  
**Apply to:** Extended list/summary/export/status

```python
if status not in VALID_STATUSES:
    raise HTTPException(422, "Invalid status")
try:
    ...
except HTTPException:
    raise
except Exception as exc:
    raise HTTPException(502, f"... failed: {exc}") from exc
```

### Status mutation client island

**Source:** `StatusActions.tsx` + status `route.ts`  
**Apply to:** Resolve/reject with note; reviewing without note

```typescript
url.searchParams.set("status", status);
url.searchParams.set("note", note); // required for resolved/rejected
const res = await fetch(url.toString(), { method: "PATCH" });
if (res.ok) router.refresh();
```

### Dashboard layout / sidebar

**Source:** `layout.tsx`, `DashboardSidebar.tsx`  
**Apply to:** Export nav (D-17), keep shell chrome light/product register

- Sidebar owns navigation — no left filter rail (D-06).
- Export → `/dashboard?focus=export`, not a separate page.

### Reports API filter enums

**Source:** `backend/app/api/reports.py` `VALID_STATUSES` / `VALID_CATEGORIES` / `VALID_PRIORITIES`  
**Apply to:** List, summary, export query validation — keep allow-lists; add date-range parse carefully.

### i18n

**Source:** `frontend/messages/{en,vi}.json` + `useTranslations` in sidebar  
**Apply to:** All new table/filter/export/resolve strings per UI-SPEC copy tables; avoid hardcoded English in new chrome (StatusActions currently hardcodes — migrate to catalogs).

---

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|----------------|------|-----------|--------|
| TanStack Table usage | component | request-response | No `@tanstack/react-table` in tree yet — copy RESEARCH Pattern 2 + shadcn data-table docs |
| FastAPI `StreamingResponse` CSV/XLSX | controller | streaming | No streaming export in codebase — use RESEARCH Pattern 3; BFF body passthrough from image route |

## Metadata

**Analog search scope:** `frontend/src/app/dashboard/**`, `frontend/src/app/api/officer/**`, `frontend/src/components/**`, `frontend/src/lib/**`, `backend/app/api/reports.py`, `backend/app/security.py`, `backend/app/services/supabase.py`, `supabase/migrations/**`, `backend/tests/**`, `frontend/tests/**`, `frontend/messages/**`  
**Files scanned:** ~35  
**Pattern extraction date:** 2026-07-20

**Key takeaways for planner:**
1. Extend existing `/recent` + `/summary` + status seams — do not invent a parallel officer API.
2. Close Wave 0 schema gaps (`current_status`, `actor_id`) before cursor/export UI.
3. Reuse `officerFetch` / `getClaims` BFF proxy pattern for export streaming.
4. Replace card list + note-less `StatusActions`; keep detail advisory Alert language.
5. Register `/export` before `/{report_id}`; filter status in SQL, not Python.
