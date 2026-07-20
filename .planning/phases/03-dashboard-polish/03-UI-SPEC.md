---
phase: 3
slug: dashboard-polish
status: approved
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables; primary Clinic Blue #2563EB (inherits Phase 1/2 tokens in globals.css)
created: 2026-07-20
inherits: .planning/phases/02-public-experience/02-UI-SPEC.md
sources:
  - 03-CONTEXT.md (D-01–D-22 locked)
  - 03-RESEARCH.md (TanStack Table, Dialog confirm, streaming export, limit 25)
  - PRODUCT.md (register: product; officers decide; AI advisory)
  - DESIGN.md (Clinic Blue, Source Sans 3, light-only, flat-by-default)
  - impeccable product register (fixed rem, 150–250ms, no decorative motion)
  - REQUIREMENTS DATA-04..07, DASH-02..07
  - frontend/src/app/globals.css (live tokens — --primary: #2563EB)
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for **Dashboard Polish** (officer product UI). Inherits Phase 1/2 Clinic Blue tokens; applies **product register** density — not public marketing hero aesthetic.
> Scope: Reports data table, filter chrome, filtered metrics, export controls, detail section order + advisory AI, resolve/reject confirm with note, loading/empty/error states.
> Out of scope: DASH-08 status-link copy (Phase 4), analytics charts (Phase 5), maps (Phase 6), Phase 7 triage UX.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized — `frontend/components.json`) |
| Preset | `style: radix-nova`, `baseColor: neutral`, CSS variables; `--primary` = Clinic Blue `#2563EB` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react |
| Font | Source Sans 3 only (400 / 600) — same as Phase 1/2 |
| Register | **product** (officer ops tool) |

**Stack locks (from RESEARCH, agent discretion):**

| Concern | Contract |
|---------|----------|
| Table | `@tanstack/react-table@8.21.3` + shadcn `Table` (`manualPagination` / `manualSorting`) |
| Confirm UI | shadcn **Dialog** for resolve/reject note gate (D-12) — not Sheet-as-first; Dialog only when note required |
| URL sync | Native Next.js `searchParams` / `URLSearchParams` — do not add `nuqs` |
| Default page size | `limit=25` (API max still 100) |
| Export | FastAPI stream; Next BFF proxies download — browser never buffers full set |

**Phase 3 component install set (shadcn official only):** `table`, `dialog`, `checkbox`, `select`, `popover`, `collapsible` (add if missing). Reuse existing: `button`, `badge`, `input`, `label`, `textarea`, `alert`, `skeleton`, `dropdown-menu`, `sheet`, `sidebar`, `separator`, `tooltip`.

**Registry:** shadcn official only — `registries: {}`. No third-party blocks.

---

## Spacing Scale

Declared values (multiples of 4) — inherits Phase 1/2:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge inner pad, table cell micro-gaps |
| sm | 8px | Compact toolbar gaps, filter field stack |
| md | 16px | Default; filter row gap; section stack |
| lg | 24px | Panel / section padding; metrics strip gap |
| xl | 32px | Page header → chrome gap |
| 2xl | 48px | Rare major breaks (detail section group) |
| 3xl | 64px | Not used for table density — reserve for public only |

Exceptions:
- **44px** min touch height for primary actions (Export, Clear filters, Resolve/Reject, dialog Confirm)
- Table row height target **48px** (2xl) for compact ops density; header row **40–44px**
- Icon-only column-visibility / sort controls: hit area ≥ **44×44**, visual icon may be 16–20px

---

## Typography

Product UI: **fixed rem**, not fluid clamps in tables/chrome. Exactly 4 sizes, 2 weights:

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px (0.875rem) | 400 | 1.4 | Column headers, filter labels, badges, helpers, metrics captions, timeline meta |
| Body | 16px (1rem) | 400 | 1.5 | Table summary cells, description, AI prose, dialog body, empty/error copy |
| Heading | 20px (1.25rem) | 600 | 1.2 | Page title “Reports”, detail section titles, dialog title |
| Display | 28px (1.75rem) | 600 | 1.2 | Detail page report category title only — **no clamp** on dashboard |

**Rules:**
- No third weight (no 500/700).
- No Display in table chrome, filters, or metrics.
- Truncated summary in table: Body 16px or Label 14px — pick **Label 14px** for dense ops; full text on detail.
- Monospace only for raw urban-context JSON (existing pattern) — not for IDs in table (use Label).

---

## Color

60 / 30 / 10 restrained civic (light-only) — live tokens in `globals.css` / `DESIGN.md`:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Main canvas, table surface, dialog |
| Secondary (30%) | `#F1F5F9` | Sidebar, header bar, metrics strip wells, filter panel bg when expanded, zebra optional off |
| Accent (10%) | `#2563EB` | Reserved list below (Clinic Blue) |
| Accent deep | `#1D4ED8` | Hover / pressed primary |
| Soft accent | `#EFF6FF` | Selected row wash / advisory AI panel tint (not primary CTA) |
| Destructive | `#DC2626` | Reject confirm primary, validation errors, error Alert |
| Ink | `#1A2B3C` | Body, headings, table data |
| Muted text | `#64748B` | Helpers, timestamps, column headers at rest |
| Quiet line | `#E2E8F0` | Table borders, filter strokes, separators |

Accent reserved for (only):
1. Primary actions: **Export** (menu/button), **Mark as reviewing**, dialog **Confirm** (resolved path), active sidebar item
2. Focus-visible rings on interactive controls
3. Sortable column header active indicator (chevron / underline)
4. Selected / hover row: soft accent wash `#EFF6FF` or `secondary` — **not** full Clinic Blue fills on every row
5. Status “resolved” success cue may use Clinic Blue **text + icon**, never Clinic Blue flood backgrounds

**Not accent:** default table grid lines, inactive filter chrome, icons at rest, skeleton pulses, metric numbers (ink).

**Status color + text (WCAG — never color alone):**
| Status | Visual | Text |
|--------|--------|------|
| new | Badge secondary + muted | “New” / “Mới” |
| reviewing | Badge soft-accent + ink | “Reviewing” / “Đang xem xét” |
| resolved | Badge with Clinic Blue text + check icon | “Resolved” / “Đã xử lý” |
| rejected | Badge with destructive text + x icon | “Rejected” / “Từ chối” |

Priority/severity: text label + optional muted badge; do not encode priority as color-only dots.

**Forbidden:** purple SaaS gradients, dark cyber neon shells, cream/sand body, ghost-cards (border + huge shadow), radius > 16px on panels. No Civic Teal (`#0F766E` / `#E2ECE9`) — brand is Clinic Blue only.

---

## Visual hierarchy & focal points

| Surface | First focal | Second | Must not compete |
|---------|-------------|--------|------------------|
| Reports list | Data table of reports | Filter toolbar + metrics strip | Decorative charts, card grid revival |
| Filter chrome | Collapsible “Filters” control + Clear | Active filter chips / filled fields | Permanent left filter rail |
| Metrics strip | Four filtered counts (existing summary fields) | — | Global-only totals while filters active |
| Export | Export split button / menu (CSV · Excel) | Focus when `?focus=export` | Separate orphan Export page |
| Detail | Header meta (id, status, category/priority/severity) | Citizen description → evidence → AI advisory | AI block as hero authority |
| Resolve | StatusActions at bottom | Dialog with required note | Inline resolve from table rows |

---

## Layout density (table)

| Property | Contract |
|----------|----------|
| Pattern | Compact data table — **replaces** Phase 2 card list on `/dashboard` (D-02) |
| Default columns | `report_id`, `created_at`, category, priority, status, truncated summary (D-01) |
| Hidden by default | `severity` — available via column visibility |
| Row interaction | Entire row clickable → `/dashboard/reports/[reportId]` (D-03); keyboard: Enter/Space on focused row |
| Bulk select | **None** this phase |
| Page size | 25 rows; cursor prev/next (no page-number OFFSET UI) |
| Sort | Server-driven: `created_at` (default desc), priority, status, category |
| Horizontal overflow | Table scrolls horizontally on narrow viewports; sticky first column optional, not required |
| Main width | Dashboard `main` may widen toward full content width for table (override Phase 2 `max-w-6xl` constraint on Reports view only if needed for readability) |
| Elevation | Flat table: 1px quiet border, **no** card shadow under table. Filter panel: border or secondary fill, radius ≤ 16px (`rounded-lg`) |
| Metrics strip | Single horizontal row of 4 metric cells above table; Label caption + Heading/Body value; no sparkline charts |

---

## Copywriting Contract

EN defaults; VI natural equivalents in `frontend/messages/{en,vi}.json` (`dashboard`, `empty`, `error`, and new keys as needed). Do not leave hardcoded English in new chrome.

### Shared / list

| Element | EN | VI |
|---------|----|----|
| Page title | Reports | Báo cáo |
| Page subtitle | Filter, review, and export citizen reports. AI suggestions stay advisory — you decide. | Lọc, xem xét và xuất báo cáo công dân. Gợi ý AI chỉ mang tính hỗ trợ — bạn quyết định. |
| Primary CTA (list) | Export reports | Xuất báo cáo |
| Export CSV | Download CSV | Tải CSV |
| Export Excel | Download Excel | Tải Excel |
| Export in progress | Preparing export… | Đang chuẩn bị tệp xuất… |
| Export failed | Could not export reports. Check your connection and try again. | Không thể xuất báo cáo. Kiểm tra kết nối và thử lại. |
| Columns | Columns | Cột |
| Filters (toggle) | Filters | Bộ lọc |
| Clear filters | Clear filters | Xóa bộ lọc |
| Apply filters | Apply filters | Áp dụng bộ lọc |
| Metric: total | Total reports | Tổng số báo cáo |
| Metric: critical | Critical | Nghiêm trọng |
| Metric: avg severity | Avg severity | Mức độ TB |
| Metric: top category | Top category | Nhóm hàng đầu |
| Empty heading (filtered) | No reports match these filters | Không có báo cáo nào khớp với bộ lọc |
| Empty body (filtered) | Clear filters or adjust status, category, priority, or dates. | Xóa bộ lọc hoặc điều chỉnh trạng thái, nhóm, mức ưu tiên hoặc ngày. |
| Empty heading (none) | No reports yet | Chưa có báo cáo |
| Empty body (none) | Citizen reports will appear here after submission. | Báo cáo của người dân sẽ hiện ở đây sau khi gửi. |
| Error load | Could not load reports. Check your connection and try again. | Không thể tải danh sách báo cáo. Kiểm tra kết nối và thử lại. |
| Error API | Could not connect to the CityMind API. | Không thể kết nối đến API CityMind. |
| Pagination next | Next | Tiếp |
| Pagination prev | Previous | Trước |
| Sort ascending | Sorted ascending | Đã sắp xếp tăng dần |
| Sort descending | Sorted descending | Đã sắp xếp giảm dần |

### Detail

| Element | EN | VI |
|---------|----|----|
| Back link | Back to reports | Quay lại danh sách báo cáo |
| Section: citizen | Citizen report | Báo cáo của người dân |
| Section: evidence | Evidence | Bằng chứng |
| Section: AI | AI analysis (advisory) | Phân tích AI (tham khảo) |
| AI disclaimer | AI-generated analysis is advisory. An officer remains responsible for verification and the final decision. | Phân tích do AI tạo chỉ mang tính tham khảo. Cán bộ chịu trách nhiệm xác minh và quyết định cuối. |
| Section: urban | Urban context | Bối cảnh đô thị |
| Urban helper | Supporting context only; not a prediction or verified fact. | Chỉ là thông tin hỗ trợ; không phải dự đoán hay sự kiện đã xác minh. |
| Section: timeline | Status history | Lịch sử trạng thái |
| Timeline empty | No status changes yet. | Chưa có thay đổi trạng thái. |
| Section: actions | Officer decision | Quyết định của cán bộ |
| Not found | Report not found | Không tìm thấy báo cáo |
| Actor label | Officer | Cán bộ |

### Resolve / reject (destructive + gated)

| Element | EN | VI |
|---------|----|----|
| Mark reviewing | Mark as reviewing | Đánh dấu đang xem xét |
| Resolve | Mark as resolved | Đánh dấu đã xử lý |
| Reject | Mark as rejected | Đánh dấu từ chối |
| Dialog title (resolve) | Resolve report | Xác nhận đã xử lý |
| Dialog title (reject) | Reject report | Xác nhận từ chối |
| Note label | Decision note (required) | Ghi chú quyết định (bắt buộc) |
| Note placeholder | Explain the decision for the audit trail… | Giải thích quyết định để lưu hồ sơ… |
| Note validation | A note is required to resolve or reject. | Cần ghi chú để xác nhận đã xử lý hoặc từ chối. |
| Confirm resolve | Confirm resolve | Xác nhận đã xử lý |
| Confirm reject | Confirm reject | Xác nhận từ chối |
| Dialog dismiss | Keep editing | Giữ nguyên |
| Updating | Updating… | Đang cập nhật… |
| Status error | Status update failed. Try again. | Cập nhật trạng thái thất bại. Thử lại. |

**Destructive confirmation (Reject):** Dialog title “Reject report” + required note + destructive Confirm button. “Keep editing” / “Giữ nguyên” dismisses with no change (D-12).

---

## Components

| Component | Contract |
|-----------|----------|
| `ReportsTable` | TanStack + shadcn Table; lean default columns; severity hidden; row → detail; column visibility Dropdown + checkboxes; persist visibility key `citymind.dashboard.columnVisibility` (localStorage) |
| `ReportsFilters` | Collapsible panel above table (D-06): status, category, priority, severity range, date range; single Clear filters (D-07); sync to URL (D-09) |
| `ReportsMetrics` | Filtered summary strip (D-08): total_reports, critical_reports, avg_severity, top_category — same filters as list |
| `ExportButton` | Split or Dropdown: CSV / Excel; applies current filters (D-15); loading + error states (D-22); sidebar Export → `/dashboard?focus=export` focuses control (D-17) |
| Status badges | Text + icon/color; capitalize status labels from catalog |
| `StatusActions` | Extend existing: `reviewing` immediate; `resolved`/`rejected` open Dialog with required note (D-10–D-14); no table-row resolve |
| Detail layout | Section order **strict** per D-19 (see Interaction) |
| AI block | Soft-accent / secondary panel + “advisory” heading + disclaimer Alert — never primary Clinic Blue authority chrome (D-20) |
| Timeline | Newest-first; status, note, actor (truncated `actor_id` or “Officer”), timestamp (D-21) |
| Skeleton | Table: header + 8–10 row skeletons; Detail: header + section blocks; Export: button loading state |
| Empty | Dashed quiet-line region, centered Label/Body copy from contract |
| Error | shadcn `Alert` `variant="destructive"` with retry guidance |

**Button shapes (product vs public):** Dashboard primary actions use **md radius (8px)**, not public pill CTAs — consistency with ops chrome. Min-height 44px.

---

## Interaction

### Reports list flow
1. Officer lands on `/dashboard` → RSC loads filtered page via `searchParams` + `officerFetch`.
2. Toolbar: Filters (collapse), Columns, Export.
3. Changing filters/sort updates URL and refetches list + summary together.
4. Cursor pagination: Next enabled when `next_cursor` present; Previous via history or stored prev cursor stack — no fake page numbers.
5. Row click / keyboard activate → detail route.

### Export
1. Click Export → choose CSV or Excel.
2. BFF proxies streaming download with current filter query string.
3. While preparing: disable control, show “Preparing export…”.
4. On failure: Alert with EN/VI “Could not export reports…” / “Không thể xuất báo cáo…”; control re-enabled.
5. `?focus=export` on mount: focus Export control (scroll into view if needed).

**Export columns (D-16 / RESEARCH) — locked order:**
1. Lean ops defaults: `report_id`, `created_at`, category, priority, status, truncated summary
2. Plus: `severity`
3. Plus: `recommendation` (AI advisory field)
4. Plus: latest status note when available

Streaming/chunked response for large sets — do not load entire result into browser memory.

### Detail section order (D-19) — locked
1. **Header meta** — id, status badge, timestamps, category / priority / severity  
2. **Citizen description**  
3. **Evidence** — image + evidence signals  
4. **AI analysis (advisory)** — summary, recommendation, evidence/uncertainty + disclaimer  
5. **Urban context**  
6. **Status timeline** (newest-first, actor + note + time)  
7. **Resolve actions** (`StatusActions`)

### Resolve / reject (D-11–D-14)
1. **Mark as reviewing** — immediate PATCH, no dialog, note optional.
2. **Mark as resolved / rejected** — open Dialog; note textarea required (trim nonempty); “Keep editing” closes without PATCH.
3. Confirm → PATCH with note; server 422 if missing; client shows validation; on success `router.refresh()`.
4. Actor from JWT `sub` only — never collect actor in UI.

### Motion
- State transitions only: 150–250ms (`ease-out-expo` token ok).
- Collapsible filters, dialog overlay, row hover — no page-load choreography.
- Honor `prefers-reduced-motion` (existing globals rule).

---

## Accessibility

| Requirement | Contract |
|-------------|----------|
| Standard | WCAG 2.2 AA |
| Focus | Visible Clinic Blue ring (`outline` / `--ring`) on all interactive controls |
| Touch | ≥44px targets for primary actions |
| Table | `<table>` semantics via shadcn Table; sortable headers are `<button>` with `aria-sort` |
| Row nav | Rows focusable or include clear “Open” link per row for SR users if whole-row click is mouse-only |
| Dialog | Focus trap, Escape closes, restore focus to trigger; labelled by title; note field `aria-required` |
| Status | Never color-alone — text (+ icon) |
| Live regions | Export/status errors use `role="alert"` or Alert component |
| Reduced motion | No decorative motion; collapse/dialog instant or ≤1ms under prefers-reduced-motion |
| Language | All new strings in next-intl EN+VI; locale switcher remains in dashboard header |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `table`, `dialog`, `checkbox`, `select`, `popover`, `collapsible` (+ existing primitives) | not required |
| Third-party | none | n/a |

---

## Anti-patterns (this phase)

| Anti-pattern | Why banned |
|--------------|------------|
| Keeping Phase 2 card grid beside the table | Violates D-02 |
| Bulk-select / bulk resolve from list | Violates D-03 / D-10 |
| Inline resolve buttons on table rows | Mis-click risk; D-10 |
| Permanent left filter rail | Sidebar owns nav; D-06 |
| Global-only metrics while filters active | Violates DATA-05 / D-08 |
| Client-side SheetJS of full filtered set | Violates D-16 |
| Separate Export page with different semantics | Violates D-17 |
| AI block styled as final authority (primary flood / “Decision”) | Violates D-20 / PRODUCT |
| Modal for every status including reviewing | Prefer Dialog only when note required; reviewing is immediate |
| Fluid display clamps / second font in table chrome | Product register + Source Sans 3 only |
| Ghost-card table (border + large shadow) / radius > 16px | DESIGN + product flat-by-default |
| Purple SaaS / dark neon / cream body | Brand + PRODUCT anti-references |
| Civic Teal accents (`#0F766E` / `#E2ECE9`) | Stale brand — live primary is Clinic Blue `#2563EB` |
| Decorative motion / page-load sequences | Product register |
| OFFSET pagination UI | DATA-04 cursor contract |
| Inventing actor email in UI from client | Actor from JWT `sub` only |
| DASH-08 status link copy affordance | Deferred Phase 4 |
| Charts / SLA widgets | Phase 5 |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
