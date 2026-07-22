---
phase: 9
slug: self-help-vs-government-routing
status: draft
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables; primary CityMind Blue #3B71F7 (inherits Phase 8 / Phase 3 Clinic Blue contract)
created: 2026-07-22
inherits:
  - .planning/phases/08-async-triage-platform-refactor/08-UI-SPEC.md
  - .planning/phases/03-dashboard-polish/03-UI-SPEC.md
  - .planning/phases/02-public-experience/02-UI-SPEC.md
sources:
  - .planning/phases/09-self-help-vs-government-routing/09-CONTEXT.md (D-01–D-24)
  - .planning/phases/09-self-help-vs-government-routing/09-RESEARCH.md
  - PRODUCT.md — civic clarity, anti-AI-theater
  - src/app/[locale]/status/page.tsx
  - src/components/reports/ReportsTable.tsx
  - src/components/reports/ReportsFilters.tsx
  - src/components/reports/TriageStatusBadge.tsx
  - src/server/services/citizen-status.ts
  - messages/en.json, messages/vi.json
  - components.json (radix-nova, neutral, lucide)
---

# Phase 9 — UI Design Contract

> Visual and interaction contract for **Self-help vs Government Routing** — citizen playbook panel on token status, adapted self-help workflow steps, escalate CTA, officer destination badges, government-default queue filter, and self-help override actions.
>
> **Scope:** Post-triage routing UX on existing surfaces only. Static bilingual playbooks (no AI-generated guidance). Hide all AI triage fields on self-help citizen path. Officer default queue = government + unrouted; optional chip widens to self-help. Destination badge column. Override actions on self-help reports.
>
> Out of scope: routing policy module internals, worker hook, eval suite (Phase 10), CMS for playbooks, email/SMS, real-time push, new routes beyond existing status page and dashboard.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `components.json`) |
| Preset | `style: radix-nova`, `baseColor: neutral`, CSS variables; `--primary` = CityMind Blue `#3B71F7` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react (`BookOpen`, `ExternalLink`, `ArrowUpRight`, `Check`, `Loader2`, `Building2`, `HandHelping` — reuse existing set where possible) |
| Font | Google Sans Text (400) / Google Sans (600 headings) — unchanged from Phase 8 |
| Register | **public civic** for citizen status/playbook; **product** for officer dashboard |

**Stack locks (Phase 9 — no new UI dependencies):**

| Concern | Contract |
|---------|----------|
| Citizen status API | Extend `CitizenStatusResponse` with routing-safe fields only — never `routing_reason`, `routing_policy_version`, or confidence |
| Citizen escalate API | `POST /api/public/reports/escalate` — same token auth as status; uniform 401 |
| Officer list filter | Server default `(routing_destination IS NULL OR routing_destination = 'government')`; client chip toggles widen |
| URL sync | Extend `DashboardSearchParams` + `FILTER_PARAM_KEYS` with `routing_destination` — do **not** add `nuqs` |
| i18n | All new copy under `public.routing.*` and `dashboard.routing.*` in `messages/en.json` + `messages/vi.json` |
| Playbook content | Category IDs in `src/server/routing/playbooks.ts`; citizen-facing strings in message catalogs (D-07) |

**Reuse existing:** `alert`, `alert-dialog`, `badge`, `button`, `card`, `collapsible`, `input`, `label`, `separator`, `skeleton`, `table`, `dialog` (officer confirm).

**Phase 9 add (shadcn official only):** none required.

**Registry:** shadcn official only — `registries: {}`. No third-party blocks.

---

## Spacing Scale

Inherits Phase 8 unchanged — multiples of 4:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Badge icon gaps; playbook bullet marker gap |
| sm | 8px | Chip row gaps; playbook bullet stack gap |
| md | 16px | Playbook panel padding; escalate CTA top margin |
| lg | 24px | Section padding; workflow stepper gap |
| xl | 32px | Playbook title → steps gap |
| 2xl | 48px | Status result card section breaks |
| 3xl | 64px | Public status page vertical rhythm only |

Exceptions:
- **44px** min touch height: Escalate CTA, routing filter chips, override action buttons, Confirm escalate
- **Workflow stepper node:** 32×32 visual circle, **44×44** hit area on mobile (unchanged Phase 8)
- **Playbook panel:** `p-4` (16px) inner; `space-y-3` between bullets; external links `min-h-11` tap row

---

## Typography

Inherits Phase 8 public + product registers — two weights only (400, 600).

### Public citizen surfaces (status — self-help additions)

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px (0.875rem) | 400 | 1.4 | Playbook step labels, external link captions, escalate helper |
| Body | 16px (1rem) | 400 | 1.5 | Playbook bullets, escalate confirm body |
| Heading | 20px (1.25rem) | 600 | 1.2 | Playbook panel title (`public.routing.playbookPanelTitle`), workflow section title |
| Display | 28px (1.75rem) | 600 | 1.2 | Not used on status page (unchanged) |

### Officer dashboard (routing additions)

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px | 400 | 1.4 | Destination badge text, routing filter chip labels |
| Body | 16px | 400 | 1.5 | Override helper copy on detail |
| Heading | 20px | 600 | 1.2 | Routing override section title on detail |

**Rules:**
- Playbook bullets use Body 16px — never smaller than 16px on citizen path (mobile readability).
- External links: Body 16px + `ExternalLink` icon 16px; underline on hover only.
- Do not use monospace in playbook content.

---

## Color

60 / 30 / 10 restrained civic (light-only) — inherits Phase 8 tokens:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` / `bg-card` | Status result card, playbook panel surface |
| Secondary (30%) | `#F0F3F9` / `bg-muted` | Playbook panel background (`bg-muted/40` border `border-border`) — **not** AI accent blue |
| Accent (10%) | `#3B71F7` / `primary` | Active routing filter chip, escalate confirm primary, workflow current step |
| Accent deep | `#2563EB` | Hover on escalate confirm |
| Soft civic | `#F0FDF4` / `border-emerald-200` | Optional playbook panel left border accent (`border-l-4 border-l-emerald-500/40`) — calm guidance, not success/alarm |
| Destructive | `#DC2626` | Escalate/network errors only — **not** self-help badge |
| Ink | `#1A1D26` | Playbook body, headings |
| Muted text | `#5B6478` | Playbook intro, escalate helper |
| Quiet line | `#E2E8F2` | Playbook card border |

**Destination badge semantics (officer — text + color, never color alone):**

| `routing_destination` | Badge label (EN) | Variant | Visual |
|-----------------------|------------------|---------|--------|
| `self_help` | Self-help | `secondary` | Neutral secondary + optional `HandHelping` 14px icon |
| `government` | Government | `outline` | Muted border + optional `Building2` 14px icon |
| `null` (unrouted) | — | n/a | Em dash `—` in table cell; no badge |

**Citizen playbook panel:** Use **muted civic card** (`rounded-lg border border-border bg-muted/40 p-4`) — deliberately **not** `#EFF6FF` AI accent well (D-08 anti-AI-theater).

**Accent reserved for (only):**
1. Active **Include self-help** routing filter chip (when toggled on)
2. Escalate confirmation primary action (**Send to city**)
3. Active workflow step indicator (current step ring)
4. Focus-visible rings
5. External link icon on hover (may use `text-primary` on icon only)

**Forbidden on self-help citizen path:** AI accent well, category/severity/priority/summary/recommendation, routing reason codes, policy version, confidence, "AI" in playbook copy.

---

## Visual hierarchy & focal points

| Surface | First focal | Second | Must not compete |
|---------|-------------|--------|------------------|
| Status — self-help | Playbook panel (actionable steps) | 3-step workflow stepper | Escalate CTA (tertiary until read) |
| Status — self-help escalate | Confirm dialog title + body | Primary confirm | Playbook still visible behind dialog |
| Status — government (unchanged) | Phase 8 workflow + AI reveal when completed | Reference meta | — |
| Status — post-escalation | Phase 8 government workflow (officer review step) | Calm transition notice (optional one-line) | Old playbook panel |
| Officer table | Elevated triage badge (unchanged D-16) | **Destination** badge column | Self-help rows hidden by default |
| Officer detail — self-help | Citizen description + playbook context note | Routing override actions | AI narrative (hidden until government + completed) |

---

## Component inventory (executor checklist)

| Component | Surface | Spec |
|-----------|---------|------|
| `CitizenWorkflowStepper` (extend) | Public status | Accept `workflowVariant: "government" \| "self_help"` + `serviceStep`; render 4-step or 3-step step arrays |
| `SelfHelpPlaybookPanel` | Public status | New — title, intro, ordered bullets, external links; driven by `playbook` payload |
| `EscalateToGovernmentCta` | Public status | Outline button + `AlertDialog` confirm; calls escalate API; refreshes status on success |
| `status/page.tsx` (extend) | Public status | Branch layout: self-help vs government; gate AI block; wire escalate |
| `RoutingDestinationBadge` | Officer table + detail | Mirror `TriageStatusBadge` pattern |
| `RoutingFilterChips` | Officer dashboard | Row below triage chips: default government queue + **Include self-help** toggle |
| `ReportsTable` (extend) | Officer | Add `routing_destination` column with badge after triage column |
| `ReportsFilters` (extend) | Officer | Host `RoutingFilterChips`; add `routing_destination` to filter keys |
| `ReportDetailPage` (extend) | Officer | Header destination badge; `RoutingOverrideActions` when `routing_destination === "self_help"` |
| `RoutingOverrideActions` | Officer detail | **Send to government queue** + reuse `StatusActions` resolve where applicable |
| Extend `DashboardSearchParams` / `ReportRow` | Officer | `routing_destination?: string \| null` |
| Extend `projectCitizenTriageView` | API | Self-help branch: playbook payload, `can_escalate`, adapted `service_step` |
| Message catalogs | i18n | `public.routing.*`, `dashboard.routing.*` |

---

## Screen contracts

### S1 — Citizen status (`/[locale]/status`) — routing extensions

| Property | Contract |
|----------|----------|
| Route | Unchanged — `/[locale]/status` (D-09) |
| Lookup | `POST /api/public/reports/status` — extended response (see Data projection) |
| Layout order (self-help path) | 1) Reference meta → 2) Workflow stepper (3-step) → 3) **SelfHelpPlaybookPanel** → 4) **EscalateToGovernmentCta** (if `can_escalate`) → 5) Officer status history |
| Layout order (government path) | Unchanged Phase 8 order |
| AI block gate | Show AI advisory block **only** when `routing_destination === "government"` AND `triage_status === "completed"` |
| Self-help gate | Show playbook when `routing_destination === "self_help"` AND triage terminal (`triage_status === "completed"`) |
| Pending triage | Before routing completes: Phase 8 behavior (4-step government workflow, step 2 AI pending) — D-03 |
| Post-escalation | `routing_destination` flips to `government`; hide playbook; show Phase 8 government workflow; optional one-line `public.routing.escalatedNotice` in muted text above stepper |
| Errors | Escalate: uniform 401, 429, network — never routing reason codes |

#### Self-help 3-step workflow (D-10)

Render when `workflow_variant === "self_help"` (server-projected).

| Step | EN label (`public.routing`) | VI label | Active when |
|------|----------------------------|----------|-------------|
| 1 | Report received | Đã nhận báo cáo | Always complete after lookup |
| 2 | Guidance available | Hướng dẫn đã sẵn sàng | `service_step === "self_help_guidance"` |
| 3a | Resolved | Đã giải quyết | `status === "resolved"` |
| 3b | Rejected | Đã từ chối | `status === "rejected"` |

**Step resolution:**
- Default after routing to self-help: step 1 complete, step 2 current, step 3 upcoming.
- Terminal officer disposition: steps 1–2 complete, step 3 current (resolved/rejected label).
- **No** step for AI review or officer review on self-help path.

**API `service_step` extension:** add `self_help_guidance` — maps to step 2 current.

#### Government 4-step workflow (unchanged Phase 8)

Use existing `public.statusWorkflow.*` keys when `workflow_variant === "government"` OR after citizen escalation.

#### SelfHelpPlaybookPanel

| Property | Contract |
|----------|----------|
| Visibility | `routing_destination === "self_help"` && playbook payload present |
| Structure | `Card` or bordered `div`: icon `BookOpen` 16px + Heading title → optional intro (Body muted) → `<ol>` of 3–5 bullets → optional links list |
| Bullets | Localized strings from `public.routing.playbooks.{id}.steps[]` (D-06) |
| External links | Max 2 per playbook; `target="_blank"` `rel="noopener noreferrer"`; `ExternalLink` icon; full URL shown in `aria-label` |
| Empty fallback | If playbook id missing: show `public.routing.playbookFallbackBody` — no category name, no AI mention |
| Motion | None beyond Phase 8 stepper — respect `prefers-reduced-motion` |

**Playbook catalog (initial IDs — EN/VI in messages):**

| Category | Playbook ID | EN title key |
|----------|-------------|--------------|
| `pothole` | `pothole` | Small road surface damage |
| `waste` | `waste` | Missed trash or dumping |
| `streetlight` | `streetlight` | Streetlight out |
| `graffiti` | `graffiti` | Graffiti or vandalism |

Each playbook: **4 bullets** + **1 optional external link** (city FAQ or 311 info page placeholder URL in messages).

#### EscalateToGovernmentCta (D-11, D-12)

| Property | Contract |
|----------|----------|
| Visibility | `can_escalate === true` (self-help, not resolved/rejected, not already government) |
| Trigger | `Button variant="outline"` `className="min-h-11 w-full sm:w-auto"` |
| Label | **Still need city help?** / **Vẫn cần sự hỗ trợ của thành phố?** |
| Helper | Muted Label 14px below: explains officer will review — `public.routing.escalateHelper` |
| Confirm | `AlertDialog`: title + body + Cancel (**Keep self-help guidance**) + Confirm (**Send to city**) |
| Success | Close dialog; re-fetch status; same token (D-12); show brief `escalatedNotice` |
| Loading | Button disabled + `Loader2` on confirm |
| Rate limit | 429 → same pattern as status lookup |

**Destructive actions:** Escalate is **not** destructive styling — outline + confirm dialog, not red.

### S2 — Officer reports table (`/dashboard`)

| Property | Contract |
|----------|----------|
| Default list filter (D-13) | Server applies `(routing_destination IS NULL OR routing_destination = 'government')` when `routing_destination` param absent |
| Default sort (D-16) | Unchanged Phase 8 `triage_bucket` within filtered set |
| New column | **Destination** — `RoutingDestinationBadge`; insert after **AI triage** column |
| NULL routing cell | Em dash `—` with `aria-label="not available"` |
| Row visibility | Self-help rows **hidden** unless Include self-help chip active |
| Row click | Unchanged → detail |

#### Routing filter chips (D-13)

Render `RoutingFilterChips` as second chip row **below** triage chips, same `min-h-11` button pattern.

| Chip | `routing_destination` param | EN | VI | Default |
|------|----------------------------|----|----|---------|
| Government queue | absent | Government queue | Hàng đợi chính quyền | **active** (implicit filter) |
| Include self-help | `all` | Include self-help | Gồm báo cáo tự xử lý | inactive |

**Behavior:**
- **Government queue** (default): param absent; server excludes `self_help`.
- **Include self-help**: sets `routing_destination=all`; server returns all destinations; triage sort preserved.
- Toggling off Include self-help removes param (back to default).
- `Clear filters` removes `routing_destination` among other keys.
- `hasActiveFilters()` returns true when `routing_destination=all` (widened view is an active filter state).

**Do not** add a self-help-only chip in MVP — officers reach self-help via Include self-help + optional triage/status filters, or detail deep link.

### S3 — Officer report detail (`/dashboard/reports/[reportId]`)

| Property | Contract |
|----------|----------|
| Header | Add `RoutingDestinationBadge` beside `TriageStatusBadge` when `routing_destination` non-null |
| Self-help reports | Show muted info `Alert` (`role="status"`): **This report was routed to self-help guidance. Citizens see playbook steps, not AI analysis.** |
| AI sections | Unchanged Phase 8 gating — on self-help, citizen-facing AI hidden; officer detail may still show triage when `completed` for audit |
| Override block (D-14) | When `routing_destination === "self_help"` AND status ∉ `{resolved, rejected}`: render `RoutingOverrideActions` above `StatusActions` |

#### RoutingOverrideActions

| Action | Label (EN) | Variant | Behavior |
|--------|------------|---------|----------|
| Send to government queue | Send to government queue | `outline` | `POST /api/officer/reports/{id}/routing` body `{ action: "escalate_to_government" }`; optional note field **not** required MVP |
| Mark as resolved | Mark as resolved | `default` | Reuse existing resolve flow / dialog with required note |

**Send to government** confirm: `AlertDialog` — **Move to government queue?** / body explains citizen will see officer review workflow.

**After override escalate:** Badge updates to Government; override block hides; standard `StatusActions` remain.

---

## Interaction contract

### Citizen status data projection (extended)

```typescript
type PlaybookLink = { label: string; href: string };

type PlaybookPayload = {
  id: string;
  title: string;
  intro: string | null;
  steps: string[];
  links: PlaybookLink[];
};

type CitizenStatusResponse = {
  report_id: string;
  received_at: string;
  triage_status: string;
  routing_destination: "self_help" | "government" | null;
  workflow_variant: "self_help" | "government";
  service_step:
    | "received"
    | "ai_review_pending"
    | "self_help_guidance"
    | "officer_review"
    | "resolved"
    | "rejected"
    | "automated_review_unavailable";
  status: string;
  can_escalate: boolean;
  playbook: PlaybookPayload | null;
  // AI fields — null when routing_destination === "self_help" OR triage not completed
  category: string | null;
  severity: number | null;
  priority: string | null;
  summary: string | null;
  recommendation: string | null;
  history: { status: string; note: string | null; created_at: string }[];
};
```

**Never include in citizen API:** `routing_reason`, `routing_policy_version`, `confidence`, internal category used only for routing.

### Citizen escalate request

```typescript
// POST /api/public/reports/escalate
{ report_id: string; token: string }
// 200 → re-fetch status; same token
```

### Dashboard URL parameters (extends Phase 8)

| Key | Values | Default | Notes |
|-----|--------|---------|-------|
| `routing_destination` | `all` | absent | `all` = include self-help; absent = government default |

Add `routing_destination` to `FILTER_PARAM_KEYS`.

### ReportRow extension

```typescript
routing_destination: string | null;
```

---

## Interaction states

### Citizen status — self-help

| State | Visual |
|-------|--------|
| Triage pending | Phase 8 — 4-step government, step 2 current; no playbook |
| Self-help active | 3-step stepper; playbook panel; escalate CTA visible |
| Self-help resolved/rejected | Step 3 terminal; playbook remains visible (read-only); escalate hidden |
| Escalating | Confirm dialog loading on primary |
| Escalated | Government workflow; playbook hidden; optional `escalatedNotice` |
| Escalate error | Destructive Alert below CTA — generic copy |

### Officer table row

| `routing_destination` | Visible in default view | Destination cell |
|-----------------------|-------------------------|------------------|
| `null` | Yes | — |
| `government` | Yes | Government badge |
| `self_help` | No (unless `routing_destination=all`) | Self-help badge |

### Officer detail — self-help override

| State | Visual |
|-------|--------|
| Active self-help | Info alert + override action row |
| Override loading | Buttons disabled |
| After escalate to government | Government badge; override block hidden |
| Resolved/rejected | Override hidden; standard terminal UI |

---

## Copywriting Contract

EN defaults; VI natural equivalents in `messages/{en,vi}.json`.

### Public — routing (`public.routing`)

| Key | EN | VI |
|-----|----|----|
| `playbookPanelTitle` | What you can do now | Việc bạn có thể làm ngay |
| `playbookFallbackBody` | Step-by-step guidance is being prepared. You can still ask the city for help below. | Hướng dẫn từng bước đang được chuẩn bị. Bạn vẫn có thể nhờ thành phố hỗ trợ bên dưới. |
| `workflowStepGuidance` | Guidance available | Hướng dẫn đã sẵn sàng |
| `escalateCta` | Still need city help? | Vẫn cần sự hỗ trợ của thành phố? |
| `escalateHelper` | An officer can review your report and follow up. | Cán bộ có thể xem xét báo cáo và liên hệ lại. |
| `escalateConfirmTitle` | Send to the city? | Gửi cho thành phố? |
| `escalateConfirmBody` | Your report will join the officer review queue. You can keep using the same report ID and access token. | Báo cáo sẽ vào hàng đợi cán bộ xem xét. Bạn vẫn dùng cùng mã báo cáo và mã truy cập. |
| `escalateConfirm` | Send to city | Gửi cho thành phố |
| `escalateCancel` | Keep self-help guidance | Giữ hướng dẫn tự xử lý |
| `escalateSuccess` | Your report was sent to the city for review. | Báo cáo đã được gửi để cán bộ xem xét. |
| `escalateError` | Could not send your report to the city. Check your connection and try again. | Không gửi được báo cáo cho thành phố. Kiểm tra kết nối rồi thử lại. |
| `escalatedNotice` | The city is now reviewing your report. | Thành phố đang xem xét báo cáo của bạn. |

#### Playbooks — `public.routing.playbooks.{id}`

Each playbook object:

| Key | EN example (pothole) | VI example |
|-----|---------------------|------------|
| `title` | Small road surface damage | Hư hỏng mặt đường nhỏ |
| `intro` | These steps are safe to try before requesting a crew. | Các bước sau an toàn để thử trước khi yêu cầu đội sửa chữa. |
| `steps[0]` | Note the exact location and size of the hole. | Ghi rõ vị trí và kích thước ổ gà. |
| `steps[1]` | Take a photo from a safe spot off the road. | Chụp ảnh từ vị trí an toàn, tránh lòng đường. |
| `steps[2]` | Check for exposed cables or sharp edges — if yes, stop and escalate below. | Kiểm tra dây điện hoặc cạnh sắc — nếu có, dừng lại và nhờ hỗ trợ bên dưới. |
| `steps[3]` | Mark the area with a cone or chalk if you can do so safely. | Đánh dấu khu vực bằng cọc hoặc phấn nếu an toàn. |
| `links[0].label` | Road maintenance FAQ | Câu hỏi thường gặp về đường |
| `links[0].href` | `https://example.gov/roads` | same |

Repeat structure for `waste`, `streetlight`, `graffiti` — 4 bullets each, 1 optional link, civic FAQ tone (no AI language).

**Primary CTA (citizen):** `escalateCta` — **Still need city help?**

**Empty state:** unchanged Phase 8 status empty (no routing-specific empty).

**Error state:** `escalateError` + existing status verify/network keys.

**Destructive actions:** none on citizen path.

### Officer — routing (`dashboard.routing`)

| Key | EN | VI |
|-----|----|----|
| `columnHeader` | Destination | Đích đến |
| `badgeSelfHelp` | Self-help | Tự xử lý |
| `badgeGovernment` | Government | Chính quyền |
| `filterGovernmentDefault` | Government queue | Hàng đợi chính quyền |
| `filterIncludeSelfHelp` | Include self-help | Gồm báo cáo tự xử lý |
| `detailRoutingLabel` | Routing | Định tuyến |
| `detailSelfHelpNotice` | This report was routed to self-help guidance. Citizens see playbook steps, not AI analysis. | Báo cáo được định tuyến tự xử lý. Người dân chỉ thấy hướng dẫn, không thấy phân tích AI. |
| `overrideSectionTitle` | Self-help actions | Thao tác tự xử lý |
| `overrideEscalate` | Send to government queue | Chuyển vào hàng đợi chính quyền |
| `overrideEscalateConfirmTitle` | Move to government queue? | Chuyển vào hàng đợi chính quyền? |
| `overrideEscalateConfirmBody` | The citizen will see officer review steps. This does not change the access token. | Người dân sẽ thấy bước cán bộ xem xét. Mã truy cập không đổi. |
| `overrideEscalateConfirm` | Confirm | Xác nhận |
| `overrideEscalateCancel` | Cancel | Hủy |
| `overrideEscalateSuccess` | Report moved to government queue. | Đã chuyển vào hàng đợi chính quyền. |
| `overrideEscalateError` | Could not update routing. Try again. | Không cập nhật được định tuyến. Thử lại. |

**Destructive confirmation:** Resolve/Reject unchanged from Phase 3 — required note dialog.

---

## Accessibility

| Requirement | Contract |
|-------------|----------|
| Standard | WCAG 2.2 AA (inherits Phase 8) |
| Playbook list | Semantic `<ol>`; each step readable by screen readers in order |
| External links | Visible text + `aria-label="{label} (opens in new tab)"` |
| Escalate dialog | Focus trap in `AlertDialog`; `aria-describedby` on confirm body |
| Destination badges | Text label always present; never icon-only |
| Routing filter chips | `aria-pressed` on active chip; keyboard toggle |
| Self-help workflow | `aria-current="step"` on active step; 3-step list announced correctly |
| Playbook panel | `aria-labelledby` pointing to panel title |
| Color | Destination state never color-only |
| Locale | EN/VI for all `public.routing` / `dashboard.routing` keys |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | reuse only (`alert-dialog` if not installed — add via official CLI) | not required |
| Third-party shadcn | none | n/a |

---

## Anti-patterns (this phase)

| Anti-pattern | Why banned |
|--------------|------------|
| Showing AI category/severity/summary on self-help citizen path | D-08, PRODUCT.md anti-AI-theater |
| Blue `#EFF6FF` accent well for playbook content | Implies AI output; use muted civic card |
| Exposing `routing_reason` / policy version to citizens | RESEARCH pitfall 4 |
| Hiding pending/unrouted reports from officer default queue | D-03 |
| New access token on escalate | D-12 |
| Self-help-only default officer view | D-13 requires government default |
| AI-generated playbook text at runtime | D-05 |
| Dedicated guidance route or post-submit redirect | D-09 |
| Destructive red styling for escalate CTA | Civic calm — confirm dialog sufficient |
| Client-side routing destination decisions | Policy runs server-side only |
| Sorting self-help above `manual_review`/`failed` | D-16 |

---

## Inheritance & non-goals

**Inherits from Phase 8:** Async triage badges, citizen 4-step government workflow, calm failure notice, triage filter chips, triage-bucket default sort, AI field gating on government path, officer detail section order.

**Inherits from Phase 3:** Table, URL sync, dialog confirm patterns, 44px targets.

**Inherits from Phase 2:** Bilingual EN/VI, status anti-enumeration, token-scoped APIs.

**Must not include:** Playbook CMS admin UI, routing policy editor, eval/shadow UI (Phase 10), push notifications, map routing layers, new npm UI packages.

---

## Out of Scope

| Item | Reason |
|------|--------|
| Officer-editable playbook CMS | Deferred per CONTEXT |
| Citizen self-mark resolved | MVP — officer resolve via D-14 override only |
| `graffiti` category schema expansion | Backend planner checkpoint; UI keys exist for forward compatibility |
| Real-time status push after routing | Manual refresh (Phase 8) |
| Routing analytics widgets | Phase 5 / future |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

**Researcher notes:** Auto chain mode — all UX decisions pre-populated from `09-CONTEXT.md` D-01–D-24 and Phase 8 inheritance; no user prompts. Default officer filter is implicit (param absent) with **Include self-help** widening chip (`routing_destination=all`). Playbook panel uses muted civic card, not AI blue well. Citizen workflow branches on `workflow_variant`; pending triage keeps Phase 8 4-step until routing completes. Escalate uses AlertDialog confirm, outline trigger. Officer override mirrors existing StatusActions + AlertDialog patterns.
