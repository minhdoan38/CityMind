---
phase: 2
slug: public-experience
status: approved
shadcn_initialized: false
preset: inherits Phase 1 — new-york + zinc + CSS variables; primary Civic Teal #0F766E
created: 2026-07-20
reviewed_at: 2026-07-20
inherits: .planning/phases/01-supabase-foundation/01-UI-SPEC.md
sources:
  - 02-CONTEXT.md (D-01–D-21 locked)
  - PRODUCT.md / DESIGN.md seed (Trustworthy Counter)
  - Phase 1 UI-SPEC (tokens, accent rules)
  - REQUIREMENTS PUB-01–04/06, AUTH-04, DATA-03/08/09/10
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for Public Experience. Inherits Phase 1 design system; extends copy, surfaces, and form/success patterns.
> Scope: Home, Report form, success page, locale chrome, login + middleware-protected dashboard card list. **Not** `/status` (Phase 4) or data table (Phase 3).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (must exist from Phase 1 Track B; if missing, init before Track B work) |
| Preset | `new-york` + `zinc` + CSS variables; `--primary` = Civic Teal `#0F766E` |
| Component library | Radix (via shadcn) |
| Icon library | lucide-react |
| Font | Source Sans 3 (same as Phase 1) |

**Additional Phase 2 components (official registry only):** `textarea`, `form` (RHF helpers), `progress` or inline status text, `badge`, `skeleton`, `dialog` (optional copy-confirm), `tooltip` (token help).

**Registry:** shadcn official only — no third-party blocks.

---

## Spacing Scale

Same as Phase 1 (8-point):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps |
| sm | 8px | Compact gaps, form field stack tight |
| md | 16px | Default; form field vertical rhythm |
| lg | 24px | Section inner padding |
| xl | 32px | Layout gaps; Home section padding-x |
| 2xl | 48px | Between Home sections |
| 3xl | 64px | Page top/bottom; hero content inset |

Exceptions:
- **44px** min touch height for “Report an issue”, “Submit report”, success copy buttons
- Hero content vertical pad ≥ **64px** (3xl) on mobile; ≥ **96px** only if implemented as `3xl + xl` (64+32) — do not invent a 96 token; compose from scale

---

## Typography

Exactly 4 sizes, 2 weights (400 + 600) — Phase 1 scale with Display raised for real Home hero:

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label | 14px | 400 | 1.4 | Form labels, helper text, footer links, officer header link |
| Body | 16px | 400 | 1.5 | Section body, instructions steps, AI disclaimer, form errors |
| Heading | 20px | 600 | 1.2 | Section titles (How it works, Instructions, About, Contact), Report page title, card titles |
| Display | 40px | 600 | 1.15 | Home hero headline only — `clamp(1.75rem, 5vw, 2.5rem)` (max 40px); letter-spacing ≥ -0.04em; `text-wrap: balance` |

**Rules:** No fifth size. No uppercase tracked section eyebrows. Dashboard card list uses Heading/Body/Label only (no Display).

---

## Color

Inherits Phase 1 60/30/10:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` | Public pages, form canvas, success page |
| Secondary (30%) | `#F0F4F3` | Header/footer bars, instruction step surfaces, dashboard sidebar + card chrome |
| Accent (10%) | `#0F766E` | Reserved list below |
| Destructive | `#B42318` | Form validation / API error text and borders |
| Ink | `#14201D` | Body and headings |
| Muted text | `#5C6B66` | Helpers, disclaimer, officer link |
| Quiet line | `#D5DEDB` | Dividers, input borders at rest |

Accent reserved for (only):
1. Primary CTAs: “Report an issue”, “Submit report”, “Copy report ID”, “Copy access token”
2. Active locale / focus-visible rings
3. Progress/analyzing indicator accent (spinner or bar track fill)
4. Active sidebar item on dashboard
5. Text links that are primary actions (Report CTA style) — **not** the subtle Officer sign-in link (muted)

**Public vs dashboard:** Public stays light civic (D-04). Dashboard keeps Phase 1 shell chrome. Do not apply dark “smart city” theme to Home/Report.

**Hero media:** Full-bleed civic photo is imagery, not accent color. No colored glass overlays, floating badges, or metric chips on the hero (D-08 + anti-slop).

---

## Visual hierarchy & focal points

| Screen | First focal | Second | Must not compete |
|--------|-------------|--------|------------------|
| Home hero | **CityMind** brand + Display headline | Single CTA “Report an issue” | Officer link, stats, multi-CTA, overlay badges |
| Home sections | Section Heading | One short body + optional step list | Card grids of equal weight; kicker eyebrows |
| Report form | Page Heading “Report an issue” | Description field → Submit report | Decorative side panels |
| Analyzing | Progress copy “Analyzing your report…” | Disabled submit (no second action) | Skeleton spam that hides copy |
| Success | “Report received” Heading | report_id + access token + copy actions | Upsell cards; dark dashboard chrome |
| Login | “Officer sign-in” + “Sign in to dashboard” | — | Public Report CTA |
| Dashboard cards | “Reports” nav active | First report card title/summary | Phase 3 table chrome |

**Home composition (D-03):** Hero → How it works → Instructions (3–5 steps) → About → Contact (static) → Footer. One job per section.

**Hero budget (D-08):** Brand, one headline, one supporting disclaimer line (D-02), one CTA, full-bleed civic photo. No inset hero cards, no floating chips.

---

## Copywriting Contract

EN defaults; VI must be natural equivalents in next-intl (not literal calques).

| Element | Copy |
|---------|------|
| Primary CTA (Home) | Report an issue |
| Hero supporting (AI) | AI helps organize reports. Officers review and decide. |
| Primary CTA (form) | Submit report |
| Analyzing | Analyzing your report… |
| Success heading | Report received |
| Success body | Save your report ID and access token. You’ll need them to check status later. |
| Copy report ID | Copy report ID |
| Copy access token | Copy access token |
| Token warning | This token is shown once. We can’t show it again. |
| Status link prep | Status link (coming soon) — copy for later |
| Empty dashboard heading | No reports yet |
| Empty dashboard body | Citizen reports will show up here after submission. |
| Form error (client) | Fix the highlighted fields, then try again. |
| Form error (network/API) | Could not send your report. Check your connection and try again. |
| Image helper | Optional photo — JPEG, PNG, or WebP. Keep it under the size limit shown. |
| Location helper | Location helps officers respond faster. You can still submit without it. |
| Officer link | Officer sign-in |
| Contact | Email us at {public email} — or mailto link. Form: “Message form coming soon.” |
| Destructive confirmation | None new beyond Phase 1 logout |

**Instructions steps (D-06) — labels only:**
1. Describe the issue  
2. Add location (optional)  
3. Attach a photo (optional)  
4. Submit your report  
5. Keep your ID and access token  

No generic CTAs: never “Submit”, “OK”, “Click here”, “Send”.

---

## Interaction & states

| Flow | Behavior |
|------|----------|
| Report submit | Disable primary button while analyzing; prevent double-submit (D-12) |
| Location | Optional; encourage via helper (D-09) |
| Image | Client Zod + helper; server magic bytes authoritative (D-10) |
| Success | Navigate to `/[locale]/report/success` (D-11); show plaintext token once (D-18) |
| Locale | `/en/...` and `/vi/...`; browser Accept-Language → fallback EN (D-13, D-14) |
| Auth gate | Unauthenticated `/dashboard` → `/login?returnUrl=…` (D-15, D-17) |
| Dashboard list | Simple cards: category, priority, status, summary → detail (D-16) |

**Motion:** State only (150–250ms). Analyzing = opacity/disabled + text, not choreographed page entrance. Honor `prefers-reduced-motion`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Phase 1 set + textarea, form, badge, skeleton, progress (or text-only), tooltip, dialog (optional) | not required |
| third-party | none | n/a |

---

## Accessibility (PUB-06)

- WCAG 2.2 AA; focus-visible on all controls
- Errors tied to fields via `aria-describedby` / `aria-invalid`
- Token/ID copy buttons: announce “Copied” via live region
- Hero image: meaningful `alt` or empty alt if pure decoration with adjacent brand text
- Locale switcher: accessible name
- Do not rely on color alone for priority/status on cards (badge text required)

---

## Deferred (must not appear in this contract’s UI)

- Full `/status` lookup page — Phase 4 (prep link copy only)
- Data table / filters / export / resolve — Phase 3
- Contact mailer backend — future

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS (FLAG: shadcn still pending Phase 1 Track B)

**Approval:** approved 2026-07-20

### Checker notes
| Dimension | Verdict | Notes |
|-----------|---------|-------|
| 1 Copywriting | PASS | Specific CTAs; success/token/empty/error with next steps |
| 2 Visuals | PASS | Focal points + hero budget + section order from CONTEXT |
| 3 Color | PASS | Inherited 60/30/10; accent reserved list extended for Phase 2 |
| 4 Typography | PASS | 4 sizes / 2 weights; Display 40px for Home hero only |
| 5 Spacing | PASS | Standard scale; 44px touch justified |
| 6 Registry | PASS | Official only; FLAG init deferred to Phase 1 |
