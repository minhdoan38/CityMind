---
phase: 8
slug: async-triage-platform-refactor
status: draft
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables; primary CityMind Blue #3B71F7 (live globals.css; inherits Phase 3/6 Clinic Blue contract)
created: 2026-07-22
inherits:
  - .planning/phases/03-dashboard-polish/03-UI-SPEC.md
  - .planning/phases/02-public-experience/02-UI-SPEC.md
  - .planning/phases/06-maps-geospatial/06-UI-SPEC.md
sources:
  - .planning/phases/08-async-triage-platform-refactor/08-CONTEXT.md (D-05–D-08, D-13–D-20, D-23)
  - .planning/phases/08-async-triage-platform-refactor/08-RESEARCH.md
  - REQUIREMENTS.md (TRIAGE-01–TRIAGE-04)
  - src/app/[locale]/status/page.tsx
  - src/components/ReportForm.tsx
  - src/app/[locale]/report/success/page.tsx
  - src/app/dashboard/reports/[reportId]/page.tsx
  - src/components/reports/ReportsTable.tsx
  - src/components/reports/ReportsFilters.tsx
  - messages/en.json, messages/vi.json
  - components.json (radix-nova, neutral, lucide)
---

# Phase 8 — UI Design Contract

> Visual and interaction contract for **Async Triage Platform Refactor** — citizen intake/success/status surfaces and officer queue/detail triage visibility.
>
> **Scope:** Persist-first intake (`POST /reports`), success flash token-only, citizen 4-step service progress, AI field gating by `triage_status`, calm failure copy, officer triage badges, default triage-aware sort, optional `triage_status` filter chip, detail section reorder, confidence display rule.
>
> Out of scope: triage worker internals, audit table UI, eval suite (Phase 10), self-help routing (Phase 9), new map surfaces, analytics changes, citizen-facing provider/retry detail.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `components.json`) |
| Preset | `style: radix-nova`, `baseColor: neutral`, CSS variables; `--primary` = CityMind Blue `#3B71F7` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react (`Clock`, `Sparkles`, `UserCheck`, `CheckCircle2`, `XCircle`, `AlertTriangle`, `Loader2`, `Copy`, `Check`) |
| Font | Google Sans Text (400) / Google Sans (600 headings) — live `globals.css`; public + product registers unchanged |
| Register | **public civic** for citizen intake/status/success; **product** for officer dashboard |

**Stack locks (Phase 8 — no new UI dependencies):**

| Concern | Contract |
|---------|----------|
| Intake API | `POST /api/public/reports` — form posts `FormData`; legacy `/analyze` removed (410) |
| Status API | Extended citizen status payload with `triage_status`, `service_step`, `reference_id`; never `triage_error` or provider codes |
| Officer data | `triage_status` on list + detail rows; NULL AI columns until `completed` |
| URL sync | Extend Phase 3 `DashboardSearchParams` with `triage_status` — do **not** add `nuqs` |
| i18n | All new copy in `messages/en.json` + `messages/vi.json` under `public.triage`, `public.statusWorkflow`, `dashboard.triage` |

**Reuse existing:** `alert`, `badge`, `button`, `card`, `collapsible`, `form`, `input`, `label`, `select`, `skeleton`, `table`, `textarea`, `separator`, `tooltip`.

**Phase 8 add (shadcn official only, if missing):** none required — use existing `Badge` variants + optional `ToggleGroup` for filter chips if not already installed.

**Registry:** shadcn official only — `registries: {}`. No third-party blocks.

---

## Spacing Scale

Inherits Phase 3 (dashboard) and Phase 2 (public) — multiples of 4:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Badge icon gaps; step connector micro-gap |
| sm | 8px | Chip row gaps; step label stack |
| md | 16px | Default field stack; status result card padding |
| lg | 24px | Section padding; workflow stepper horizontal gap |
| xl | 32px | Page header → form gap |
| 2xl | 48px | Detail section group breaks |
| 3xl | 64px | Public status page vertical rhythm only |

Exceptions:
- **44px** min touch height: Submit report, Check status, copy buttons, filter chips, Clear triage filter
- **Workflow stepper node:** 32×32 visual circle, **44×44** hit area via padding on mobile
- **Calm notice Alert:** `p-4` (16px) inner; `mt-4` below current-step badge block

---

## Typography

### Public citizen surfaces (status, success, report form)

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px (0.875rem) | 400 | 1.4 | Step captions, reference ID label, timestamps, token field labels |
| Body | 16px (1rem) | 400 | 1.5 | Helper copy, calm failure notice, history notes |
| Heading | 20px (1.25rem) | 600 | 1.2 | Page title, workflow section title, history heading |
| Display | 28px (1.75rem) | 600 | 1.2 | Success page H1 only |

### Officer dashboard (queue + detail)

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px | 400 | 1.4 | Triage badge text, filter chip labels, metric captions |
| Body | 16px | 400 | 1.5 | Table cells, detail prose, NULL placeholders |
| Heading | 20px | 600 | 1.2 | Detail section titles, filter panel label |
| Display | 28px | 600 | 1.2 | Detail category title when `triage_status=completed` only; pending rows use **"Report pending review"** at Heading 20px |

**Rules:**
- Two weights only: 400 and 600.
- Monospace (`font-mono text-sm`) for report ID and access token display only.
- Never show AI confidence as a percentage (D-23). If rendered, Label 14px: **"Model confidence — uncalibrated"** + qualitative band text only (low / medium / high) — no `%`.

---

## Color

60 / 30 / 10 restrained civic (light-only) — inherits Phase 3 tokens:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` / `bg-card` | Status result card, table surface, success card |
| Secondary (30%) | `#F0F3F9` / `bg-muted` | Workflow track background, filter well, step inactive nodes |
| Accent (10%) | `#3B71F7` / `primary` | Active workflow step, primary CTAs, focus rings |
| Accent deep | `#2563EB` | Hover primary; active filter chip |
| Soft accent | `#EFF6FF` / `bg-[#EFF6FF]` | Current status highlight well (existing status page pattern) |
| Warning elevated | `#F59E0B` (amber-500) | **Elevated triage badge** border/text for `manual_review` / `failed` — not destructive flood |
| Destructive | `#DC2626` | Reject actions, verify/network errors only — **not** triage failure |
| Ink | `#1A1D26` | Body, headings |
| Muted text | `#5B6478` | Helpers, timestamps, inactive steps |
| Quiet line | `#E2E8F2` | Card borders, step connector lines |

**Triage badge semantics (officer — text + color, never color alone):**

| `triage_status` | Badge label (EN) | Variant | Visual |
|-----------------|------------------|---------|--------|
| `pending`, `processing` | AI review pending | `outline` | Muted border + `Loader2` optional 14px icon |
| `manual_review`, `failed` | Needs officer review | custom | Amber border `border-amber-500/50`, text `text-amber-900`, bg `bg-amber-50` |
| `completed` | AI review complete | `secondary` | Neutral secondary — no alarm |

**Citizen workflow step states:**

| State | Node fill | Connector |
|-------|-----------|-----------|
| Complete | `primary` fill + white check icon | `primary` line |
| Current | `primary` ring, white center, bold label | `muted` ahead |
| Upcoming | `muted` fill, muted label | `muted` line |

Accent reserved for (only):
1. Primary CTAs: **Submit report**, **Check status**, **Back to home**
2. Active workflow step indicator
3. Active `triage_status` filter chip
4. Focus-visible rings
5. Copy-button success check (existing emerald OK on icon only)

**Forbidden on citizen surfaces:** provider error strings, retry counts, stack traces, `triage_error`, red destructive styling for AI unavailability (use calm informational Alert).

---

## Visual hierarchy & focal points

| Surface | First focal | Second | Must not compete |
|---------|-------------|--------|------------------|
| Report form submit | Description + Submit CTA | Location optional block | Removed "analyzing" AI wait copy |
| Success page | Access token + Report ID copy blocks | Token warning Alert | Category, severity, AI summary |
| Status lookup result | 4-step workflow progress | Reference ID + received timestamp | AI summary while pending |
| Status calm failure | Informational notice (amber-neutral) | Workflow step 3 active | Technical error detail |
| Officer table | Elevated triage badge column | Officer `status` badge | Hidden pending reports |
| Officer detail (pending) | Citizen description + evidence image | Triage badge "AI review pending" | Fabricated category/severity |

---

## Component inventory (executor checklist)

| Component | Surface | Spec |
|-----------|---------|------|
| `ReportForm` (extend) | Public | Retarget `POST /api/public/reports`; submitting state copy; no AI fields in response handling |
| `ReportSuccessPage` (verify) | Public | Flash `{ reportId, accessToken }` only — no AI keys in flash schema |
| `CitizenWorkflowStepper` | Public status | 4-step horizontal (vertical stack on `<sm`); driven by `service_step` from API |
| `CitizenStatusResult` | Public status | Composes stepper + reference meta + conditional AI block + calm notice + officer history |
| `TriageStatusBadge` | Officer table + detail | Maps `triage_status` → badge variant + label |
| `TriageFilterChips` | Officer dashboard | Optional chip row: All / AI pending / Needs review / AI complete |
| `ReportsTable` (extend) | Officer | Add `triage_status` badge column; NULL category/priority/summary cells show em dash `—` |
| `ReportsFilters` (extend) | Officer | Add `triage_status` to `FILTER_PARAM_KEYS` + chip row above table |
| `ReportDetailPage` (reorder) | Officer | Section order per D-20; gate AI blocks on `triage_status` |
| Extend `DashboardSearchParams` | Officer | `triage_status?: string` |
| Extend `ReportRow` | Officer | `triage_status: string` |
| Message catalogs | i18n | `public.statusWorkflow.*`, `public.triage.*`, `dashboard.triage.*` |

---

## Screen contracts

### S1 — Public report form (`ReportForm`)

| Property | Contract |
|----------|----------|
| Route | `/[locale]/report` |
| Submit endpoint | `POST /api/public/reports` (multipart `FormData`) |
| Response handling | Read `{ report_id, access_token, intake_status, triage_status }` only; flash to `sessionStorage` key `citymind:report-success` |
| Submit loading copy | **"Submitting your report…"** / **"Đang gửi báo cáo…"** — replace `analyzing` key (`public.submitting`) |
| Submit idle CTA | **"Submit report"** (unchanged) |
| Error copy | Generic network/intake failure only — never provider/AI errors |
| Success navigation | `router.push("/report/success")` — unchanged |
| AI fields on response | **Ignore** — do not display category, severity, summary from intake |

### S2 — Success page (`/[locale]/report/success`)

| Property | Contract |
|----------|----------|
| Flash payload | `{ reportId, accessToken }` **only** (D-08) |
| Display blocks | Report ID (copy), Access token (copy), Status deep-link (copy) — existing layout |
| Forbidden | Category, severity, priority, AI summary, triage status chip |
| Token warning | Keep existing amber Alert (`tokenWarning`) |
| Primary CTA | **"Back to home"** — unchanged |
| Redirect guard | Missing flash → `/report` (unchanged) |

### S3 — Citizen status (`/[locale]/status`)

| Property | Contract |
|----------|----------|
| Lookup | `POST /api/public/reports/status` — extended response (see Data projection) |
| Deep link | Auto-fetch on `?reportId=&token=` (unchanged) |
| Result layout order | 1) Reference meta → 2) `CitizenWorkflowStepper` → 3) Calm notice (conditional) → 4) AI advisory block (conditional) → 5) Officer status history |
| Reference meta (always when verified) | Report ID (mono), **Received** timestamp (`dateStyle: medium`, `timeStyle: short`) |
| Workflow steps (D-13) | See **Citizen 4-step workflow** below |
| AI field gate (D-14, D-16) | Hide category, severity, priority, summary, recommendation while `triage_status` ∈ `{ pending, processing }` or `{ manual_review, failed }` |
| Calm notice (D-15) | Show when `triage_status` ∈ `{ manual_review, failed }` — informational Alert, not destructive |
| Officer history | Unchanged timeline; labels use existing `statusValue*` keys for officer disposition |
| Errors | Uniform 401 verify, 429 rate limit, network — never triage/provider detail |

#### Citizen 4-step workflow (D-13)

Render as `CitizenWorkflowStepper` — 4 labeled steps with completed/current/upcoming visual states.

| Step | EN label | VI label | Active when |
|------|----------|----------|-------------|
| 1 | Report received | Đã nhận báo cáo | Always complete after successful lookup |
| 2 | AI review pending | Đang chờ AI xem xét | `triage_status` ∈ `{ pending, processing }` |
| 3 | Under officer review | Cán bộ đang xem xét | `triage_status` ∈ `{ manual_review, failed, completed }` AND officer status ∈ `{ new, reviewing }` |
| 4a | Resolved | Đã giải quyết | `triage_status = completed` AND officer status = `resolved` |
| 4b | Rejected | Đã từ chối | `triage_status = completed` AND officer status = `rejected` |

**Step resolution rules:**
- While step 2 active: steps 1 complete, 2 current, 3–4 upcoming.
- When `manual_review` or `failed`: skip showing step 2 as current — step 1 complete, step 3 current (AI unavailable path), show calm notice above history.
- When `completed` + `new`/`reviewing`: steps 1–2 complete, step 3 current.
- Terminal: steps 1–3 complete, step 4 current (resolved or rejected label).
- Step 4 label dynamically switches between Resolved / Rejected based on officer status.

**API `service_step` enum (server-projected):** `received` | `ai_review_pending` | `officer_review` | `resolved` | `rejected` | `automated_review_unavailable` — UI maps to stepper states; `automated_review_unavailable` forces step 3 current + calm notice.

#### AI reveal block (citizen — `triage_status = completed` only)

| Field | Label (EN) | Notes |
|-------|------------|-------|
| Category | Category | Capitalize |
| Severity | Severity | `{n}/5` |
| Priority | Priority | Capitalize |
| Summary | Summary | Existing `statusSummaryLabel` |
| Recommendation | Recommended next steps | New key `statusRecommendationLabel` — advisory framing |

Use soft accent well `#EFF6FF` for AI block — same as current status highlight pattern.

### S4 — Officer reports table (`/dashboard`)

| Property | Contract |
|----------|----------|
| Default sort (D-18) | **Triage bucket sort** overrides user sort when `sort` absent or `sort=triage_bucket` (new default). Buckets: (1) `manual_review`+`failed` ASC by `created_at`, (2) `pending`+`processing` ASC, (3) `completed` ASC. Implement server-side in list query. |
| User sort | When officer explicitly chooses column sort (`created_at`, `priority`, etc.), respect choice — triage bucket is **default only** |
| New column | **AI triage** — `TriageStatusBadge` as second column after Report ID (or after Created — planner picks; badge must be visible without horizontal scroll on laptop) |
| NULL AI cells | `category`, `priority`, `summary` show **—** when `triage_status` ≠ `completed` — never placeholder text like "Pending" in data cells (badge carries triage state) |
| Row click | Navigate to detail — unchanged |
| Empty states | Unchanged Phase 3 empty/filtered copy |

#### Triage filter chip (D-19)

| Chip | `triage_status` param | EN | VI |
|------|----------------------|----|----|
| All (default) | absent | All | Tất cả |
| AI pending | `pending,processing` | AI pending | AI đang xử lý |
| Needs review | `manual_review,failed` | Needs review | Cần xem xét |
| AI complete | `completed` | AI complete | AI đã xong |

- Render as `TriageFilterChips` row between `ReportsFilters` and `ReportsMetrics` (or inside filter collapsible header row on mobile).
- **No tab model** — all statuses visible by default; chips narrow view only.
- Chip toggle updates URL `triage_status`; clears `cursor`.
- `Clear filters` clears `triage_status` among other filters.

### S5 — Officer report detail (`/dashboard/reports/[reportId]`)

#### Section order (D-20) — strict

| # | Section | Visible when | Content |
|---|---------|--------------|---------|
| 1 | Header meta | Always | Back link; report ID; submitted timestamp; **officer** status badge; `CopyStatusLink` |
| 1b | Detail title | Always | If `completed`: category as Heading 28px. Else: **"Report pending review"** Heading 20px — no fabricated category |
| 2 | Citizen report | `description` present | Citizen description text |
| 3 | Citizen evidence image | `evidence_path` present | Image via officer image route — **moved up** before AI sections |
| 4 | AI triage status | Always | `TriageStatusBadge` large + short helper: "AI output is advisory — you decide." |
| 5 | Observed facts | `triage_status=completed` AND `evidence[]` | Bullet list from AI `evidence` field (label: **Observed facts**) |
| 6 | Unknowns | `triage_status=completed` AND `uncertainty[]` | Bullet list (label: **Unknowns / gaps**) |
| 7 | AI narrative | `completed` only | Summary + recommendation paragraphs |
| 8 | Severity & priority | `completed` only | Metrics grid: priority, severity `/5`, impact; confidence row uses **uncalibrated label** — no `%` |
| 9 | Location | coords present | Unchanged lat/lng block |
| 10 | Urban context | optional | After metrics; unchanged JSON block |
| 11 | Status timeline | Always | Officer history |
| 12 | Officer decision controls | Always | `StatusActions` — unchanged |

**NULL rule (D-20):** When AI fields NULL, **omit section body** or show section header + `detailNoneRecorded` — never synthesize defaults like "medium" priority or severity 3.

**Remove/reorder from current page:** Do not show summary/recommendation/metrics grid before citizen content; remove confidence percentage (`Math.round(confidence * 100)%`).

---

## Interaction contract

### Citizen status data projection

API must return (citizen-safe subset):

```typescript
type CitizenStatusResponse = {
  report_id: string;
  received_at: string;
  triage_status: "pending" | "processing" | "completed" | "manual_review" | "failed";
  service_step: "received" | "ai_review_pending" | "officer_review" | "resolved" | "rejected" | "automated_review_unavailable";
  status: string; // officer disposition — for history + step 4
  // AI fields — null unless triage_status === "completed"
  category: string | null;
  severity: number | null;
  priority: string | null;
  summary: string | null;
  recommendation: string | null;
  history: { status: string; note: string | null; created_at: string }[];
};
```

**Never include:** `triage_error`, provider message, attempt count, model name.

### Dashboard URL parameters (extends Phase 3/6)

| Key | Values | Default | Notes |
|-----|--------|---------|-------|
| `triage_status` | comma-separated enum subset | absent | Chip filter; e.g. `pending,processing` |
| `sort` | add `triage_bucket` | `triage_bucket` | New default for Phase 8; explicit `created_at` etc. still supported |

Add `triage_status` to `FILTER_PARAM_KEYS` and `hasActiveFilters()`.

### Report form submit flow

1. User submits → button disabled, `submitting` copy.
2. Intake returns immediately (<2s target).
3. Flash token + ID → success page.
4. AI runs in worker — citizen checks status later.

### Status page refresh

No auto-polling in MVP — citizen taps **Check status** to refresh. Optional: show `received_at` / last-checked time as static text only.

---

## Interaction states

### Report form

| State | Visual |
|-------|--------|
| Idle | Submit enabled |
| Submitting | Button disabled + `public.submitting` |
| Intake error | Destructive Alert — generic copy |
| Client validation | Existing form messages |

### Citizen status result

| State | Visual |
|-------|--------|
| Empty | Unchanged empty heading/body |
| Loading | Skeleton card |
| Verified + pending AI | Stepper step 2 current; no AI block |
| Verified + manual_review/failed | Calm notice Alert + step 3 current; no AI block |
| Verified + completed | Stepper appropriate step; AI block in soft accent well |
| Verify failed | Destructive Alert — unchanged |

### Officer table row

| `triage_status` | Category cell | Priority cell | Summary cell | Badge |
|-----------------|---------------|---------------|--------------|-------|
| pending/processing | — | — | — | AI review pending |
| manual_review/failed | — | — | — | Needs officer review (elevated) |
| completed | value | value | truncated | AI review complete |

---

## Copywriting Contract

EN defaults; VI natural equivalents in `messages/{en,vi}.json`.

### Public — report form

| Element | EN | VI |
|---------|----|----|
| Primary CTA | Submit report | Gửi báo cáo |
| Submitting | Submitting your report… | Đang gửi báo cáo… |
| Error state | Could not send your report. Check your connection and try again. | Không gửi được báo cáo. Kiểm tra kết nối rồi thử lại. |

### Public — success (D-08 — token only)

| Element | EN | VI |
|---------|----|----|
| Heading | Report received | Đã nhận báo cáo |
| Body | Save your report ID and access token. You'll need them to check status later. | Hãy lưu mã báo cáo và token truy cập. Bạn sẽ cần chúng để kiểm tra trạng thái sau này. |
| Primary CTA | Back to home | Về trang chủ |

No new success copy for AI — AI fields must not appear.

### Public — status workflow (`public.statusWorkflow`)

| Element | EN | VI |
|---------|----|----|
| Workflow heading | Your report progress | Tiến trình báo cáo |
| Step 1 | Report received | Đã nhận báo cáo |
| Step 2 | AI review pending | Đang chờ AI xem xét |
| Step 3 | Under officer review | Cán bộ đang xem xét |
| Step 4 resolved | Resolved | Đã giải quyết |
| Step 4 rejected | Rejected | Đã từ chối |
| Reference label | Reference ID | Mã tham chiếu |
| Received label | Received | Thời gian tiếp nhận |
| Primary CTA | Check status | Kiểm tra trạng thái |
| Empty heading | Enter your details to check status | Nhập thông tin để kiểm tra trạng thái |
| Empty body | Use the report ID and access token from your submission confirmation. | Dùng mã báo cáo và mã truy cập từ trang xác nhận gửi báo cáo. |
| Error verify | We couldn't verify that report and token. Check both and try again. | Không xác minh được báo cáo và mã truy cập. Kiểm tra lại rồi thử lại. |
| Error network | Could not check status. Check your connection and try again. | Không kiểm tra được trạng thái. Kiểm tra kết nối rồi thử lại. |

### Public — calm failure (D-15) (`public.triage`)

| Element | EN | VI |
|---------|----|----|
| Calm notice title | Automated review unavailable | Không thể tự động xem xét |
| Calm notice body | Automated review is unavailable. Your report is saved and will be reviewed by an officer. | Không thể tự động xem xét. Báo cáo của bạn đã được lưu và sẽ được cán bộ xem xét. |
| Recommendation label | Recommended next steps | Gợi ý bước tiếp theo |
| Priority label | Priority | Mức ưu tiên |
| Category label | Category | Danh mục |
| Severity label | Severity | Mức độ |

**Destructive actions:** none on citizen status — calm notice uses `Alert` default/amber variant, **not** `variant="destructive"`.

### Officer — triage (`dashboard.triage`)

| Element | EN | VI |
|---------|----|----|
| Column header | AI triage | AI xem xét |
| Badge pending | AI review pending | AI đang xử lý |
| Badge elevated | Needs officer review | Cần cán bộ xem xét |
| Badge complete | AI review complete | AI đã xong |
| Filter: all | All | Tất cả |
| Filter: pending | AI pending | AI đang xử lý |
| Filter: needs review | Needs review | Cần xem xét |
| Filter: complete | AI complete | AI đã xong |
| Detail pending title | Report pending review | Báo cáo chờ xem xét |
| Observed facts | Observed facts | Sự kiện quan sát được |
| Unknowns | Unknowns / gaps | Chưa rõ / thiếu thông tin |
| Confidence label | Model confidence — uncalibrated | Độ tin cậy mô hình — chưa hiệu chỉnh |
| Detail helper | AI output is advisory — you decide. | Kết quả AI chỉ mang tính tham khảo — bạn quyết định. |
| Empty AI section | Not available until AI review completes. | Chưa có cho đến khi AI xem xét xong. |

**Destructive confirmation:** unchanged — Resolve/Reject dialogs from Phase 3.

---

## Accessibility

| Requirement | Contract |
|-------------|----------|
| Standard | WCAG 2.2 AA |
| Workflow stepper | `aria-current="step"` on active step; completed steps `aria-label="{label}, completed"` |
| Calm notice | `role="status"` — informational, not `role="alert"` (not an error) |
| Triage badges | Text label always present; elevated badge includes "Needs officer review" text |
| Filter chips | `aria-pressed` on active chip; keyboard toggle |
| Touch | ≥44px chip/button targets |
| Color | Triage state never color-only — badge text + icon |
| Live regions | Status check loading uses existing `aria-live="polite"` |
| Locale | EN/VI for all new keys |
| NULL cells | Screen readers hear em dash as "not available" via `aria-label` on table cells when value null |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | reuse only | not required |
| Third-party shadcn | none | n/a |

---

## Anti-patterns (this phase)

| Anti-pattern | Why banned |
|--------------|------------|
| Showing AI category/severity on success flash | D-08 |
| `analyzing` / sync-wait copy on submit | Misrepresents async intake |
| Exposing `triage_error`, provider codes, retry count to citizens | D-15, security |
| Destructive red Alert for AI unavailability on citizen status | Calm copy contract |
| Fabricated NULL AI defaults ("medium", "3/5") on officer detail | D-20 |
| Confidence percentage on officer detail | D-23 |
| Separate triage status tabs hiding completed reports | D-19 |
| Sorting pending reports above `manual_review` | D-18 |
| Keeping `/analyze` in ReportForm | D-07 |
| Auto-polling status page every N seconds | Out of scope; manual refresh |
| Category as detail H1 when triage incomplete | Misleading officer queue |

---

## Inheritance & non-goals

**Inherits from Phase 3:** Product table, filters, URL sync, badge patterns, detail actions, Dialog confirm, 44px targets, flat borders.

**Inherits from Phase 2:** Public form layout, bilingual EN/VI, success token copy pattern, status anti-enumeration.

**Inherits from Phase 6:** Dashboard layout shell; map view unaffected — map pins may show `—` category until triage completes (NULL rule).

**Must not include:** Triage worker admin UI, `triage_runs` audit viewer, eval dashboard (Phase 10), routing policy UI (Phase 9), citizen auto-refresh polling, Cloud Tasks UX.

---

## Out of Scope

| Item | Reason |
|------|--------|
| Audit tables UI (`triage_runs`, `triage_attempts`) | Backend/ops; officers use badges only in MVP |
| Real-time status push / SSE | Manual refresh sufficient |
| Officer-triggered re-triage button | Optional replay handler out of MVP UI |
| Citizen-facing triage timeline (per-attempt) | Privacy + calm copy contract |
| New analytics dimensions | Phase 5 scope |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

**Researcher notes:** Auto chain mode — all UX decisions pre-populated from `08-CONTEXT.md` D-13–D-20 and D-08; no user prompts. Citizen workflow maps `manual_review`/`failed` to step 3 with calm notice (not step 2 failure). Default officer sort is triage-bucket server-side with `triage_bucket` as default `sort` param. Detail page strictly reorders per D-20; urban context retained after metrics as non-blocking. Replace `public.analyzing` with `public.submitting` in implementation.
