# Phase 3: Dashboard Polish - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a production-grade officer dashboard: replace the Phase 2 card list with a filterable/sortable/paginated data table; stream Excel/CSV export of the filtered set; require notes on resolve/reject with actor recorded in status history; polish the detail page for AI analysis, evidence, urban context, and status timeline; ship loading/empty/error states on all dashboard views.

**In scope:** DATA-04, DATA-05, DATA-06, DATA-07, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07.

**Out of scope this phase:** Citizen status link copy (DASH-08 → Phase 4); public `/status` page (Phase 4); BigQuery analytics ETL/charts (Phase 5); PostGIS/MapLibre geo filters (Phase 6); self-help vs government AI triage (Phase 7); email/SMS notifications.

</domain>

<decisions>
## Implementation Decisions

### Table & columns
- **D-01:** Default columns are **lean ops**: `report_id`, `created_at`, category, priority, status, truncated summary. Severity is available via **column visibility** but **hidden by default**.
- **D-02:** Reports view uses a **compact data table** (not cards). Phase 2 card list is replaced on `/dashboard` (Reports), not kept in parallel.
- **D-03:** **Row click** navigates to `/dashboard/reports/[reportId]`. No bulk-select / bulk-status actions in Phase 3.
- **D-04:** List API uses **cursor pagination** (`cursor` + `limit`) per DATA-04. Default sort: `created_at` descending. Support sort on priority, status, category, and created_at.
- **D-05:** Officers can toggle column visibility (DASH-02). Persist visibility in client preference only (cookie/localStorage) — not a server profile.

### Filter chrome
- **D-06:** Filters live in a **collapsible panel above the table** (toolbar + expandable advanced section). Do not use a permanent left filter rail — sidebar already owns navigation.
- **D-07:** Filter set per DASH-03: status, category, priority, severity range, date range. Include a single **Clear filters** control.
- **D-08:** **Summary metrics strip** sits above the table and **respects active filters** (DATA-05) — never global-only counts while filters are applied.
- **D-09:** Sync active filters (and sort/page cursor as practical) to **URL query params** so officers can refresh/share a filtered view.

### Resolve / reject flow
- **D-10:** Status transitions happen **only on the detail page** (extend `StatusActions`). Table rows show status badges only — no inline resolve from the list (reduces mis-clicks).
- **D-11:** Workflow: officers may move to `reviewing` without a note; **`resolved` and `rejected` require a non-empty note** (DASH-05).
- **D-12:** Before `resolved`/`rejected`, show a **confirmation UI** (modal or inline panel) with required note textarea; cancel returns without change.
- **D-13:** Status updates record **`actor_id` from the authenticated officer JWT** into append-only `status_events` (DATA-07). Preserve advisory-AI language; officers remain final authority.
- **D-14:** Replace the current note-less one-click buttons in `StatusActions` with the note-gated flow above.

### Export packaging
- **D-15:** Support **both CSV and Excel (.xlsx)** export of the **currently filtered** report set (DASH-06, DATA-06). Button lives on the Reports view next to filters.
- **D-16:** Export columns = lean ops defaults **plus** severity, recommendation, and latest status note when available. Streaming/chunked response for large sets — do not load entire result into browser memory.
- **D-17:** Sidebar **Export** nav item routes to the Reports view with export affordance focused (same filtered export), not a separate orphan page with different semantics.
- **D-18:** Export is officer-authenticated only; same RLS/JWT path as list reads.

### Detail page hierarchy
- **D-19:** Detail section order: **header meta** (id, status, timestamps, category/priority/severity) → **citizen description** → **evidence (image + signals)** → **AI analysis block** (summary, recommendation, evidence/uncertainty — clearly labeled advisory) → **urban context** → **status timeline** → **resolve actions**.
- **D-20:** AI block must remain visually **advisory** (label/disclaimer), never presented as final authority.
- **D-21:** Status timeline is **newest-first**, showing status, note, actor, and timestamp per event.
- **D-22:** Every dashboard surface (table, detail, export-in-progress) implements **loading, empty, and error** states (DASH-07). Empty table copy stays operational (e.g. “No reports match these filters”).

### Agent Discretion
- Table implementation library (e.g. TanStack Table + shadcn primitives vs lighter custom table)
- Exact default `limit` / page size and cursor encoding
- Excel/CSV generation library and whether export runs primarily in FastAPI vs Next BFF
- Exact confirmation UI pattern (dialog vs inline sheet) as long as D-11/D-12 hold
- Visual density tokens within existing Phase 1 theme (light officer chrome; not public civic hero aesthetic)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Milestone v2 goals; AI advisory-only constraint
- `.planning/REQUIREMENTS.md` — DATA-04..07, DASH-02..07 acceptance text
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, track sketch (03-01..03-03)
- `.planning/STATE.md` — Current milestone position and blockers

### Prior phase decisions
- `.planning/phases/01-supabase-foundation/01-CONTEXT.md` — Routes (`/dashboard`), JWT/`@supabase/ssr`, schema JSONB + `status_events`, DASH-01 shell
- `.planning/phases/02-public-experience/02-CONTEXT.md` — Phase 2 cards only (D-16); middleware protects `/dashboard`; defer table/export/resolve to Phase 3

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — Officer proxy flows, status PATCH path
- `.planning/codebase/STRUCTURE.md` — Frontend/backend layout
- `.planning/codebase/STACK.md` — Next.js / FastAPI stack
- `.planning/codebase/CONVENTIONS.md` — Naming and fetch helpers
- `.planning/codebase/INTEGRATIONS.md` — Persistence/auth integrations (note: maps may still mention pre-Supabase MVP paths — prefer Phase 1 CONTEXT for cutover truth)

### Existing implementation touchpoints
- `frontend/src/app/dashboard/page.tsx` — Current card list to replace with table
- `frontend/src/app/dashboard/layout.tsx` — Protected shell / sidebar
- `frontend/src/app/dashboard/reports/[reportId]/page.tsx` — Detail layout to re-order per D-19
- `frontend/src/components/StatusActions.tsx` — Note-less status buttons to replace (D-14)
- `frontend/src/components/DashboardSidebar.tsx` — Export nav item (D-17)
- `frontend/src/lib/backend.ts` — `officerFetch` bearer bridge
- `backend/app/api/reports.py` — Recent/summary/status endpoints to extend for cursor filters + export + actor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `officerFetch` / officer BFF routes — Authenticated list, detail, status, image proxy
- `StatusActions` — Pattern for client status PATCH + `router.refresh()`; must gain note + confirm
- shadcn primitives already in tree (Button, Card, Alert, Sidebar, Input, Label, Dropdown) — add table/dialog/sheet as needed
- Dashboard sidebar nav items: Reports, Export, Settings, Logout

### Established Patterns
- Server Components fetch via `officerFetch`; client islands for mutations
- Locale catalogs via next-intl (`dashboard` / `error` namespaces) — extend for table/filter/export/resolve copy EN+VI
- Append-only status history expected from Phase 1 schema decisions
- AI content treated as advisory in product language

### Integration Points
- Replace `/dashboard` card grid with table + filter chrome + metrics strip
- Extend FastAPI list/summary for cursor pagination, filter params, filtered summary
- Add streaming export endpoint(s) and wire Export button + sidebar Export entry
- Rework detail section order and StatusActions note gate
- Keep auth fail-closed via existing `proxy.ts` / `requireOfficer` path from Phases 1–2

</code_context>

<specifics>
## Specific Ideas

- User selected **all** gray areas then delegated: **“your decision all, don’t ask me more, write the context.”** All decisions above are agent-locked recommendations aligned with REQUIREMENTS and prior phase CONTEXT.
- Prefer operational clarity over dense analytics chrome; charts stay Phase 5.

</specifics>

<deferred>
## Deferred Ideas

- **DASH-08** officer copy of citizen status link — Phase 4
- Public `/status` token lookup — Phase 4
- MapLibre / geo filters on dashboard — Phase 6
- Self-help vs government AI triage (Phase 7) — do not fold classification UX into Phase 3 resolve flow
- Email/SMS on status change — v2 backlog
- Bulk multi-select resolve — out of scope (explicitly rejected via D-03/D-10)

</deferred>

---

*Phase: 3-Dashboard Polish*
*Context gathered: 2026-07-20*
