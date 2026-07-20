# Phase 2: Public Experience - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a polished bilingual public experience: Home + Report submission with access tokens on success; harden public API (rate limit IP, image magic bytes, generic errors); protect officer dashboard with middleware and a basic post-login report card list.

**In scope:** DATA-03, DATA-08, DATA-09, DATA-10, PUB-01, PUB-02, PUB-03, PUB-04, PUB-06, AUTH-04 (paths updated for Phase 1 routing).

**Out of scope this phase:** Full `/status` lookup page (Phase 4); dashboard data table / advanced filters / export / resolve notes (Phase 3); PostGIS/maps (Phase 6); mailer backend for contact form.

</domain>

<decisions>
## Implementation Decisions

### Home page content
- **D-01:** Primary CTA is **“Report an issue” → `/report`** (locale-prefixed).
- **D-02:** **AI-advisory disclaimer** appears as a short supporting line in the **hero** (not only footer).
- **D-03:** Section order: **How it works → Instructions → About → Contact → Footer**.
- **D-04:** Visual tone: **civic / calm light UI** (not dark-dashboard aesthetic for public surfaces).
- **D-05:** Contact section is a **static block** (email + mailto and/or “coming soon” form UI) — **no mailer backend**.
- **D-06:** Instructions section: **3–5 short steps** (Describe → Location → Optional photo → Submit → Keep ID/token).
- **D-07:** Officer sign-in is a **subtle header/footer text link** only — does not compete with Report CTA.
- **D-08:** Hero uses a **full-bleed civic photo / atmosphere** visual (brand + headline + one CTA; no overlay clutter).

### Report form behavior
- **D-09:** Location is **optional but encouraged** (helper copy); submit allowed without coordinates.
- **D-10:** Image limits (JPEG/PNG/WebP, size) shown in **helper text** with **client Zod validation**; server remains authoritative (magic bytes per DATA-09).
- **D-11:** On success, **navigate to `/report/success`** showing `report_id` + access token (+ copy actions / status-link prep per PUB-04).
- **D-12:** During analyze: **disable submit** and show clear **“Analyzing your report…”** progress text; prevent double-submit.

### Locale & dashboard shell
- **D-13:** Locales use **URL prefixes** `/en/...` and `/vi/...` (next-intl).
- **D-14:** Default locale: **detect browser `Accept-Language`**, fallback **English**.
- **D-15:** Unauthenticated `/dashboard` access → **redirect to `/login` with return URL**.
- **D-16:** Phase 2 dashboard list = **simple recent report cards** (category, priority, status, summary) linking to detail — **not** the Phase 3 data table.
- **D-17:** **AUTH-04 path correction:** middleware protects **`/dashboard`** and dashboard report routes (e.g. `/dashboard/reports/*`), **not** public `/`. Align REQUIREMENTS wording when planning.

### Access token UX (area not discussed — REQUIREMENTS defaults)
- **D-18:** Follow DATA-03 / PUB-04: token **hashed at rest**; plaintext shown **once** on success page; include copyable status-link prep for Phase 4 `/status`.
- **Agent discretion:** token entropy/length, expiry policy (if any), exact copy messaging.

### Backend hardening (Track A — from requirements; not re-litigated)
- **D-19:** Rate limit using client IP via **`X-Forwarded-For`** behind Cloud Run (DATA-08).
- **D-20:** Image **magic-byte** validation (DATA-09).
- **D-21:** API errors return **generic client messages**; log exceptions server-side (DATA-10).

### Agent Discretion
- Exact hero photograph asset source (stock vs generated vs placeholder path)
- Exact EN/VI marketing copy wording
- Whether Phase 2 keeps MVP-simple filter query params on card list or none
- Token format/expiry details (D-18)
- Exact shadcn components for success page and Home sections

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & prior phase
- `.planning/PROJECT.md` — Milestone v2, bilingual EN/VI, parallel tracks
- `.planning/REQUIREMENTS.md` — DATA-03/08/09/10, PUB-01–04/06, AUTH-04
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, plans 02-01/02-02/02-03
- `.planning/phases/01-supabase-foundation/01-CONTEXT.md` — Locked routes (`/` Home, `/dashboard`), next-intl scaffold, JWT/`@supabase/ssr`, Supabase Storage, `access_tokens` table

### Codebase
- `.planning/codebase/ARCHITECTURE.md` — Public analyze + officer proxy flows
- `.planning/codebase/CONVENTIONS.md` — Frontend patterns
- `.planning/codebase/CONCERNS.md` — Rate limit IP, middleware wiring, error leakage
- `frontend/src/components/ReportForm.tsx` — Current form behavior to replace with RHF+Zod
- `frontend/src/app/report/page.tsx` — Report page entry
- `frontend/src/app/login/page.tsx` — Login (migrate to Supabase Auth)
- `frontend/src/proxy.ts` — Replace with proper `middleware.ts` for `/dashboard`
- `backend/app/api/reports.py` — Analyze response must include access token fields
- `backend/app/security.py` — Rate limiter to fix for forwarded IP

### Product
- `idea.md` — Citizen token tracking intent; AI advisory positioning

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ReportForm.tsx` — Geolocation + multipart submit pattern; rebuild with RHF+Zod and shadcn inputs
- Public BFF `frontend/src/app/api/public/reports/analyze/route.ts` — Keep proxy; response shape gains token
- Phase 1 shadcn theme tokens + next-intl namespaces — Extend with real Home/Report copy

### Established Patterns
- FormData POST to `/api/public/reports/analyze`
- Officer list currently on `/` via `officerFetch` — move under `/dashboard` with JWT

### Integration Points
- Success page needs token from analyze response (backend Track A + frontend Track B sync)
- Middleware matcher: locale prefixes + `/dashboard`
- Login returnUrl query param after Supabase Auth

</code_context>

<specifics>
## Specific Ideas

- User chose **dedicated success route** over inline success on the form page
- Public site should feel **civic/light**, distinct from officer dashboard chrome
- Contact is explicitly **non-functional mailer** in Phase 2

</specifics>

<deferred>
## Deferred Ideas

- Full `/status` citizen lookup UI — Phase 4 (link prep OK on success page)
- Dashboard data table, advanced filters, Excel export, resolve notes — Phase 3
- Contact form email delivery backend — future
- Access token advanced policies (rotation, multi-device) — not discussed; keep simple for Phase 2

</deferred>

---

*Phase: 2-Public Experience*
*Context gathered: 2026-07-20*
