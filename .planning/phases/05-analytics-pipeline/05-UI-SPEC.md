---
phase: 5
slug: analytics-pipeline
status: approved
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables; primary Clinic Blue #2563EB (live globals.css)
created: 2026-07-20
approved: 2026-07-20
inherits:
  - .planning/phases/03-dashboard-polish/03-UI-SPEC.md
  - .planning/phases/02-public-experience/02-UI-SPEC.md
sources:
  - 05-CONTEXT.md (D-01–D-18 locked)
  - REQUIREMENTS.md (ANLY-01, ANLY-02, ANLY-03)
  - ROADMAP.md Phase 5 Tracks A∥B∥C
  - PRODUCT.md (register: product; officers decide; AI advisory)
  - DESIGN.md (Clinic Blue, Source Sans 3, light-only, flat-by-default)
  - frontend/src/app/globals.css (--primary: #2563EB)
  - Phase 3 UI-SPEC (dashboard product density, URL searchParams, empty/error spirit)
  - Phase 2 UI-SPEC (public Home section cadence, EN/VI)
---

# Phase 5 — UI Design Contract

> Visual and interaction contract for **Analytics Pipeline** frontend surfaces.
> **Track C (primary):** Officer Analytics tab — three charts + hotspot list + date-range chrome.
> **Track B (optional thin):** Public Home stats strip — non-sensitive aggregates only.
> **Track A** is backend/ETL — no new UI beyond API-driven states above.
>
> Out of scope: MapLibre / PostGIS maps (Phase 6); ops CRUD; citizen status; notifications; predictive ML; PII/evidence in charts.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `frontend/components.json`) |
| Preset | `style: radix-nova`, `baseColor: neutral`, CSS variables; `--primary` = Clinic Blue `#2563EB` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react |
| Font | Source Sans 3 only (400 / 600) |
| Register | **product** for `/dashboard/analytics`; **brand/public civic** for Home stats strip |

**Stack locks (agent discretion — no Phase 5 RESEARCH.md yet):**

| Concern | Contract |
|---------|----------|
| Charts | **recharts** via shadcn official `chart` block (add if missing). No Chart.js, no custom SVG kitchen-sink. |
| Date presets | Native `select` or shadcn `Select` + two date `Input type="date"` for custom from→to |
| URL sync | Next.js `searchParams` — keys: `range=7\|30\|90\|custom`, `from`, `to` (ISO date). Default `range=30` (D-09). Same spirit as Phase 3 filters. |
| Auth | Officer JWT only for Analytics tab (D-07). Public stats via separate aggregate BFF — never raw BigQuery in browser (D-13). |
| Route | `/dashboard/analytics` (or locale-neutral dashboard path matching existing shell) |

**Reuse existing:** `button`, `badge`, `input`, `label`, `alert`, `skeleton`, `separator`, `tooltip`, `sidebar`, `card` (chart/hotspot containers only — interaction/read surfaces, not decorative card grids), `dropdown-menu`.

**Phase 5 add (shadcn official only, if missing):** `chart`, `select`, `tabs` (only if Analytics shares chrome with Reports via tabs — prefer **sidebar nav item** matching Phase 3 shell; skip Tabs if sidebar already used), `table` (hotspot ranked list — reuse Phase 3 table if present).

**Registry:** shadcn official only — `registries: {}`. No third-party blocks. Safety gate: not required for official.

---

## Spacing Scale

Declared values (multiples of 4) — inherits Phase 3 product scale:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, chart legend micro-gaps |
| sm | 8px | Preset chip/control gaps; hotspot row meta |
| md | 16px | Default; chart block inner pad; filter→chart stack |
| lg | 24px | Section padding; gap between chart blocks |
| xl | 32px | Page header → date chrome gap |
| 2xl | 48px | Major breaks between Analytics page regions |
| 3xl | 64px | Public Home section vertical rhythm only (Track B) |

Exceptions:
- **44px** min touch height for date presets, Apply range, Retry
- Chart plot area min-height **240px** (desktop); **200px** (mobile) — not a spacing token, layout constraint
- Public stats strip: horizontal gap **md (16)** between metrics; section pad **lg–2xl** per Home cadence

---

## Typography

Product Analytics (Track C): **fixed rem**, 4 sizes, 2 weights — same as Phase 3:

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px (0.875rem) | 400 | 1.4 | Chart axis ticks, legend, date labels, hotspot rank meta, captions |
| Body | 16px (1rem) | 400 | 1.5 | Empty/error copy, hotspot names, range helper |
| Heading | 20px (1.25rem) | 600 | 1.2 | Page title “Analytics”, chart block titles |
| Display | 28px (1.75rem) | 600 | 1.2 | **Not used** on Analytics tab — reserved for public/marketing only |

Public Home stats (Track B):

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px | 400 | 1.4 | Metric captions (“Last 30 days”) |
| Body | 16px | 400 | 1.5 | Section support line |
| Heading | clamp 1.5–2rem (Phase 2) | 600 | 1.2 | Section title “Community snapshot” |
| Metric value | 20px (Heading) | 600 | 1.2 | Aggregate counts — **not** Display/hero-metric theater |

**Rules:**
- No third weight (no 500/700).
- No fluid clamps inside Analytics charts/chrome.
- Chart tooltips: Label 14px on ink; no bold rainbow series labels.
- Do not use Display for KPI big-numbers on officer Analytics (anti hero-metric).

---

## Color

60 / 30 / 10 restrained civic (light-only) — live tokens:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Analytics canvas, chart card surfaces |
| Secondary (30%) | `#F1F5F9` | Sidebar, page wells behind chart grid, public strip panel optional |
| Accent (10%) | `#2563EB` | Reserved list below |
| Accent deep | `#1D4ED8` | Hover / pressed; active preset |
| Soft accent | `#EFF6FF` | Selected date preset wash; chart hover wash |
| Destructive | `#DC2626` | Load/API error Alert only — **no** destructive chart actions this phase |
| Ink | `#1A2B3C` | Body, headings, axis labels |
| Muted text | `#64748B` | Helpers, empty captions, inactive presets |
| Quiet line | `#E2E8F0` | Chart card borders, gridlines (≤1px), separators |

Accent reserved for (only):
1. Active sidebar **Analytics** item
2. Active date preset / Apply custom range primary control
3. Focus-visible rings
4. **Single** primary series stroke/fill in volume chart (Clinic Blue) — category mix uses **neutral ramp** (ink → muted → soft accent), **not** rainbow categorical palette
5. Hotspot rank `01`–`0N` numerals in Clinic Blue text (same as Instruction steps)

**Not accent:** chart gridlines, inactive presets, skeleton pulses, SLA bars default fill (use ink/muted), public metric numbers (ink).

**Chart series limit:** Max **one** accent series + muted neutrals. Never purple/neon gradients. Never dual-Y decorative chrome.

**Forbidden:** purple SaaS chart themes, dark cyber dashboards, cream/sand body, ghost-cards (border + blur ≥16px shadow), radius > 16px on chart panels, map widgets, metric “hero number + sparkline” SaaS strips on officer Analytics.

---

## Visual hierarchy & focal points

| Surface | First focal | Second | Must not compete |
|---------|-------------|--------|------------------|
| Analytics tab | Date-range chrome (presets + custom) | Three chart blocks in order: Volume → Category → SLA | Decorative KPI hero row, maps, export chrome |
| Volume chart | Line/bar of daily counts | Range label in caption | Multiple competing series |
| Category chart | Horizontal bar or simple pie/donut with legend | Percent optional Label | More than 6 named categories — bucket remainder as “Other” |
| SLA chart | Distribution or median days closed | Caption clarifying closed statuses only | Fake zeros when warehouse empty |
| Hotspot list | Ranked table (category / area label + count) | Top N (default 5–10) | Map pins, bbox draw |
| Public Home stats | Section title + 1–2 count metrics | Top categories (k≥3) | Lat/lng, descriptions, officer notes, tokens |

**Layout (Track C):**
1. Page header (title + advisory one-liner)
2. Date-range toolbar (sticky optional under dashboard header — not required)
3. Chart grid: **1 column mobile**, **2 columns ≥lg** for Volume + Category; SLA full-width below; hotspot list full-width bottom
4. Each chart block: Heading + Caption (Label) + plot + empty/error slot

**Layout (Track B):**
- Place after Instructions / before Contact (preserve Phase 2 D-03 order)
- Single horizontal strip or simple 2–3 metric row — **not** a card carousel
- Hide entire section when unavailable (D-12) — no error toast blocking Home

---

## Interaction contract

### Date range (D-08, D-09, D-10)

| Control | Behavior |
|---------|----------|
| Presets | Last 7 / 30 / 90 days — segmented control or Select; **default 30** |
| Custom | From + To date inputs; Apply commits to URL |
| URL | `?range=30` or `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Invalid range | Inline error: from after to — do not fetch |
| Loading | Skeleton blocks matching chart layout (no layout jump) |
| Empty warehouse | Calm empty per chart — **do not** draw flat zero series that imply data |
| Error | Alert with Retry; charts hide or show error slot |

### Charts

| Block | Type | Notes |
|-------|------|-------|
| Volume over time | Line or vertical bar | X = day, Y = count created |
| Category mix | Horizontal bar preferred (a11y) or donut | Counts or %; “Other” for remainder |
| SLA / TTR | Histogram or simple summary + bar of median/p50 | Closed = resolved + rejected only |
| Hotspots | Ranked list/table | Category concentration (D-14); no map |

### Accessibility

- Every chart needs a **text summary** (visually hidden or Caption): e.g. “42 reports created in the last 30 days.”
- Color not sole encoding — category legend includes text labels
- `prefers-reduced-motion`: no chart entrance animations; instant render
- Touch targets ≥44px on presets and Retry

### Privacy (UI must enforce copy + empty rules)

- Public strip: never show counts for categories with **&lt; 3** reports — omit or “Other” (D-17)
- Officer Analytics may be finer; still no evidence URIs, tokens, citizen contact (D-16, D-18)
- No AI authority language on Analytics (“AI predicts…”) — analytics are warehouse aggregates, not models

---

## Copywriting Contract

EN defaults; VI natural equivalents in `frontend/messages/{en,vi}.json` (`dashboard.analytics`, `public.stats`). No hardcoded English in new chrome.

### Officer Analytics (Track C)

| Element | EN | VI |
|---------|----|----|
| Nav item | Analytics | Phân tích |
| Page title | Analytics | Phân tích |
| Page subtitle | Trends and resolution times from the analytics warehouse. Operational reports stay on Reports. | Xu hướng và thời gian xử lý từ kho phân tích. Báo cáo vận hành vẫn ở mục Báo cáo. |
| Primary CTA | Apply date range | Áp dụng khoảng thời gian |
| Preset 7 | Last 7 days | 7 ngày qua |
| Preset 30 | Last 30 days | 30 ngày qua |
| Preset 90 | Last 90 days | 90 ngày qua |
| Preset custom | Custom | Tùy chọn |
| From label | From | Từ |
| To label | To | Đến |
| Chart: volume | Reports created | Báo cáo đã tạo |
| Chart: volume caption | Daily count of new reports in the selected range. | Số báo cáo mới mỗi ngày trong khoảng đã chọn. |
| Chart: category | Category mix | Cơ cấu theo nhóm |
| Chart: category caption | Share of reports by category in the selected range. | Tỷ lệ báo cáo theo nhóm trong khoảng đã chọn. |
| Chart: SLA | Time to resolution | Thời gian xử lý |
| Chart: SLA caption | Days from open to resolved or rejected for closed reports. | Số ngày từ mở đến đã xử lý hoặc từ chối với báo cáo đã đóng. |
| Hotspot title | Top concentrations | Điểm tập trung hàng đầu |
| Hotspot caption | Highest-volume categories (or areas) in range — not a map. | Nhóm (hoặc khu vực) có lượng cao nhất trong khoảng — không phải bản đồ. |
| Empty heading | No analytics for this range | Không có dữ liệu phân tích cho khoảng này |
| Empty body | Try a wider date range, or check back after the daily sync finishes. | Thử khoảng rộng hơn, hoặc quay lại sau khi đồng bộ hàng ngày hoàn tất. |
| Empty warehouse | Analytics warehouse is empty | Kho phân tích đang trống |
| Empty warehouse body | The first daily sync has not landed yet. Reports remain available on the Reports tab. | Đồng bộ hàng ngày đầu tiên chưa có. Báo cáo vẫn xem được ở mục Báo cáo. |
| Error load | Could not load analytics. Check your connection and try again. | Không thể tải phân tích. Kiểm tra kết nối và thử lại. |
| Error API | Could not reach the analytics API. | Không thể kết nối API phân tích. |
| Retry | Try again | Thử lại |
| Invalid dates | Choose an end date on or after the start date. | Chọn ngày kết thúc bằng hoặc sau ngày bắt đầu. |
| Freshness note | Data through previous UTC day after the daily sync. | Dữ liệu đến hết ngày UTC trước sau đồng bộ hàng ngày. |

**Destructive actions:** none on Analytics UI this phase — no confirmation copy required.

### Public Home stats (Track B)

| Element | EN | VI |
|---------|----|----|
| Section title | Community snapshot | Toàn cảnh cộng đồng |
| Section body | Recent public totals only — no personal details. | Chỉ tổng hợp công khai gần đây — không có thông tin cá nhân. |
| Metric: total | Reports (30 days) | Báo cáo (30 ngày) |
| Metric: top categories | Common issues | Sự cố thường gặp |
| Unavailable | Community stats unavailable right now. | Thống kê cộng đồng tạm thời không có. |
| Hidden | *(render nothing — no placeholder)* | *(không render)* |

**Primary CTA (public strip):** none required — strip is informational. Optional link text if needed: **See how it works** → `#how-it-works` (reuse existing). Do **not** add “Submit” / “View dashboard”.

---

## Component inventory (executor checklist)

| UI piece | Spec |
|----------|------|
| Sidebar link Analytics | Active accent; order after Reports |
| DateRangeToolbar | Presets + custom fields + Apply |
| ChartCard ×3 | Heading, caption, skeleton, empty, error, plot |
| HotspotTable | Rank, label, count — flat border, no shadow |
| PublicStatsStrip | Optional; degrade hide; k-anonymity |
| Chart tooltip | Ink on white; Label size; border quiet line |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `chart`, `select` (if missing), reuse `table`/`button`/`alert`/`skeleton` | not required |
| third-party | none | n/a |

---

## Inheritance & non-goals

**Inherits from Phase 3:** Clinic Blue tokens, product density, URL `searchParams` pattern, empty/error spirit (DASH-07), sidebar shell, 44px targets, no ghost-cards.

**Inherits from Phase 2:** Public Home section order, bilingual EN/VI, civic tone, light-only.

**Must not include:** MapLibre, PostGIS UI, bbox filters, real-time streaming indicators, PagerDuty chrome, AI prediction copy, cream/teal brand regression.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-07-20

**Checker notes:** Pre-populated from 05-CONTEXT D-05–D-18; inherits Phase 3 product density. No BLOCKs. FLAG none — Primary CTA is verb+noun; accent reserved list is element-specific; chart library locked to shadcn `chart`/recharts pending RESEARCH confirmation at plan time.
