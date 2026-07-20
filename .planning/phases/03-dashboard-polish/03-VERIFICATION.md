---
phase: 03-dashboard-polish
verified: 2026-07-20T16:15:00Z
status: gaps_found
score: 12/13 must-haves verified
overrides_applied: 0
gaps:
  - truth: "List and detail views show loading states with UI-SPEC skeletons (D-22 / DASH-07)"
    status: failed
    reason: "Empty and error states exist, but UI-SPEC-required table/detail Skeleton loading UI is absent — no dashboard loading.tsx and no Skeleton usage under dashboard/reports components."
    artifacts:
      - path: "frontend/src/app/dashboard/page.tsx"
        issue: "Async RSC awaits data with no loading.tsx / Suspense skeleton boundary for the list surface"
      - path: "frontend/src/app/dashboard/reports/[reportId]/page.tsx"
        issue: "Detail page has empty/error/not-found copy but no skeleton loading state"
      - path: "frontend/src/components/reports/ReportsTable.tsx"
        issue: "Renders empty/error paths and table; no Skeleton row placeholders"
    missing:
      - "Add frontend/src/app/dashboard/loading.tsx (and optionally reports/[reportId]/loading.tsx) with UI-SPEC table/detail skeletons (header + 8–10 rows / section blocks)"
      - "Wire Skeleton from @/components/ui/skeleton on list and detail loading surfaces"
human_verification:
  - test: "Log in as officer → open /dashboard → apply status filter → confirm metrics change and Next cursor paginates"
    expected: "TanStack table (not cards), filters in URL, metrics match filtered set, Next advances via next_cursor"
    why_human: "Live filter/sort/pagination UX and metrics correctness need a running stack + seeded data"
  - test: "With filters active, Export CSV then Excel; use sidebar Export to land on ?focus=export"
    expected: "Downloads apply current filters; control shows Preparing export… then file; focus moves to Export control"
    why_human: "Browser download + focus behavior cannot be proven by static grep"
  - test: "Open a report detail → Mark reviewing → Resolve with empty note (blocked) → Confirm with note → Reject Keep editing"
    expected: "Section order matches D-19; AI advisory disclaimer visible; timeline shows actor; reviewing immediate; resolve/reject Dialog note-gated; cancel no-op; timeline refreshes with actor_id"
    why_human: "Dialog interaction, refresh, and audit trail need live JWT + DB"
---

# Phase 3: Dashboard Polish Verification Report

**Phase Goal:** As an officer, I want to filter, paginate, export, and resolve reports with audited notes, so that I can operate the queue with evidence and accountability.
**Verified:** 2026-07-20T16:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification
**Mode:** mvp

> Note: `gsd-sdk query user-story.validate` returns `valid: false` for this goal because the checker requires a literal `"As a "` prefix and rejects grammatically correct `"As an officer"`. The ROADMAP goal is a proper user story; verification proceeds under MVP framing.

## User Flow Coverage

User story: As an officer, I want to filter, paginate, export, and resolve reports with audited notes, so that I can operate the queue with evidence and accountability.

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open queue | Officer lands on `/dashboard` with data table | `frontend/src/app/dashboard/page.tsx` renders `ReportsTable` (no `ReportCard`) | ✓ |
| Filter / sort / paginate | Collapsible filters + URL sync + cursor Next | `ReportsFilters.tsx`, `ReportsTable.tsx` `goNext`/`nextCursor`, page fetches `/recent` + `/summary` | ✓ |
| Export filtered set | CSV/XLSX via BFF with current filters | `ExportButton.tsx` + `api/officer/reports/export/route.ts` + FastAPI `/export` | ✓ |
| Resolve with audit | Dialog note + JWT `actor_id` on status events | `StatusActions.tsx` Dialog; `reports.py` note gate + `officer.actor_id`; timeline shows `actor_id` | ✓ |
| Outcome | Operate queue with evidence & accountability | Detail D-19 hierarchy + advisory AI + timeline + note-gated resolve | ✓ (code); live UAT still human |
| Loading polish (DASH-07) | Table/detail skeletons while fetching | No `dashboard/**/loading.tsx`; no Skeleton under dashboard reports | ✗ |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Officer filters, sorts, and paginates reports in a data table | ✓ VERIFIED | TanStack `manualPagination`/`manualSorting`; filters sync URL; `next_cursor` pagination |
| 2 | Officer exports filtered reports to Excel/CSV | ✓ VERIFIED | `ExportButton` + streaming BFF + FastAPI CSV/`XlsxWriter` constant_memory |
| 3 | Officer resolves/rejects with required note; actor recorded in status history | ✓ VERIFIED | Client Dialog + server 422 blank note; `actor_id=officer.actor_id` from JWT `sub`; timeline renders `actor_id` |
| 4 | Detail page shows full AI analysis, evidence, and status timeline | ✓ VERIFIED | D-19 order in `[reportId]/page.tsx`: meta → citizen → evidence → AI advisory → urban → timeline → actions |
| 5 | GET `/api/v1/reports/recent` cursor+limit with opaque `next_cursor` keyset ordering (DATA-04) | ✓ VERIFIED | `reports.py` `/recent`; `encode_cursor`/`_apply_keyset` in `supabase.py` |
| 6 | GET `/summary` applies same filters as list (DATA-05) | ✓ VERIFIED | Shared `_apply_filters` / `_validate_report_filters`; dashboard passes same filter QS |
| 7 | GET `/export` streams CSV/XLSX of filtered set (DATA-06) | ✓ VERIFIED | `StreamingResponse`; `iter_filtered`; registered before `/{report_id}` |
| 8 | Status PATCH persists `actor_id` from JWT; 422 when resolve/reject note blank (DATA-07) | ✓ VERIFIED | `OfficerPrincipal.actor_id`; note gate lines 416–417; sink insert includes `actor_id` |
| 9 | Compact TanStack/shadcn table; lean columns; severity hidden until toggled (DASH-02) | ✓ VERIFIED | `ReportsTable.tsx` + `citymind.dashboard.columnVisibility`; `severity: false` default |
| 10 | Collapsible filters + Clear + URL sync; metrics use same filters (DASH-03) | ✓ VERIFIED | `ReportsFilters` Collapsible; `ReportsMetrics`; `buildReportsQuery` shared |
| 11 | List/detail/export empty & error states; list/detail **loading skeletons** (DASH-07) | ✗ FAILED | Empty/error ✓ (`empty.*`, destructive `Alert`, export preparing/failed). **Loading skeletons missing** for list/detail (UI-SPEC Skeleton row) |
| 12 | Detail advisory AI + newest-first actor timeline + Dialog resolve (DASH-04/05) | ✓ VERIFIED | `detailAiTitle`/`detailAiDisclaimer`; Dialog Confirm/Keep editing; reviewing immediate |
| 13 | Export button + sidebar `?focus=export` focuses control (DASH-06 / D-17) | ✓ VERIFIED | `DashboardSidebar` url `/dashboard?focus=export`; `ExportButton` focus effect |

**Score:** 12/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `supabase/migrations/20260720_000002_dashboard_polish.sql` | `current_status` + `actor_id` + indexes/backfill | ✓ VERIFIED | Present; remote push intentionally skipped per env note — local SQL exists |
| `backend/app/security.py` | `OfficerPrincipal` with JWT `sub` | ✓ VERIFIED | Frozen principal; `actor_id` from `payload["sub"]` |
| `backend/app/api/reports.py` | Cursor list, filtered summary, streaming export, note gate | ✓ VERIFIED | Substantive + wired |
| `backend/tests/test_export.py` | Export auth + content-type | ✓ VERIFIED | File + tests present (env missing `filetype` blocked local pytest run) |
| `frontend/src/components/reports/ReportsTable.tsx` | TanStack manual table | ✓ VERIFIED | Wired from dashboard page |
| `frontend/src/components/reports/ReportsFilters.tsx` | Collapsible filters + URL | ✓ VERIFIED | Wired |
| `frontend/src/components/reports/ReportsMetrics.tsx` | Filtered metrics strip | ✓ VERIFIED | Wired |
| `frontend/src/app/dashboard/reports/[reportId]/page.tsx` | D-19 + advisory + actor | ✓ VERIFIED | Wired |
| `frontend/src/components/StatusActions.tsx` | Dialog note gate | ✓ VERIFIED | Wired to status BFF |
| `frontend/src/components/ui/dialog.tsx` | shadcn Dialog | ✓ VERIFIED | Imported by StatusActions |
| `frontend/src/components/reports/ExportButton.tsx` | CSV/XLSX + loading/error | ✓ VERIFIED | Preparing + failed Alert |
| `frontend/src/app/api/officer/reports/export/route.ts` | Auth stream proxy | ✓ VERIFIED | `getClaims` + body passthrough |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `security.py` | `supabase.py` | Principal `actor_id` into `update_status` | ✓ WIRED | `reports.py` passes `actor_id=officer.actor_id` |
| `reports.py` | `supabase.py` | keyset list + filtered summary + `iter_filtered` export | ✓ WIRED | Patterns `next_cursor`, `StreamingResponse`, `/export` |
| `dashboard/page.tsx` | `/recent` + `/summary` | `officerFetch` + searchParams | ✓ WIRED | Parallel fetch; no ReportCard |
| `StatusActions.tsx` | status BFF route | PATCH status+note; `router.refresh` | ✓ WIRED | `searchParams.set("note", …)` |
| Detail page | `status_events.actor_id` | history fetch + truncate label | ✓ WIRED | `truncateActor(item.actor_id)` |
| `ExportButton.tsx` | export BFF | filter QS + `format=csv\|xlsx` | ✓ WIRED | |
| `DashboardSidebar.tsx` | dashboard page | `focus=export` | ✓ WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `dashboard/page.tsx` | `rows` / `metrics` | `officerFetch` → FastAPI → Supabase | Yes (DB-backed when configured) | ✓ FLOWING |
| `ReportsMetrics` | `metrics` props | Same summary response | Yes | ✓ FLOWING |
| Detail page | `report` / `history` | `officerFetch` get + status-history | Yes | ✓ FLOWING |
| `ExportButton` | download blob | BFF → FastAPI `iter_filtered` | Yes (client buffers blob for save) | ✓ FLOWING (see warning) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Frontend dashboard smoke suite | `cd frontend && node --test tests/dashboard-table.test.mjs tests/dashboard-detail.test.mjs tests/dashboard-export.test.mjs` | 14/14 pass | ✓ PASS |
| Backend cursor/summary/actor/export tests | `pytest …` (system Python) | `ModuleNotFoundError: filetype` — env incomplete | ? SKIP |
| User-story SDK validate | `gsd-sdk query user-story.validate` | Rejects `"As an"` | ? SKIP (false negative) |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No phase-declared `scripts/*/tests/probe-*.sh` | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DATA-04 | 03-01 | Cursor pagination on list API | ✓ SATISFIED | `/recent` cursor+limit+`next_cursor`; keyset encode |
| DATA-05 | 03-01 | Summary respects filters | ✓ SATISFIED | `/summary` filter params + `_apply_filters` |
| DATA-06 | 03-01 | Excel/CSV export streams filtered data | ✓ SATISFIED | Streaming CSV + constant_memory XLSX |
| DATA-07 | 03-01 | Status updates record JWT `actor_id` | ✓ SATISFIED | Principal + sink insert |
| DASH-02 | 03-02 | Data table sort/pagination/column visibility | ✓ SATISFIED | TanStack table + localStorage visibility |
| DASH-03 | 03-02 | Advanced filters | ✓ SATISFIED | status/category/priority/severity/date + Clear |
| DASH-04 | 03-03 | Detail evidence/AI/context/history | ✓ SATISFIED | D-19 sections |
| DASH-05 | 03-03 | Resolve workflow with required note | ✓ SATISFIED | Dialog + server 422 |
| DASH-06 | 03-04 | Excel export applies current filters | ✓ SATISFIED | `buildReportsQuery` into export BFF |
| DASH-07 | 03-02/03/04 | Loading, empty, error on dashboard views | ✗ BLOCKED | Empty/error/export-loading OK; **list/detail loading skeletons missing** |

All Phase 3 requirement IDs from PLAN frontmatter are accounted for (no orphaned Phase 3 IDs outside the listed set).

`REQUIREMENTS.md` still marks DATA-04..07 as unchecked / Pending while DASH-02..07 are checked — bookkeeping lag; code evidence supports DATA-04..07 as implemented.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `frontend/src/components/reports/ExportButton.tsx` | ~66 | `await res.blob()` buffers full download in browser | ⚠️ Warning | Server streams correctly; large exports still materialize client-side (D-16 soft risk). Prefer navigation/`Content-Disposition` download if memory matters |
| Phase 3 dashboard surfaces | — | Missing Skeleton / `loading.tsx` | 🛑 Blocker | Fails DASH-07 / UI-SPEC loading contract |
| — | — | No TBD/FIXME/XXX debt markers in Phase 3 core files | ✓ | — |

Pre-existing `ReportStarterBar` missing import on public Home is **not** scored as a Phase 3 failure (env note + deferred-items.md).

### Human Verification Required

### 1. Filter / sort / paginate queue

**Test:** Log in → `/dashboard` → apply status (and other) filters → sort → Next cursor  
**Expected:** Table (not cards); URL updates; metrics change with filters; Next uses `next_cursor`  
**Why human:** Needs live auth + data

### 2. Export filtered CSV/XLSX + sidebar focus

**Test:** Filter → Export CSV/Excel; click sidebar Export  
**Expected:** Files reflect filters; Preparing state; `?focus=export` focuses control  
**Why human:** Download + focus UX

### 3. Detail resolve with audited note

**Test:** Detail → reviewing → resolve empty (blocked) → resolve with note → reject dismiss  
**Expected:** D-19 order; advisory AI; actor on timeline; Dialog gate; cancel no-op  
**Why human:** End-to-end JWT actor + refresh

### Gaps Summary

Core officer outcomes (filter/paginate/export/resolve/detail evidence) are implemented and wired end-to-end. **One must-have fails:** DASH-07 loading skeletons for list and detail are specified in UI-SPEC and plan truths but not present in the codebase (only export “Preparing…” and empty/error paths). Close by adding `loading.tsx` (and/or Suspense fallbacks) with Skeleton placeholders, then re-verify.

Structured `gaps:` in frontmatter ready for `/gsd-plan-phase --gaps`.

---

_Verified: 2026-07-20T16:15:00Z_
_Verifier: Claude (gsd-verifier)_
