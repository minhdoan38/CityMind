# Phase 3: Dashboard Polish - Research

**Researched:** 2026-07-20
**Domain:** Officer dashboard data table, cursor APIs, streaming export, resolve workflow (FastAPI + Supabase + Next.js/shadcn)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Table & columns
- **D-01:** Default columns are **lean ops**: `report_id`, `created_at`, category, priority, status, truncated summary. Severity is available via **column visibility** but **hidden by default**.
- **D-02:** Reports view uses a **compact data table** (not cards). Phase 2 card list is replaced on `/dashboard` (Reports), not kept in parallel.
- **D-03:** **Row click** navigates to `/dashboard/reports/[reportId]`. No bulk-select / bulk-status actions in Phase 3.
- **D-04:** List API uses **cursor pagination** (`cursor` + `limit`) per DATA-04. Default sort: `created_at` descending. Support sort on priority, status, category, and created_at.
- **D-05:** Officers can toggle column visibility (DASH-02). Persist visibility in client preference only (cookie/localStorage) — not a server profile.

#### Filter chrome
- **D-06:** Filters live in a **collapsible panel above the table** (toolbar + expandable advanced section). Do not use a permanent left filter rail — sidebar already owns navigation.
- **D-07:** Filter set per DASH-03: status, category, priority, severity range, date range. Include a single **Clear filters** control.
- **D-08:** **Summary metrics strip** sits above the table and **respects active filters** (DATA-05) — never global-only counts while filters are applied.
- **D-09:** Sync active filters (and sort/page cursor as practical) to **URL query params** so officers can refresh/share a filtered view.

#### Resolve / reject flow
- **D-10:** Status transitions happen **only on the detail page** (extend `StatusActions`). Table rows show status badges only — no inline resolve from the list (reduces mis-clicks).
- **D-11:** Workflow: officers may move to `reviewing` without a note; **`resolved` and `rejected` require a non-empty note** (DASH-05).
- **D-12:** Before `resolved`/`rejected`, show a **confirmation UI** (modal or inline panel) with required note textarea; cancel returns without change.
- **D-13:** Status updates record **`actor_id` from the authenticated officer JWT** into append-only `status_events` (DATA-07). Preserve advisory-AI language; officers remain final authority.
- **D-14:** Replace the current note-less one-click buttons in `StatusActions` with the note-gated flow above.

#### Export packaging
- **D-15:** Support **both CSV and Excel (.xlsx)** export of the **currently filtered** report set (DASH-06, DATA-06). Button lives on the Reports view next to filters.
- **D-16:** Export columns = lean ops defaults **plus** severity, recommendation, and latest status note when available. Streaming/chunked response for large sets — do not load entire result into browser memory.
- **D-17:** Sidebar **Export** nav item routes to the Reports view with export affordance focused (same filtered export), not a separate orphan page with different semantics.
- **D-18:** Export is officer-authenticated only; same RLS/JWT path as list reads.

#### Detail page hierarchy
- **D-19:** Detail section order: **header meta** (id, status, timestamps, category/priority/severity) → **citizen description** → **evidence (image + signals)** → **AI analysis block** (summary, recommendation, evidence/uncertainty — clearly labeled advisory) → **urban context** → **status timeline** → **resolve actions**.
- **D-20:** AI block must remain visually **advisory** (label/disclaimer), never presented as final authority.
- **D-21:** Status timeline is **newest-first**, showing status, note, actor, and timestamp per event.
- **D-22:** Every dashboard surface (table, detail, export-in-progress) implements **loading, empty, and error** states (DASH-07). Empty table copy stays operational (e.g. “No reports match these filters”).

### the agent's Discretion
- Table implementation library (e.g. TanStack Table + shadcn primitives vs lighter custom table)
- Exact default `limit` / page size and cursor encoding
- Excel/CSV generation library and whether export runs primarily in FastAPI vs Next BFF
- Exact confirmation UI pattern (dialog vs inline sheet) as long as D-11/D-12 hold
- Visual density tokens within existing Phase 1 theme (light officer chrome; not public civic hero aesthetic)

### Deferred Ideas (OUT OF SCOPE)
- **DASH-08** officer copy of citizen status link — Phase 4
- Public `/status` token lookup — Phase 4
- MapLibre / geo filters on dashboard — Phase 6
- Self-help vs government AI triage (Phase 7) — do not fold classification UX into Phase 3 resolve flow
- Email/SMS on status change — v2 backlog
- Bulk multi-select resolve — out of scope (explicitly rejected via D-03/D-10)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-04 | Cursor pagination on report list API (`cursor` + `limit`) | Keyset cursor on `(sort_key, report_id)`; extend `/recent` or add `/list`; denormalize `current_status` for SQL filter/sort |
| DATA-05 | Summary metrics respect active filters | Same filter params on `/summary`; aggregate in sink over filtered query — never global-only while filters active |
| DATA-06 | Excel/CSV export endpoint streams filtered report data | FastAPI `StreamingResponse` (CSV) + XlsxWriter `constant_memory` → stream file (xlsx); cursor-iterate DB rows |
| DATA-07 | Status updates record actor_id from authenticated officer JWT | Migration `status_events.actor_id`; extract JWT `sub` in `require_officer`; insert with event |
| DASH-02 | Reports data table with sort, pagination, column visibility | TanStack Table `manualPagination`/`manualSorting` + shadcn Table; visibility in localStorage |
| DASH-03 | Advanced filters: status, category, priority, severity range, date range | Collapsible filter panel; URL query sync; pass filters to list + summary + export |
| DASH-04 | Report detail shows evidence, AI analysis, urban context, history | Reorder sections per D-19; advisory labeling; timeline includes actor |
| DASH-05 | Resolve workflow: reviewing → resolved/rejected with required note | Dialog confirm + note gate in `StatusActions`; server 422 if note missing |
| DASH-06 | Excel export button applies current filters | Export button on Reports; sidebar Export → `/dashboard?focus=export` |
| DASH-07 | Loading, empty, and error states on all dashboard views | Skeleton/empty/Alert patterns on table, detail, export |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- **Stack:** Keep FastAPI for AI/ops API; Supabase for ops/auth; BigQuery analytics-only (do not reintroduce BigQuery for dashboard CRUD).
- **Security:** AI output is advisory; officers remain decision authority; access tokens hashed at rest (unchanged this phase).
- **Privacy:** Citizen status lookup is token-scoped (Phase 4) — do not leak cross-report data from dashboard APIs.
- **Locale:** Bilingual EN/VI — extend `frontend/messages/{en,vi}.json` `dashboard` (and related) namespaces for new strings.
- **Performance:** Synchronous analyze path remains acceptable; maps deferred (Phase 6).
- **Conventions:** Python `snake_case`; TS components PascalCase; officer fetches via `officerFetch` / BFF; Pydantic + `HTTPException` at API boundary.
- **GSD:** Prefer planning artifacts before ad-hoc edits (this research feeds planner).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cursor pagination + filter/sort query | API / Backend | Database / Storage | Keyset SQL + sink owns correctness; Next must not invent pagination |
| Filtered summary metrics | API / Backend | Database / Storage | Aggregates must match list filters server-side (DATA-05) |
| Streaming CSV/XLSX export | API / Backend | Frontend Server (SSR) | FastAPI streams bytes; Next BFF only proxies auth + download |
| JWT → `actor_id` on status events | API / Backend | Database / Storage | Extract `sub` in FastAPI; persist on `status_events` insert |
| Officer data table UI | Browser / Client | Frontend Server (SSR) | TanStack Table for visibility/sort chrome; RSC fetches page data |
| Filter chrome + URL sync | Browser / Client | Frontend Server (SSR) | Query params shareable; server reads `searchParams` for first paint |
| Column visibility persistence | Browser / Client | — | localStorage/cookie only (D-05) |
| Resolve/reject note gate | Browser / Client | API / Backend | Dialog UX client-side; server enforces note for resolved/rejected |
| Detail section reorder + advisory AI | Frontend Server (SSR) | Browser / Client | Mostly server-rendered detail; StatusActions client island |
| EN/VI dashboard copy | Frontend Server (SSR) | — | next-intl message catalogs |
| Schema: `actor_id`, `current_status` | Database / Storage | API / Backend | Migration required before efficient filter/pagination |

## Summary

Phase 3 upgrades the Phase 2 card list into a production officer ops surface: server-driven filtered list + summary, a compact TanStack/shadcn table, FastAPI-streamed CSV/XLSX of the filtered set, and a note-gated resolve flow that records JWT `sub` as `actor_id`. The current codebase already has filter query params on `/recent`, a note query param on status PATCH, and detail/history pages — but **list/summary still load and filter in Python after fetching broad result sets**, **`status_events` has no `actor_id`**, and **`require_officer` returns only the raw JWT string** (not the principal `sub`). Those three gaps must be closed in Track A before the table/export UI can meet DATA-04/05/06/07.

**Primary recommendation:** Add a Wave 0 schema+sink contract (`current_status` denormalized on `reports`, `actor_id` on `status_events`, keyset list/summary/export APIs), then build the dashboard table with **TanStack Table + shadcn Table** (`manualPagination`/`manualSorting`), URL-synced filters via **native Next.js `searchParams`**, and **FastAPI streaming export** (stdlib `csv` + **XlsxWriter `constant_memory`**).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard | Provenance |
|---------|---------|---------|--------------|------------|
| `@tanstack/react-table` | **8.21.3** | Headless table (sort, visibility, manual pagination) | Official shadcn data-table foundation; server-side `manualPagination`/`manualSorting` | [VERIFIED: npm registry] + [CITED: tanstack.com/table/v8/docs/guide/pagination] + legitimacy **OK** |
| shadcn `table` + `dialog` (+ existing `dropdown-menu`, `sheet`, `button`) | CLI `@shadcn/*` | Ops chrome | Matches Phase 1 shadcn install; Dialog for resolve confirm | [CITED: ui.shadcn.com/docs/components/data-table] |
| FastAPI `StreamingResponse` / `FileResponse` | project FastAPI **0.115.x** | Stream export bytes | Official custom response types | [CITED: fastapi.tiangolo.com/advanced/custom-response/] |
| `XlsxWriter` | **3.2.9** | Constant-memory `.xlsx` write | Official `constant_memory` mode for large sequential writes | [CITED: xlsxwriter.readthedocs.io/working_with_memory.html] + [VERIFIED: PyPI] |
| Python `csv` (stdlib) | — | Stream CSV rows | Zero dependency; pairs with StreamingResponse | [ASSUMED] stdlib stability |
| next-intl | **4.13.2** (in tree) | EN/VI dashboard strings | Already project standard | [VERIFIED: frontend/package.json] |
| supabase-py / PostgREST via `SupabaseReportSink` | in tree | Filtered queries under RLS | Phase 1 D-10/D-11 locked | [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use | Provenance |
|---------|---------|---------|-------------|------------|
| shadcn `checkbox`, `badge`, `select`, `popover`, `collapsible` | via CLI | Filter panel, column toggles, badges | Add as needed for DASH-02/03 | [CITED: ui.shadcn.com] |
| `lucide-react` | in tree | Icons | Already used in sidebar | [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | Hand-rolled `<table>` | Faster to start, but column visibility + accessible sort headers become bespoke bugs — reject for DASH-02 |
| FastAPI export | Browser-side SheetJS | Violates D-16 (loads filtered set in browser); auth/size worse — reject |
| XlsxWriter | openpyxl | openpyxl is fine for small workbooks but not designed for constant-memory streaming writes — prefer XlsxWriter |
| nuqs | Native `searchParams` / `useSearchParams` | nuqs latest **2.9.1** flagged legitimacy **SUS (too-new)** despite high downloads — prefer native Next URL APIs for D-09 |

**Installation:**

```bash
# Frontend (from frontend/)
npm install @tanstack/react-table@8.21.3
npx shadcn@latest add @shadcn/table @shadcn/dialog @shadcn/checkbox @shadcn/badge @shadcn/select @shadcn/popover @shadcn/collapsible

# Backend
pip install XlsxWriter==3.2.9
# pin in backend requirements / pyproject as project already manages deps
```

**Discretion picks (locked by this research for the planner):**

| Decision | Pick | Rationale |
|----------|------|-----------|
| Table library | TanStack Table + shadcn Table | Matches shadcn docs; server-driven pagination |
| Default `limit` | **25** (max still 100) | Dense ops without huge payloads |
| Cursor encoding | URL-safe base64url of `{sort}:{dir}:{value}:{report_id}` | Opaque, tie-break stable with `report_id` |
| Export host | **FastAPI primary**; Next BFF proxy download | Same JWT/RLS path as list (D-18); browser never buffers full set |
| Confirm UI | **Dialog** (Sheet already in tree as alternative) | Clear modal focus for required note |
| URL sync | Native Next.js App Router `searchParams` | Avoids SUS `nuqs` install |

## Package Legitimacy Audit

| Package | Registry | Age / publish signal | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|-----------|-------------|---------|-------------|
| `@tanstack/react-table` | npm | established (latest 2025-04-14) | ~16.6M/wk | github.com/TanStack/table | **OK** | Approved |
| `nuqs` | npm | latest published 2026-07-19 | ~3.7M/wk | github.com/47ng/nuqs | **SUS** (too-new) | **Do not install** — use native searchParams |
| `date-fns` | npm | established | ~93M/wk | github.com/date-fns/date-fns | **OK** | Optional only if date-range formatting needed; not required |
| `XlsxWriter` | PyPI | 3.2.9 | n/a (seam) | github.com/jmcnamara/XlsxWriter | **SUS** (unknown-downloads) | **Keep** — official docs + GitHub; planner adds `checkpoint:human-verify` before install |
| `openpyxl` | PyPI | 3.1.5 | n/a (seam) | foss.heptapod.net/openpyxl/openpyxl | **SUS** | **Not chosen** (XlsxWriter preferred) |

**Packages removed due to [SLOP] verdict:** none (nuqs@2.4.3 probe returned SLOP/does-not-exist — ignore that pin)

**Packages flagged as suspicious [SUS]:** `XlsxWriter` (install with human-verify checkpoint); `nuqs` (removed from recommendation)

## Architecture Patterns

### System Architecture Diagram

```text
Officer browser
  │  (filters/sort/cursor in URL)
  ▼
Next.js /dashboard (RSC + client table island)
  │  officerFetch / BFF with Bearer JWT
  ├─► GET  /api/v1/reports/recent?cursor&limit&filters&sort
  ├─► GET  /api/v1/reports/summary?same filters
  ├─► GET  /api/v1/reports/export?format=csv|xlsx&same filters  ──StreamingResponse──► download
  └─► PATCH /api/v1/reports/{id}/status?status&note
           │
           ▼
      require_officer → Principal{token, actor_id=sub, role}
           │
           ▼
      SupabaseReportSink (caller JWT → RLS)
           ├─ reports (incl. current_status denorm)
           └─ status_events (append-only + actor_id)
```

### Recommended Project Structure

```text
frontend/src/
├── app/[locale]/dashboard/
│   ├── page.tsx                 # table + filters + metrics + export (replace cards)
│   └── reports/[reportId]/page.tsx  # D-19 section order
├── components/
│   ├── reports/
│   │   ├── ReportsTable.tsx     # TanStack + shadcn Table client island
│   │   ├── ReportsFilters.tsx   # collapsible filter panel
│   │   ├── ReportsMetrics.tsx   # filtered summary strip
│   │   └── ExportButton.tsx     # triggers BFF download
│   └── StatusActions.tsx        # dialog + note gate
├── app/api/officer/reports/
│   ├── route.ts                 # optional list proxy if needed
│   └── export/route.ts          # stream proxy for export
backend/app/
├── api/reports.py               # list cursor, filtered summary, export, note+actor status
├── security.py                  # Principal with sub
└── services/supabase.py         # keyset list, filtered summary, export iterator, actor_id insert
supabase/migrations/
└── 20260720_00000X_dashboard_polish.sql  # current_status + actor_id + indexes
```

### Pattern 1: Keyset (cursor) pagination

**What:** Opaque `cursor` = last row’s sort value + `report_id` tie-breaker; `limit+1` fetch to compute `next_cursor`.
**When to use:** All officer list reads (DATA-04). Do **not** use `OFFSET`.
**Example:**

```python
# Source: industry keyset pattern adapted to SupabaseReportSink [ASSUMED encoding]
# WHERE (created_at, report_id) < (:cursor_created_at, :cursor_report_id)
# ORDER BY created_at DESC, report_id DESC
# LIMIT :limit + 1
```

For non-time sorts (`priority`, `status`, `category`), always include `report_id` as secondary order key so cursors are unique.

### Pattern 2: TanStack manual server pagination/sorting

**What:** Pass already-paged API rows into `useReactTable` with `manualPagination: true` and `manualSorting: true`; sync sort/cursor to URL.
**When to use:** Officer Reports table (DASH-02).
**Example:**

```tsx
// Source: https://tanstack.com/table/v8/docs/guide/pagination
const table = useReactTable({
  data: items,
  columns,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  manualSorting: true,
  pageCount: -1, // cursor API: unknown total pages; use next_cursor presence
  state: { sorting, columnVisibility },
  onSortingChange: setSorting,
  onColumnVisibilityChange: setColumnVisibility,
  initialState: {
    columnVisibility: { severity: false }, // D-01
  },
});
```

### Pattern 3: Streaming export in FastAPI

**What:** CSV yields lines from a DB cursor iterator; XLSX writes sequential rows with XlsxWriter `constant_memory=True` to a temp/spooled file, then `FileResponse`/`StreamingResponse` streams the file (never `list(all_rows)` in memory).
**When to use:** `/export` (DATA-06, D-15/D-16).
**Example:**

```python
# Source: https://fastapi.tiangolo.com/advanced/custom-response/ (StreamingResponse)
from fastapi.responses import StreamingResponse
import csv, io

def csv_iter(rows):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=EXPORT_FIELDS)
    writer.writeheader()
    yield buf.getvalue(); buf.seek(0); buf.truncate(0)
    for row in rows:  # generator from sink.iter_filtered(...)
        writer.writerow(row)
        yield buf.getvalue(); buf.seek(0); buf.truncate(0)

return StreamingResponse(
    csv_iter(sink.iter_filtered(...)),
    media_type="text/csv",
    headers={"Content-Disposition": 'attachment; filename="reports.csv"'},
)
```

```python
# Source: https://xlsxwriter.readthedocs.io/working_with_memory.html
import xlsxwriter
workbook = xlsxwriter.Workbook(tmp_path, {"constant_memory": True})
# write rows strictly in row order, then stream file
```

### Pattern 4: Actor-aware status append

**What:** `require_officer` returns `Principal(token, actor_id, role)`; `update_status` inserts `{status, note, actor_id}`; reject empty note for `resolved`/`rejected`.
**When to use:** All status transitions (DATA-07, DASH-05).

### Anti-Patterns to Avoid

- **OFFSET pagination:** Breaks under concurrent inserts; violates DATA-04 cursor contract.
- **Python post-filter status after selecting all reports:** Current `list_recent` / `summary` pattern — will OOM and break cursor semantics; denormalize `current_status` or use SQL view/RPC.
- **Client-side SheetJS export of full filtered set:** Violates D-16.
- **Inline resolve from table rows:** Violates D-10.
- **Registering `/export` after `/{report_id}`:** Path capture steals `export` as an id — declare static routes first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column visibility / sort headers | Custom table state machine | TanStack Table | Accessibility, controlled state, shadcn recipe |
| Keyset cursor math in UI | Client inventing SQL predicates | Backend cursor opaque token | Prevents off-by-one and injection |
| XLSX ZIP packaging | Manual OpenXML | XlsxWriter | Easy to corrupt archives |
| CSV escaping | String join with commas | `csv` module | Quoting/newlines |
| URL filter serialization | Ad-hoc string concat bugs | `URLSearchParams` + Next `searchParams` | Encoding, share links |
| Dialog a11y focus trap | DIY modal | shadcn Dialog | Focus restore, Escape, aria |

**Key insight:** The hard parts are **SQL-correct filtered pagination** and **memory-safe export**. UI polish is mostly composition of shadcn + TanStack on top of a solid API contract.

## Common Pitfalls

### Pitfall 1: Status lives only in `status_events`
**What goes wrong:** Cursor pages and filtered summaries become wrong or insanely expensive.
**Why it happens:** Current sink filters status in Python after `select *` join.
**How to avoid:** Migration adding `reports.current_status` (default `new`), backfill from latest event, update atomically on status insert; index `(current_status, created_at DESC)`.
**Warning signs:** `/recent?status=resolved&limit=25` scans entire table; summary ignores status filter.

### Pitfall 2: Cursor without tie-breaker
**What goes wrong:** Duplicate/skipped rows when many share `created_at` or priority.
**Why it happens:** Single-column keyset.
**How to avoid:** Always order/compare `(sort_col, report_id)`.
**Warning signs:** Refresh shows overlapping IDs across pages.

### Pitfall 3: Export buffers entire result
**What goes wrong:** Cloud Run OOM on large filtered exports.
**Why it happens:** `list_recent` returns a full list then serialize.
**How to avoid:** `iter_filtered` generator + StreamingResponse / constant_memory workbook.
**Warning signs:** Export latency spikes with report count; memory graphs climb linearly.

### Pitfall 4: `actor_id` missing / wrong claim
**What goes wrong:** Timeline shows blank actor; auditors cannot attribute decisions.
**Why it happens:** Schema lacks column; code uses email instead of `sub`; BFF strips identity.
**How to avoid:** Persist JWT `sub`; return `actor_id` from status-history select; UI shows truncated id or “Officer”.
**Warning signs:** History events without actor after resolve.

### Pitfall 5: Note enforced only in UI
**What goes wrong:** API accepts `resolved` without note (current PATCH allows optional note).
**Why it happens:** Trusting client Dialog alone.
**How to avoid:** FastAPI 422 when `status in {resolved,rejected}` and note blank/whitespace.
**Warning signs:** Tests only cover happy UI path.

### Pitfall 6: Route order / Export orphan page
**What goes wrong:** Export 404 or wrong semantics.
**Why it happens:** Sidebar still `url: '#'`; FastAPI `/{report_id}` shadows `export`.
**How to avoid:** D-17 → `/dashboard?focus=export`; register `/export` before path params.
**Warning signs:** Clicking Export does nothing; `GET .../export` returns 404 Report not found.

## Code Examples

### Extend list response shape

```python
# Recommended contract for DATA-04 [ASSUMED field names for planner]
{
  "items": [...],
  "count": 25,
  "next_cursor": "eyJ...",  # null when no more
  "sort": "created_at",
  "order": "desc",
}
```

### Principal from JWT

```python
# Adapt require_officer — keep JWKS validation; expose sub [ASSUMED structure]
@dataclass(frozen=True)
class OfficerPrincipal:
    token: str
    actor_id: str  # payload["sub"]
    role: str

# Depends(require_officer) -> OfficerPrincipal
# sink.update_status(..., actor_id=principal.actor_id, caller_token=principal.token)
```

### Status note gate (server)

```python
if status in {"resolved", "rejected"} and not (note or "").strip():
    raise HTTPException(422, "Note is required for resolved/rejected")
```

### StatusActions confirm flow (client)

```tsx
// Dialog pattern — required note for resolved/rejected; reviewing immediate [ASSUMED]
// PATCH /api/officer/reports/{id}/status?status=resolved&note=...
// then router.refresh()
```

### Column visibility persistence

```ts
// localStorage key e.g. citymind.dashboard.columnVisibility
// hydrate on mount; write on onColumnVisibilityChange (D-05)
```

## State of the Art

| Old Approach (MVP / Phase 2) | Current Approach (Phase 3) | When Changed | Impact |
|------------------------------|----------------------------|--------------|--------|
| Card list `limit=5` | Compact TanStack table + cursor pages | Phase 3 | Ops density |
| Offset-less “recent” Python filter | Keyset + denormalized status | Phase 3 | Correct filters at scale |
| Note-optional one-click status | Dialog + required note + actor_id | Phase 3 | Auditability |
| No export | Streaming CSV/XLSX of filtered set | Phase 3 | Officer sharing |
| BigQuery ops sink | Supabase only | Phase 1 | Keep — do not regress |

**Deprecated/outdated for this phase:**

- Phase 2 card grid on `/dashboard` (replace, do not dual-run — D-02)
- Shared-password / API-key officer auth (already JWT — keep)

## Runtime State Inventory

> Schema additive migration (not a rename). Explicit inventory:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `status_events` rows lack `actor_id`; `reports` lack `current_status` | Migration + backfill `current_status` from latest event; new events write `actor_id` |
| Live service config | Supabase Cloud project RLS policies | Policies already allow INSERT on `status_events`; new columns inherit; no policy rewrite required unless CHECK added |
| OS-registered state | None — verified N/A for this phase | none |
| Secrets/env vars | Existing Supabase JWT/JWKS env | none (reuse) |
| Build artifacts | Frontend `node_modules` after new npm deps; backend venv after XlsxWriter | reinstall in CI/Docker images |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend table | ✓ | v24.14.0 | — |
| npm | Install TanStack/shadcn | ✓ | 11.9.0 | — |
| Python 3 | FastAPI export | ✓ | 3.14.5 | — |
| pytest | Backend tests | ✓ | 8.4.1 | — |
| Supabase Cloud | List/export/status | ✓ (project configured in Phase 1) | — | Blocker if env missing in deploy |
| XlsxWriter | Excel export | ✗ (not installed yet) | target 3.2.9 | Install in Wave 0 |
| Context7 MCP | Docs lookup | ✗ | — | WebSearch/WebFetch used |

**Missing dependencies with no fallback:** Supabase credentials in execution environment for live integration tests (unit tests can mock sink).

**Missing dependencies with fallback:** XlsxWriter (install); Context7 (used WebSearch/WebFetch).

## Validation Architecture

> `workflow.nyquist_validation` is **true** in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest **8.4.1** (backend); frontend node test scripts (`*.test.mjs`) |
| Config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd backend && pytest tests/test_reports.py -q` |
| Full suite command | `cd backend && pytest -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DATA-04 | `cursor`+`limit` returns `next_cursor`; stable ordering | unit | `pytest tests/test_reports.py::test_list_cursor_pagination -x` | ❌ Wave 0 |
| DATA-05 | summary with filters matches filtered population | unit | `pytest tests/test_reports.py::test_summary_respects_filters -x` | ❌ Wave 0 |
| DATA-06 | export streams CSV/XLSX with filters; auth required | unit | `pytest tests/test_export.py -x` | ❌ Wave 0 |
| DATA-07 | status insert includes `actor_id` from JWT sub | unit | `pytest tests/test_reports.py::test_status_records_actor_id -x` | ❌ Wave 0 |
| DASH-05 | resolved/rejected without note → 422 | unit | `pytest tests/test_reports.py::test_resolve_requires_note -x` | ❌ Wave 0 |
| DASH-02/03/07 | table/filters/empty states | frontend smoke | `node --test frontend/tests/dashboard-table.test.mjs` | ❌ Wave 0 |
| DASH-04/06 | detail order / export button wiring | manual + light smoke | — | Manual-heavy OK |

### Sampling Rate

- **Per task commit:** `pytest tests/test_reports.py -q`
- **Per wave merge:** `pytest -q`
- **Phase gate:** Full backend suite green + dashboard smoke before `$gsd-verify-work`

### Wave 0 Gaps

- [ ] Migration `actor_id` + `current_status` (+ indexes/backfill)
- [ ] `tests/test_reports.py` extensions for cursor, filtered summary, note gate, actor_id
- [ ] `tests/test_export.py` for CSV/XLSX streaming + auth
- [ ] `frontend/tests/dashboard-table.test.mjs` (or similar) for empty/error copy + filter query wiring
- [ ] Install `@tanstack/react-table` and `XlsxWriter` (with human-verify for XlsxWriter)

## Security Domain

> `security_enforcement` enabled (ASVS level 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase JWT JWKS validation in `require_officer` |
| V3 Session Management | yes | `@supabase/ssr` cookies; BFF forwards Bearer only |
| V4 Access Control | yes | RLS `is_officer_or_admin()`; export/list/status require officer |
| V5 Input Validation | yes | Pydantic/Query enums; note required; limit bounds; date parse |
| V6 Cryptography | no new | Do not invent token crypto this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated export scrape | Information Disclosure | Same JWT + RLS as list (D-18) |
| Status spoof without note | Tampering | Server-side note requirement |
| Actor spoofing via body `actor_id` | Elevation / Spoofing | Derive only from JWT `sub`; ignore client-supplied actor |
| Filter injection | Tampering | Enum allow-lists (existing VALID_*); parameterized PostgREST filters |
| Oversized export DoS | Denial of Service | Cap rows or time; auth-only; consider max export window [ASSUMED soft cap e.g. 10k rows — confirm in plan] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Denormalizing `current_status` on `reports` is acceptable (vs SQL view only) | Architecture / Pitfalls | Extra migration; still solvable with view/RPC if rejected |
| A2 | Default page size 25 and base64url cursor encoding | Standard Stack | Cosmetic API tweak |
| A3 | Soft export row cap (~10k) may be needed for Cloud Run | Security | Unbounded export cost |
| A4 | Display actor as truncated `sub` UUID is enough for Phase 3 (no email join) | Detail timeline | UX may want email later |
| A5 | Track B “Home polish” in ROADMAP stays thin / non-blocking vs A/C | Scope | Planner over-scopes Phase 3 |

## Open Questions (RESOLVED)

1. **Exact summary metric set under filters**
   - What we know: Existing summary returns `total_reports`, `critical_reports`, `avg_severity`, `top_category`.
   - What's unclear: Whether filtered summary should also break down by status counts.
   - Recommendation: Keep the four existing fields, computed on the filtered set (DATA-05); do not add charts (Phase 5).
   - **RESOLVED:** Plans keep the four filtered metrics only (`total_reports`, `critical_reports`, `avg_severity`, `top_category`) — no status-count breakdown or charts in Phase 3.

2. **Export hard row/time limits**
   - What we know: Streaming reduces memory but not CPU/time.
   - What's unclear: Product max for filtered export.
   - Recommendation: Implement streaming first; add a documented max (e.g. 10k) if Cloud Run timeouts appear — A3.
   - **RESOLVED:** Soft ~10k export row cap (documented in export handler / Plan 03-01); streaming first, no hard product max beyond that soft cap.

3. **Actor display label**
   - What we know: JWT has `sub`; email may be in `user_metadata` but not guaranteed in access token.
   - What's unclear: Whether officers need human-readable names in timeline.
   - Recommendation: Show `actor_id` (short) in Phase 3; enrich later if needed.
   - **RESOLVED:** Timeline shows truncated `actor_id` (or Officer label); no email/name join in Phase 3.

## Sources

### Primary (HIGH confidence)

- Codebase: `backend/app/api/reports.py`, `backend/app/services/supabase.py`, `backend/app/security.py`, `frontend/src/app/dashboard/**`, `StatusActions.tsx`, `supabase/migrations/20260720_000001_foundation.sql`
- [CITED: https://tanstack.com/table/v8/docs/guide/pagination] — manualPagination / pageCount
- [CITED: https://tanstack.com/table/v8/docs/framework/react/guide/table-state] — controlled sorting/visibility
- [CITED: https://ui.shadcn.com/docs/components/data-table] — TanStack + column visibility UI
- [CITED: https://fastapi.tiangolo.com/advanced/custom-response/] — StreamingResponse / FileResponse
- [CITED: https://xlsxwriter.readthedocs.io/working_with_memory.html] — constant_memory
- [VERIFIED: npm registry] `@tanstack/react-table@8.21.3` legitimacy OK
- [VERIFIED: PyPI] `XlsxWriter==3.2.9`

### Secondary (MEDIUM confidence)

- WebSearch cross-checks for FastAPI CSV streaming patterns (aligned with official StreamingResponse docs)
- GSD package-legitimacy seam (nuqs SUS; XlsxWriter SUS unknown-downloads)

### Tertiary (LOW confidence)

- Soft export row cap magnitude (A3)
- Exact actor display formatting (A4)

## Metadata

**Research scope:**

- Core technology: FastAPI list/summary/export + Supabase keyset filters + Next officer dashboard table
- Ecosystem: TanStack Table, shadcn, XlsxWriter, next-intl
- Patterns: cursor pagination, streaming export, note-gated resolve, URL filter sync
- Pitfalls: denormalized status, route ordering, memory-safe xlsx, actor_id claim source

**Confidence breakdown:**

- Standard stack: **HIGH** — packages verified on npm/PyPI + official docs; nuqs deliberately avoided
- Architecture: **HIGH** — mapped to existing CityMind seams and locked CONTEXT decisions
- Pitfalls: **HIGH** — confirmed by reading current sink (Python status filter) and migration (no actor_id)
- Code examples: **MEDIUM** — patterns from official docs; CityMind-specific snippets are adaptations

**Research date:** 2026-07-20  
**Valid until:** 2026-08-19 (30 days — stable table/export stack)

---

*Phase: 03-dashboard-polish*  
*Research completed: 2026-07-20*  
*Ready for planning: yes*
