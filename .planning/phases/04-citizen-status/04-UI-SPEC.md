---
phase: 4
slug: citizen-status
status: approved
shadcn_initialized: true
preset: radix-nova + neutral + CSS variables; primary Clinic Blue #2563EB (live globals.css — NOT teal)
created: 2026-07-20
inherits: .planning/phases/02-public-experience/02-UI-SPEC.md
sources:
  - 04-CONTEXT.md (D-01–D-18 locked)
  - REQUIREMENTS.md (CIT-01..04, DASH-08)
  - ROADMAP.md Phase 4
  - PRODUCT.md (public civic clarity; AI advisory never authority)
  - DESIGN.md (Clinic Blue #2563EB, Source Sans 3, light-only)
  - frontend/src/app/globals.css (--primary: #2563EB)
  - frontend/src/app/[locale]/report/success/page.tsx (copy + status URL prep)
  - impeccable brand register (public citizen tone) + product register (officer copy control only)
  - Phase 2 UI-SPEC (public form/success patterns); Phase 3 UI-SPEC (detail header chrome for DASH-08)
---

# Phase 4 — UI Design Contract

> Visual and interaction contract for **Citizen Status**. Public `/status` is a civic task surface (form + result); officer “Copy status link” sits on dashboard detail chrome.
> Scope: CIT-01..04, DASH-08. **Not** token re-issue, notifications, maps, or Phase 7 triage.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (initialized — `frontend/components.json`) |
| Preset | `style: radix-nova`, `baseColor: neutral`, CSS variables; `--primary` = Clinic Blue `#2563EB` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react |
| Font | Source Sans 3 only (400 / 600) |
| Register | **brand/public civic** for `/status`; **product** for officer copy control only |

**Brand locks (must not regress):**
- Clinic Blue `#2563EB` / Deep `#1D4ED8` — **not** teal `#0F766E`, not purple, not neon, not cream/sand body
- Ink `#1A2B3C`, panel `#F1F5F9`, soft `#EFF6FF`, destructive `#DC2626`
- Light-only; flat tonal surfaces; no ghost-cards (border + huge shadow)
- AI must **not** appear on the status page as authority (payload excludes AI; UI must not invent AI labels)

**Reuse existing:** `button`, `input`, `label`, `form`, `alert`, `badge`, `skeleton`, `card` (result panel only — interactive/read container), `separator`, `tooltip` (optional token helper).

**Phase 4 add (shadcn official only, if missing):** `sonner` **or** reuse success-page live-region + Check/Copy icon pattern for toast feedback (prefer **live region + icon swap** matching success page — no new toast library required). If toast component already exists from Phase 3, reuse it.

**Registry:** shadcn official only — `registries: {}`. No third-party blocks.

---

## Spacing Scale

Declared values (multiples of 4) — inherits Phase 1/2:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge pad |
| sm | 8px | Field stack tight; history row meta gap |
| md | 16px | Default; form field vertical rhythm; result panel inner stack |
| lg | 24px | Panel padding; form → result gap |
| xl | 32px | Page content pad-x; header → main |
| 2xl | 48px | Main vertical breathing on desktop |
| 3xl | 64px | Page top/bottom on public status (align success page) |

Exceptions:
- **44px** min touch height for Check status, Copy status link, copy buttons, inputs
- Icon-only copy controls: hit area ≥ **44×44**

---

## Typography

Exactly 4 sizes, 2 weights (400 + 600). Public status uses **fixed rem** (task UI), not Home Display clamps:

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px (0.875rem) | 400 | 1.4 | Field labels, helpers, history timestamps, privacy note, toast |
| Body | 16px (1rem) | 400 | 1.5 | Page support, summary, empty/error copy, history notes |
| Heading | 20px (1.25rem) | 600 | 1.2 | “Check report status”, result current-status title, history section title |
| Display | 28px (1.75rem) | 600 | 1.2 | **Not used on `/status`** — reserved if needed for brand mark only in header (existing success pattern uses Heading-scale title) |

**Rules:**
- Status page title = Heading 20px/600 (match success “Report received” weight hierarchy — may use `text-2xl` = 24px only if composed as Heading + slight bump; prefer **20–24px max**, no 40px Display)
- No third weight. No uppercase tracked eyebrows.
- Status badge text always present (never color alone).
- Monospace (`font-mono`, Label size) for report ID field value display in result header — optional, matching success code blocks.

---

## Color

60 / 30 / 10 — live tokens in `globals.css` / `DESIGN.md`:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Status page canvas, form surface, result panel |
| Secondary (30%) | `#F1F5F9` | Header/footer bars, history row wells, empty state soft wash |
| Accent (10%) | `#2563EB` | Reserved list below |
| Accent deep | `#1D4ED8` | Hover / pressed primary |
| Soft accent | `#EFF6FF` | Optional current-status highlight wash (not CTA flood) |
| Destructive | `#DC2626` | Error Alert text/border only |
| Ink | `#1A2B3C` | Body, headings |
| Muted text | `#64748B` | Helpers, timestamps, privacy note |
| Quiet line | `#E2E8F0` | Dividers, input borders at rest |

Accent reserved for (only):
1. Primary CTA **Check status** (pill/solid Clinic Blue)
2. Focus-visible rings on form fields and buttons
3. Active locale switcher indicator (existing pattern)
4. Officer **Copy status link** outline/primary affordance on detail (product chrome — Clinic Blue text or outline, not flood)
5. Status badge “resolved” / “reviewing” text+icon accents — **never** full-bleed Clinic Blue panels

**Not accent:** history timeline lines, skeleton pulses, empty illustrations, officer hint body text.

**Forbidden:** purple gradients, teal brand, neon glow, cream `#F4F1EA` body, dark cyber shells, ghost-cards.

---

## Surfaces & composition

### 1. Public `/[locale]/status` (CIT-01)

**Tone (D-04):** Public civic/light — same chrome family as Report success (sticky white header + brand link + LocaleSwitcher + quiet footer). **No marketing hero**, no full-bleed photo, no stats, no AI disclaimer theater.

**Layout (one composition):**
1. Header (brand → Home, locale)
2. Main `max-w-xl` centered column (match success)
3. Page Heading + one support sentence
4. Lookup form (report ID + access token + primary CTA)
5. Result region below form (or replaces empty state after fetch) — status, summary, history
6. Footer

**Not in first viewport:** hero imagery, officer CTAs, AI recommendation blocks, evidence galleries.

### 2. Query-param auto-fill + auto-fetch (D-01, D-02)

| Rule | Contract |
|------|----------|
| Params | `reportId` + `token` (camelCase) — match success prep URL `/status?reportId=…&token=…` |
| Locale | Routes `/en/status`, `/vi/status` (`localePrefix: 'always'`) |
| Prefill | When params present and non-empty strings, fill both fields |
| Auto-submit | If both params present and valid-shaped (non-empty trimmed strings), **auto-fetch once** on mount; user may edit fields and re-submit |
| Malformed | Empty/missing either param → no auto-fetch; show idle form (empty state) |
| After fetch | Keep fields editable; do not clear token from inputs on success (citizen may re-check); never write token into analytics |

**Security UX note (D-09):** Below form, Label-size muted privacy line: status URLs contain a secret — do not post publicly. Do not show raw token in page chrome outside the input.

### 3. Result panel (CIT-02 / D-05..D-08)

On success show **only**:
1. **Current status** — Badge + human label (EN/VI catalog), optional soft accent wash
2. **Short summary** — citizen-facing Body text
3. **Status history** — newest-first (D-07); each row: timestamp (Label muted) + status label + optional citizen-safe note (Body)

**Must never render:** AI recommendation, evidence, urban context, confidence, severity internals, officer `actor_id`/email, raw analysis JSON.

**Empty history (D-08):** Still show current status + summary; history section heading + empty copy “No updates yet.”

### 4. Failure & rate-limit (D-16, D-17 / CIT-03, CIT-04)

| Condition | HTTP | UI |
|-----------|------|-----|
| Invalid / missing / malformed / expired token | 401 | **One** generic Alert — no existence leak; no “expired” vs “not found” variants |
| Rate limited | 429 | Calm Alert; honor Retry-After if present for disable duration only — copy stays generic |
| Network / 5xx | — | Generic connection error (no report existence language) |

Client must not branch copy by error subtype beyond **401 vs 429 vs network**.

### 5. Officer “Copy status link” (DASH-08 / D-13..D-15)

| Rule | Contract |
|------|----------|
| Placement | `/dashboard/reports/[reportId]` header/meta near report id / status — **not** buried only in resolve actions |
| Clipboard value | Absolute URL preferred: `{origin}/{locale}/status?reportId={reportId}` — **no token** (D-14a). Locale = officer UI locale or app default `en` if dashboard unlocalized — prefer current app locale if available |
| Toast / live region | “Link copied” EN/VI — same Check/Copy + `aria-live` pattern as success page (D-15) |
| Recovery hint (D-14b) | Short muted Label/Body under control: full tokenized link was shown once at submission and cannot be recovered from the dashboard |
| Out of scope | Token re-issue / rotation (D-14c) |

---

## Visual hierarchy & focal points

| Screen | First focal | Second | Must not compete |
|--------|-------------|--------|------------------|
| `/status` idle | Heading “Check report status” | Form fields → **Check status** | Hero photo, AI badges, marketing CTAs |
| `/status` loading | Disabled CTA + “Checking status…” | Skeleton in result region | Spinner-only with no text |
| `/status` success | Current status badge + label | Summary → history list | AI blocks, evidence |
| `/status` error | Generic Alert | Form remains editable | Distinct “not found” vs “expired” |
| Detail copy control | **Copy status link** | Recovery hint | Competing primary Resolve button styling |

---

## Copywriting Contract

EN defaults; VI must be natural equivalents in next-intl (not literal calques). Suggested key namespace: `public.status*` and `dashboard.copyStatus*`.

### Public status — EN

| Element | Key (suggested) | Copy |
|---------|-----------------|------|
| Page heading | `statusHeading` | Check report status |
| Page support | `statusBody` | Enter your report ID and access token to see updates. |
| Report ID label | `reportIdLabel` | Report ID *(reuse)* |
| Token label | `accessTokenLabel` | Access token *(reuse)* |
| Primary CTA | `checkStatus` | Check status |
| Loading | `statusChecking` | Checking status… |
| Privacy note | `statusPrivacyNote` | Your status link is private. Don’t share it publicly. |
| Empty (idle, no result yet) heading | `statusEmptyHeading` | Enter your details to check status |
| Empty idle body | `statusEmptyBody` | Use the report ID and access token from your submission confirmation. |
| Empty history | `statusHistoryEmpty` | No updates yet. |
| History section | `statusHistoryHeading` | Status history |
| Current status label | `statusCurrentLabel` | Current status |
| Summary label | `statusSummaryLabel` | Summary |
| Generic verify failure (401) | `statusVerifyFailed` | We couldn’t verify that report and token. Check both and try again. |
| Rate limit (429) | `statusRateLimited` | Too many attempts — try again shortly. |
| Network error | `statusNetworkError` | Could not check status. Check your connection and try again. |
| Copied (reuse) | `copied` | Copied |
| Success-page status link label update | `statusLinkPrep` | Status link — copy to check updates *(replace “coming soon”)* |

### Public status — VI

| Element | Copy |
|---------|------|
| Page heading | Kiểm tra trạng thái báo cáo |
| Page support | Nhập mã báo cáo và mã truy cập để xem cập nhật. |
| Primary CTA | Kiểm tra trạng thái |
| Loading | Đang kiểm tra trạng thái… |
| Privacy note | Liên kết trạng thái là riêng tư. Đừng chia sẻ công khai. |
| Empty idle heading | Nhập thông tin để kiểm tra trạng thái |
| Empty idle body | Dùng mã báo cáo và mã truy cập từ trang xác nhận gửi báo cáo. |
| Empty history | Chưa có cập nhật. |
| History section | Lịch sử trạng thái |
| Current status | Trạng thái hiện tại |
| Summary | Tóm tắt |
| Verify failure | Không xác minh được báo cáo và mã truy cập. Kiểm tra lại rồi thử lại. |
| Rate limit | Quá nhiều lần thử — vui lòng thử lại sau. |
| Network error | Không kiểm tra được trạng thái. Kiểm tra kết nối rồi thử lại. |
| Copied | Đã sao chép |
| Status link prep | Liên kết trạng thái — sao chép để theo dõi cập nhật |

### Officer detail — EN

| Element | Key (suggested) | Copy |
|---------|-----------------|------|
| Button | `copyStatusLink` | Copy status link |
| Toast | `statusLinkCopied` | Link copied |
| Recovery hint | `statusLinkRecoveryHint` | Citizens need the access token from their submission page. The full link can’t be recovered here. |

### Officer detail — VI

| Element | Copy |
|---------|------|
| Button | Sao chép liên kết trạng thái |
| Toast | Đã sao chép liên kết |
| Recovery hint | Người dân cần mã truy cập từ trang gửi báo cáo. Không thể khôi phục liên kết đầy đủ tại đây. |

**Destructive confirmation:** None on status page. No destructive actions in Phase 4 citizen flow.

**Banned CTAs:** “Submit”, “OK”, “Click here”, “Send”, “Verify” (use **Check status**).

---

## Interaction & states

| State | Behavior |
|-------|----------|
| Idle | Form empty (or prefilled); result region shows empty idle copy — not an error |
| Prefill + auto-fetch | One automatic lookup when both query params present; show loading; then success or generic error |
| Loading | Disable primary CTA; `aria-busy` on result region; Skeleton (2–3 lines) preferred over orphan spinner; announce `statusChecking` via live region |
| Success | Result panel with status / summary / history; form stays usable for re-check |
| Empty history | Success layout + `statusHistoryEmpty` |
| 401 error | Destructive-border Alert with `statusVerifyFailed` only; clear any prior result payload from view |
| 429 error | Alert with `statusRateLimited`; optionally disable CTA until Retry-After elapses |
| Network error | Alert with `statusNetworkError` |
| Re-submit | User edits fields → Check status → new fetch; cancel in-flight only if practical |
| Officer copy | Clipboard write → icon Check 2s → live region “Link copied”; hint always visible near control |

**Motion:** State only, 150–250ms (opacity/disabled). No page-entrance choreography on `/status`. Honor `prefers-reduced-motion` (existing globals.css rules).

**BFF:** Prefer Next public BFF mirroring analyze (agent discretion) — UI contract assumes JSON `{ status, summary, history[] }` success shape; errors generic.

---

## Accessibility (WCAG 2.2 AA)

- Focus-visible Clinic Blue rings on all controls; 44px min targets
- Labels associated with inputs; errors via `aria-describedby` / `aria-invalid` on client validation (empty fields before submit)
- Result region: `aria-live="polite"` for loading → success/error transitions
- Copy/toast: `role="status"` live region (success-page pattern)
- Status badges: text label required; do not rely on color alone
- History list: semantic list or ordered timeline with readable timestamps
- Token input: `type="password"` **or** `type="text"` with `autocomplete="off"` — prefer **text + select-all** for civic paste UX (citizens paste long tokens); do not autocomplete
- Reduced motion: no decorative animation; loading skeleton may snap

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Existing set + optional sonner only if live-region pattern insufficient | not required |
| third-party | none | n/a |

---

## Deferred (must not appear in this contract’s UI)

- Token re-issue / rotation / officer-generated full links
- Email/SMS on status change (NOTF-01)
- Hash-fragment-only tokens
- Maps / Phase 7 self-help vs government triage on status page
- AI recommendation or evidence on public status

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved
**Reviewed:** 2026-07-20

### Pre-populated decisions (no user Q&A)

| Source | Count / notes |
|--------|----------------|
| 04-CONTEXT.md | D-01–D-18 locked (entry, payload, security, officer copy, failures) |
| REQUIREMENTS | CIT-01..04, DASH-08 |
| DESIGN.md + globals.css | Clinic Blue `#2563EB` (overrides Phase 2 teal wording) |
| Phase 2 UI-SPEC | Public spacing/typography/success copy patterns |
| Phase 3 UI-SPEC | Detail header product chrome; DASH-08 deferred here |
| User input this session | 0 (delegated) |
