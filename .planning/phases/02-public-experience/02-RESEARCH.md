# Phase 2: Public Experience - Research

**Researched:** 2026-07-20
**Domain:** Bilingual Next.js public UX + citizen access tokens + API hardening + Supabase Auth dashboard gate
**Confidence:** HIGH
**Researcher role:** gsd-phase-researcher (generic-agent workaround)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Home page content
- **D-01:** Primary CTA is **“Report an issue” → `/report`** (locale-prefixed).
- **D-02:** **AI-advisory disclaimer** appears as a short supporting line in the **hero** (not only footer).
- **D-03:** Section order: **How it works → Instructions → About → Contact → Footer**.
- **D-04:** Visual tone: **civic / calm light UI** (not dark-dashboard aesthetic for public surfaces).
- **D-05:** Contact section is a **static block** (email + mailto and/or “coming soon” form UI) — **no mailer backend**.
- **D-06:** Instructions section: **3–5 short steps** (Describe → Location → Optional photo → Submit → Keep ID/token).
- **D-07:** Officer sign-in is a **subtle header/footer text link** only — does not compete with Report CTA.
- **D-08:** Hero uses a **full-bleed civic photo / atmosphere** visual (brand + headline + one CTA; no overlay clutter).

#### Report form behavior
- **D-09:** Location is **optional but encouraged** (helper copy); submit allowed without coordinates.
- **D-10:** Image limits (JPEG/PNG/WebP, size) shown in **helper text** with **client Zod validation**; server remains authoritative (magic bytes per DATA-09).
- **D-11:** On success, **navigate to `/report/success`** showing `report_id` + access token (+ copy actions / status-link prep per PUB-04).
- **D-12:** During analyze: **disable submit** and show clear **“Analyzing your report…”** progress text; prevent double-submit.

#### Locale & dashboard shell
- **D-13:** Locales use **URL prefixes** `/en/...` and `/vi/...` (next-intl).
- **D-14:** Default locale: **detect browser `Accept-Language`**, fallback **English**.
- **D-15:** Unauthenticated `/dashboard` access → **redirect to `/login` with return URL**.
- **D-16:** Phase 2 dashboard list = **simple recent report cards** (category, priority, status, summary) linking to detail — **not** the Phase 3 data table.
- **D-17:** **AUTH-04 path correction:** middleware protects **`/dashboard`** and dashboard report routes (e.g. `/dashboard/reports/*`), **not** public `/`. Align REQUIREMENTS wording when planning.

#### Access token UX (area not discussed — REQUIREMENTS defaults)
- **D-18:** Follow DATA-03 / PUB-04: token **hashed at rest**; plaintext shown **once** on success page; include copyable status-link prep for Phase 4 `/status`.
- **Agent discretion:** token entropy/length, expiry policy (if any), exact copy messaging.

#### Backend hardening (Track A — from requirements; not re-litigated)
- **D-19:** Rate limit using client IP via **`X-Forwarded-For`** behind Cloud Run (DATA-08).
- **D-20:** Image **magic-byte** validation (DATA-09).
- **D-21:** API errors return **generic client messages**; log exceptions server-side (DATA-10).

### the agent's Discretion
- Exact hero photograph asset source (stock vs generated vs placeholder path)
- Exact EN/VI marketing copy wording
- Whether Phase 2 keeps MVP-simple filter query params on card list or none
- Token format/expiry details (D-18)
- Exact shadcn components for success page and Home sections

### Deferred Ideas (OUT OF SCOPE)
- Full `/status` citizen lookup UI — Phase 4 (link prep OK on success page)
- Dashboard data table, advanced filters, Excel export, resolve notes — Phase 3
- Contact form email delivery backend — future
- Access token advanced policies (rotation, multi-device) — not discussed; keep simple for Phase 2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-03 | Access tokens stored hashed; plaintext shown once on submit only | `secrets.token_urlsafe` + SHA-256 hex into `access_tokens.token_hash`; return plaintext only in analyze response; success page sessionStorage flash (no query string) |
| DATA-08 | Rate limiting uses client IP behind proxy (`X-Forwarded-For`) | Parse trusted XFF hop in FastAPI; **BFF must forward XFF** when proxying analyze |
| DATA-09 | Image upload validates magic bytes, not only Content-Type | `filetype.guess(bytes)` allowlist JPEG/PNG/WebP; reject before Gemini/storage |
| DATA-10 | API errors return generic messages; exceptions logged server-side | Replace `HTTPException(..., f"...: {exc}")` with stable generic detail + `logging.exception` |
| PUB-01 | Home page with hero, how-it-works, about/contact/instructions, footer | Implement D-01–D-08 + UI-SPEC copy/layout under `[locale]` |
| PUB-02 | Bilingual EN/VI via next-intl with locale switcher | `localePrefix: 'always'`, Accept-Language detection (D-13/D-14); migrate off Phase 1 no-prefix scaffold |
| PUB-03 | Report form uses React Hook Form + Zod validation | RHF + zodResolver + shadcn Field/Controller; multipart FormData to existing BFF |
| PUB-04 | Submit success shows report_id + access token + copyable status link | Dedicated `/[locale]/report/success`; copy buttons + live region; status-link prep only |
| PUB-06 | Public pages mobile-responsive and accessible | UI-SPEC a11y contract (focus-visible, aria-invalid, 44px targets) |
| AUTH-04 | Protect dashboard routes (path corrected to `/dashboard` + reports) | Next.js 16 **`proxy.ts`** (not deprecated `middleware.ts`) + `@supabase/ssr` `getClaims()` + `returnUrl` |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Keep FastAPI for AI pipeline; Supabase for ops/auth; BigQuery analytics-only post-migration. `[CITED: AGENTS.md]`
- AI output is advisory; officers remain decision authority; access tokens must be hashed at rest. `[CITED: AGENTS.md]`
- Citizen status lookup is token-scoped (Phase 4); no cross-report leakage. `[CITED: AGENTS.md]`
- Maintain Cloud Run deployment path. `[CITED: AGENTS.md]`
- Bilingual EN/VI from Phase 2 onward. `[CITED: AGENTS.md]`
- Frontend: Next.js 16.2.10 App Router; Backend: FastAPI 0.115.x / Python 3.12. `[VERIFIED: frontend/package.json]` `[CITED: AGENTS.md]`
- Do not research/plan deferred maps or Phase 3/4 surfaces beyond prep links. `[CITED: 02-CONTEXT.md]`

## Summary

Phase 2 delivers the citizen-facing product surface and closes known MVP security gaps. The public track upgrades Home + Report to next-intl **prefix routing** (`/en`, `/vi`), rebuilds the report form with React Hook Form + Zod + shadcn, and shows a one-time access token on a dedicated success route. The backend track issues that token (hash-only at rest into the Phase 1 `access_tokens` table), fixes rate limiting for Cloud Run via `X-Forwarded-For`, sniffs image magic bytes, and sanitizes API errors. The officer track completes Supabase Auth login and a Next.js 16 network-boundary gate protecting `/dashboard` with a simple report card list.

Critical cross-cutting finding: citizens hit Next’s public BFF (`/api/public/reports/analyze`), which today re-fetches FastAPI **without** forwarding client IP headers. `[VERIFIED: frontend/src/app/api/public/reports/analyze/route.ts]` Rate limiting in FastAPI alone will key on the BFF/container IP unless the BFF forwards `X-Forwarded-For` (and FastAPI trusts the Cloud Run–appended hop). Phase 1 planned **no-prefix** next-intl; Phase 2 D-13 **locks prefixes** — planner must migrate routing, not extend the no-prefix scaffold. `[CITED: 01-04-PLAN.md]` `[CITED: 02-CONTEXT.md D-13]` On Next.js 16, AUTH-04’s “middleware” maps to **`proxy.ts`** (middleware filename deprecated). `[CITED: https://nextjs.org/docs/messages/middleware-to-proxy]` `[CITED: https://next-intl.dev/docs/routing/setup]`

**Primary recommendation:** Execute three parallel tracks — (A) token + XFF-forward + magic bytes + generic errors in FastAPI/BFF, (B) `[locale]` public Home/Report/success with RHF+Zod, (C) compose next-intl + Supabase `getClaims()` in `proxy.ts` with `/login?returnUrl=` and simple dashboard cards — syncing on `AnalyzeResponse.access_token` and locale route moves on Day 1.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bilingual Home / Report / success UI | Frontend Server (SSR) + Browser | CDN/Static (hero asset) | next-intl RSC + client form; static hero image |
| Locale negotiation (`Accept-Language`, prefixes) | Frontend Server (`proxy.ts`) | Browser (switcher) | next-intl middleware/proxy owns redirects |
| Report form validation (Zod) | Browser / Client | API / Backend | Client UX only; server authoritative |
| Multipart analyze ingest + Gemini | API / Backend | Frontend Server (BFF) | FastAPI owns AI; BFF proxies FormData |
| Access token generate / hash / store | API / Backend | Database / Storage | Service-role write to `access_tokens` |
| Show plaintext token once | Browser / Client | Frontend Server | sessionStorage flash after success navigation |
| Rate limit by client IP | API / Backend | Frontend Server (BFF header forward) | Limiter in FastAPI; BFF must pass XFF |
| Image magic-byte check | API / Backend | Browser (Zod MIME/size) | Server sniff authoritative (DATA-09) |
| Generic API errors + server logs | API / Backend | — | DATA-10 boundary |
| Officer login (email/password) | Frontend Server | Supabase Auth | `@supabase/ssr` cookies |
| Protect `/dashboard` | Frontend Server (`proxy.ts`) | API / Backend (JWT) | Gate UI; FastAPI still validates JWKS |
| Dashboard recent cards | Frontend Server | API / Backend | Server fetch via JWT BFF → `/recent` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next-intl` | `4.13.2` `[VERIFIED: npm view]` | App Router i18n + locale prefix routing | Official next-intl App Router + `defineRouting` / `localePrefix: 'always'` `[CITED: https://next-intl.dev/docs/routing/configuration]` |
| `react-hook-form` | `7.82.0` `[VERIFIED: npm view]` | Form state, double-submit control | shadcn Forms guide primary path `[CITED: https://ui.shadcn.com/docs/forms/react-hook-form]` |
| `zod` | `4.4.3` `[VERIFIED: npm view]` | Client schema (description, coords, file) | Paired with RHF via resolvers; PUB-03 |
| `@hookform/resolvers` | `5.4.0` `[VERIFIED: npm view]` | `zodResolver` bridge | Official RHF resolver package |
| `@supabase/ssr` | `0.12.3` `[VERIFIED: npm view]` | Cookie SSR client + proxy session refresh | Phase 1 lock; Supabase Next.js SSR docs `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` |
| `filetype` (PyPI) | `1.2.0` `[VERIFIED: pip index]` | Magic-byte MIME sniff | Pure Python, JPEG/PNG/WebP; no libmagic `[CITED: https://github.com/h2non/filetype.py]` |
| Python stdlib `secrets` + `hashlib` | 3.12+ | Token entropy + SHA-256 | No extra crypto dependency `[ASSUMED]` API shape stable |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `form`/`field`/`textarea`/`badge`/`skeleton` | Phase 1 registry | UI primitives | Home sections, Report, success, cards per UI-SPEC |
| `lucide-react` | Phase 1 pin | Icons | Copy / locale / card chrome only — no emoji |
| Next.js | `16.2.10` `[VERIFIED: package.json]` | App Router + `proxy.ts` | Already installed |
| FastAPI / Pydantic | existing | Analyze response + validation | Extend `AnalyzeResponse` with `access_token` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `filetype` | `python-magic` | Needs system libmagic; worse Cloud Run image story |
| `filetype` | Hand-rolled JPEG/PNG/WebP signatures | Fewer deps but easy to get WebP RIFF wrong — prefer library |
| `localePrefix: 'always'` | Phase 1 `never` / cookie-only | Contradicts D-13 — **do not use** |
| `middleware.ts` | — | Deprecated on Next 16; use `proxy.ts` `[CITED: nextjs.org/docs/messages/middleware-to-proxy]` |
| Token in `?token=` query | sessionStorage / POST flash | Query leaks via Referer, history, logs — avoid |
| Leftmost XFF IP | Rightmost trusted hop | Leftmost is spoofable `[CITED: adam-p XFF perils]` |

**Installation:**

```bash
# Frontend (pin exact; align with Phase 1 if already present)
cd frontend
npm install --save-exact next-intl@4.13.2 react-hook-form@7.82.0 zod@4.4.3 @hookform/resolvers@5.4.0
# @supabase/ssr@0.12.3 + @supabase/supabase-js from Phase 1 — do not duplicate divergent versions
npx shadcn@latest add textarea form badge skeleton tooltip  # + progress/dialog if needed; official registry only

# Backend
cd backend
# add to requirements.txt and install:
# filetype==1.2.0
pip install filetype==1.2.0
```

**Version verification (this session):** `next-intl@4.13.2`, `react-hook-form@7.82.0`, `zod@4.4.3`, `@hookform/resolvers@5.4.0`, `@supabase/ssr@0.12.3`, `filetype@1.2.0`. Postinstall scripts empty for audited npm packages. `[VERIFIED: npm view scripts.postinstall]`

## Package Legitimacy Audit

| Package | Registry | Age / Latest | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|--------------|-----------|-------------|---------|-------------|
| `next-intl` | npm | latest 2026-07-10 | ~4.5M/wk | github.com/amannn/next-intl | SUS (too-new) | **GO after checkpoint** — official docs + Phase 1 pin |
| `react-hook-form` | npm | latest 2026-07-18 | ~57M/wk | github.com/react-hook-form/react-hook-form | SUS (too-new) | **GO after checkpoint** — shadcn Forms standard |
| `zod` | npm | 2026-05-04 | ~235M/wk | github.com/colinhacks/zod | OK | Approved |
| `@hookform/resolvers` | npm | 2026-05-21 | ~49M/wk | github.com/react-hook-form/resolvers | OK | Approved |
| `@supabase/ssr` | npm | latest 2026-07-14 | ~5.7M/wk | github.com/supabase/ssr | SUS (too-new) | **GO after checkpoint** — Phase 1 + official Supabase docs |
| `filetype` | PyPI | 1.2.0 (2022) | unknown (seam) | github.com/h2non/filetype.py | SUS (unknown-downloads) | **GO after checkpoint** — prefer over python-magic |
| `python-magic` | PyPI | — | — | — | SUS | **REMOVED** — requires libmagic; not recommended |
| `pillow` | PyPI | — | — | — | SUS | **REMOVED** for sniffing — overkill; decode≠MIME sniff |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** `next-intl`, `react-hook-form`, `@supabase/ssr`, `filetype` — planner inserts `checkpoint:human-verify` before first install of any not already approved in Phase 1.

*Names confirmed via official docs + registry; SUS is seam “too-new/unknown-downloads”, not slop. `[VERIFIED: gsd package-legitimacy]`*

## Architecture Patterns

### System Architecture Diagram

```text
Citizen browser
  │  GET / → Accept-Language → 307 /en|vi/...
  │  GET /en/report  (RHF+Zod form)
  │  POST /api/public/reports/analyze  (multipart)
  ▼
Next.js BFF (App Router)
  │  Forward FormData + X-Forwarded-For (+ X-Real-IP optional)
  ▼
FastAPI POST /api/v1/reports/analyze
  │  1. Rate limit key = trusted client IP (XFF)
  │  2. Magic-byte sniff image (filetype) → 415 if bad
  │  3. Gemini analyze + Supabase Storage upload
  │  4. Insert report (service role)
  │  5. token = secrets.token_urlsafe(32)
  │     store sha256(token).hexdigest() + expires_at
  │  6. Return { report_id, access_token, analysis, persisted }
  │     (catch: log exc → generic 502)
  ▼
Browser success handoff
  │  sessionStorage.setItem(flash) → router.push(/[locale]/report/success)
  │  Success page reads once, clears storage, copy buttons
  ▼
Officer
  │  POST login → Supabase Auth cookies
  │  proxy.ts: refresh session + getClaims() on /dashboard/*
  │  unauth → /login?returnUrl=/dashboard/...
  │  dashboard cards ← BFF ← FastAPI /recent (Bearer JWT)
```

### Recommended Project Structure

```text
frontend/
├── messages/{en,vi}.json          # Home, Report, Success, Login, Dashboard strings
├── src/
│   ├── i18n/
│   │   ├── routing.ts             # defineRouting locales en/vi, localePrefix: 'always'
│   │   ├── navigation.ts          # Link, useRouter, redirect from createNavigation
│   │   └── request.ts             # getRequestConfig + requestLocale
│   ├── proxy.ts                   # next-intl + Supabase getClaims dashboard gate
│   ├── lib/supabase/{client,server}.ts
│   ├── components/
│   │   ├── ReportForm.tsx         # RHF+Zod rebuild
│   │   ├── LocaleSwitcher.tsx
│   │   └── dashboard/ReportCard.tsx
│   └── app/
│       ├── [locale]/
│       │   ├── layout.tsx
│       │   ├── page.tsx             # Home (PUB-01)
│       │   ├── report/page.tsx
│       │   └── report/success/page.tsx
│       ├── login/page.tsx           # may stay outside [locale] (agent discretion)
│       ├── dashboard/
│       │   ├── layout.tsx
│       │   ├── page.tsx             # card list
│       │   └── reports/[reportId]/page.tsx
│       └── api/public/reports/analyze/route.ts  # forward XFF
backend/app/
├── security.py                    # client_ip_from_request + rate limit
├── api/reports.py                 # magic bytes, token issue, generic errors
├── services/tokens.py             # NEW: generate/hash/insert access token
└── schemas.py                     # AnalyzeResponse.access_token: str
```

### Pattern 1: next-intl prefix routing (D-13/D-14)

**What:** `defineRouting({ locales: ['en','vi'], defaultLocale: 'en', localePrefix: 'always' })` + pages under `app/[locale]`. Default `localeDetection` uses `Accept-Language` then cookie. `[CITED: https://next-intl.dev/docs/routing/configuration]`  
**When to use:** All public Phase 2 pages.  
**Migration note:** Phase 1 plan used **no-prefix**; Phase 2 must switch to `always` and move routes under `[locale]`. `[CITED: 01-04-PLAN.md]`

```typescript
// Source: https://next-intl.dev/docs/routing/setup
import {defineRouting} from 'next-intl/routing';
import createMiddleware from 'next-intl/middleware';

export const routing = defineRouting({
  locales: ['en', 'vi'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export default createMiddleware(routing);
```

On Next.js 16 export this from `src/proxy.ts` (file formerly `middleware.ts`). `[CITED: https://next-intl.dev/docs/routing/setup]`

### Pattern 2: Access token issue-once (DATA-03)

**What:** Generate high-entropy URL-safe token; persist only SHA-256 hex; return plaintext once in JSON.  
**When to use:** Inside successful analyze after report insert (same transaction/order: report first, then token row).

```python
# Source: Python stdlib + Phase 1 schema access_tokens(token_hash PK, report_id, expires_at)
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

def issue_access_token(report_id: str, *, ttl_days: int = 365) -> str:
    plaintext = secrets.token_urlsafe(32)  # ~256 bits entropy [ASSUMED: adequate]
    token_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    # sink.insert_access_token(token_hash=token_hash, report_id=report_id, expires_at=expires_at)
    return plaintext  # never log or re-fetch
```

Schema already requires `expires_at NOT NULL`. `[VERIFIED: supabase/migrations/20260720_000001_foundation.sql]` Recommend **365-day TTL** (agent discretion) — no rotation in Phase 2.

### Pattern 3: Success page without token in URL (PUB-04 / D-11)

**What:** After analyze JSON returns, write a one-shot flash to `sessionStorage`, navigate to `/[locale]/report/success`, read+clear on mount.  
**When to use:** Always for plaintext token handoff.

```typescript
// Recommended pattern [ASSUMED: common SPA flash; avoid query strings]
const FLASH_KEY = "citymind:report-success";
sessionStorage.setItem(FLASH_KEY, JSON.stringify({ reportId, accessToken }));
router.push(`/${locale}/report/success`);
// success page: parse, removeItem, if missing → redirect to /report
```

Do **not** use `?access_token=` or hash fragments that get logged. Optional harder alternative: short-lived httpOnly cookie set by BFF — more moving parts; prefer sessionStorage for Phase 2.

### Pattern 4: Trusted client IP + BFF forward (DATA-08)

**What:** Public analyze is BFF-proxied; FastAPI must receive forwarded XFF. Cloud Run appends the connecting client IP; for rate limiting prefer the **rightmost** hop Google appends (spoof-resistant), not the leftmost client-supplied value. `[CITED: https://cloud.google.com/functions/docs/reference/headers]` `[CITED: adam-p.ca XFF guidance]` `[ASSUMED: Cloud Run behaves like Cloud Functions for XFF append]`

```python
# backend/app/security.py — recommended
def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]  # trusted append from platform [ASSUMED for direct Cloud Run]
    return request.client.host if request.client else "unknown"
```

```typescript
// frontend analyze BFF — required companion change
const headers = new Headers();
const xff = request.headers.get("x-forwarded-for");
const realIp = request.headers.get("x-real-ip");
if (xff) headers.set("x-forwarded-for", xff);
else if (realIp) headers.set("x-forwarded-for", realIp);
await fetch(backendEndpoint("/api/v1/reports/analyze"), { method: "POST", body: form, headers });
```

### Pattern 5: Dashboard gate in `proxy.ts` (AUTH-04 / D-15)

**What:** Compose next-intl handler with Supabase cookie client; authorize with **`getClaims()`** (not `getSession()` user object). `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` Redirect to `/login?returnUrl=<encoded path>`. Matcher: `/dashboard/:path*` (and locale variants if dashboard is under `[locale]`).

**Recommendation:** Keep `/login` and `/dashboard` **outside** `[locale]` for Phase 2 (officer UI not bilingual yet) while public pages use prefixes — simplifies AUTH-04 matchers and matches D-15 path literals. `[ASSUMED: acceptable vs full i18n of login]`

### Anti-Patterns to Avoid

- **Putting access token in the URL:** leaks via Referer, analytics, screenshots of address bar.
- **Trusting `Content-Type` alone:** DATA-09 requires magic bytes. `[VERIFIED: reports.py currently uses content_type only]`
- **Rate limiting on `request.client.host` only:** shared Cloud Run / BFF IP collapses all citizens. `[VERIFIED: security.py]`
- **Returning `f"failed: {exc}"` to clients:** DATA-10 / CONCERNS. `[VERIFIED: reports.py analyze except]`
- **Creating `middleware.ts` on Next 16:** use `proxy.ts`. `[CITED: nextjs.org]`
- **Building Phase 3 data table or Phase 4 `/status`:** deferred.
- **Using `getSession()` for authorization in proxy:** use `getClaims()`. `[CITED: Supabase SSR docs]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale routing / Accept-Language | Custom cookie+redirect maze | next-intl `createMiddleware` + `defineRouting` | Prefix, cookie, hreflang, matcher edge cases |
| Form validation wiring | Ad-hoc useState per field | RHF + Zod + shadcn Field/Controller | a11y error association, double-submit |
| Cookie SSR Auth | Custom HMAC session (`auth.ts` today) | `@supabase/ssr` | Phase 1 D-03; refresh + JWKS alignment |
| Image MIME sniff | Trust upload header / full Pillow decode | `filetype.guess` | Fast header-only; correct WebP/JPEG/PNG |
| Token RNG | `random` / uuid alone as secret | `secrets.token_urlsafe` | CSPRNG |
| Password hashing for tokens | bcrypt of token | SHA-256 of high-entropy token | Tokens are secrets already; lookup by hash |

**Key insight:** Most Phase 2 risk is **wiring** (BFF↔FastAPI headers, proxy composition, one-time token UX), not inventing new libraries.

## Common Pitfalls

### Pitfall 1: Rate limit keys on BFF/container IP
**What goes wrong:** One IP for all citizens; limit useless or shared.  
**Why:** Analyze goes Next → FastAPI; without XFF forward, FastAPI sees Next. `[VERIFIED: analyze/route.ts]`  
**How to avoid:** Forward XFF in BFF + parse trusted hop in FastAPI; add test with injected `X-Forwarded-For`.  
**Warning signs:** Local multi-user tests all share one bucket; production 429 storms.

### Pitfall 2: Token in query string
**What goes wrong:** Token in logs, browser history, Referer to third parties.  
**Why:** Convenient `router.push(/success?token=...)`.  
**How to avoid:** sessionStorage flash or short-lived cookie; UI-SPEC copy warns “shown once”.  
**Warning signs:** Success URL contains secrets; analytics capture query.

### Pitfall 3: Phase 1 no-prefix vs Phase 2 always-prefix clash
**What goes wrong:** Broken LocaleSwitcher, duplicate routes, `/report` 404s.  
**Why:** 01-04 planned no-prefix; D-13 locks prefixes.  
**How to avoid:** Day-1 routing migration task before copy polish; use `createNavigation` Link everywhere.  
**Warning signs:** Mixed `/report` and `/en/report` links.

### Pitfall 4: `expires_at` forgotten
**What goes wrong:** Insert fails NOT NULL constraint.  
**Why:** Migration requires `expires_at`. `[VERIFIED: migration SQL]`  
**How to avoid:** Always set TTL on insert; unit-test sink.  
**Warning signs:** 502 on analyze after Gemini success.

### Pitfall 5: Auth gate with wrong file / wrong matcher
**What goes wrong:** Dashboard public; or Home redirected to login (old proxy matcher `/`).  
**Why:** Current `proxy.ts` matches `/` and `/reports/*` with HMAC cookie. `[VERIFIED: frontend/src/proxy.ts]`  
**How to avoid:** Replace matcher with next-intl matcher + `/dashboard/:path*`; never protect public Home.  
**Warning signs:** Citizens bounced to login; officers reach dashboard logged out.

### Pitfall 6: Zod file schema vs FormData
**What goes wrong:** File field undefined or validation always fails.  
**Why:** RHF file inputs need `Controller` + `z.instanceof(File)` / custom refine for size/MIME.  
**How to avoid:** Follow shadcn RHF Controller pattern; build `FormData` manually in `onSubmit`. `[CITED: ui.shadcn.com/docs/forms/react-hook-form]`  
**Warning signs:** Submit blocked with opaque Zod errors; image never sent.

## Code Examples

### Magic-byte allowlist (DATA-09)

```python
# Source: https://github.com/h2non/filetype.py README
import filetype

ALLOWED = {"image/jpeg", "image/png", "image/webp"}

def sniff_image(image_bytes: bytes) -> str:
    kind = filetype.guess(image_bytes)
    if kind is None or kind.mime not in ALLOWED:
        raise HTTPException(415, "Only JPEG, PNG, or WebP images are accepted.")
    return kind.mime  # use sniffed MIME for storage/Gemini
```

### Generic errors (DATA-10)

```python
# Replace current pattern in reports.py analyze except [VERIFIED]
import logging
logger = logging.getLogger(__name__)

try:
    ...
except Exception:
    logger.exception("report_analysis_failed", extra={"report_id": report_id})
    raise HTTPException(502, "Report analysis failed. Please try again later.")
```

### RHF + Zod submit → FormData (PUB-03)

```typescript
// Source pattern: https://ui.shadcn.com/docs/forms/react-hook-form + multipart [ASSUMED glue]
const schema = z.object({
  description: z.string().max(3000),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  image: z
    .custom<File | undefined>()
    .refine((f) => !f || f.size <= 8 * 1024 * 1024, "Image too large")
    .refine(
      (f) => !f || ["image/jpeg", "image/png", "image/webp"].includes(f.type),
      "JPEG, PNG, or WebP only",
    ),
});

async function onSubmit(values: z.infer<typeof schema>) {
  const body = new FormData();
  body.set("description", values.description);
  if (values.latitude) body.set("latitude", values.latitude);
  if (values.longitude) body.set("longitude", values.longitude);
  if (values.image) body.set("image", values.image);
  // fetch analyze → flash → push success; disable while isSubmitting
}
```

### Login returnUrl (D-15)

```typescript
// [ASSUMED: standard pattern]
const returnUrl = searchParams.get("returnUrl") || "/dashboard";
// after signInWithPassword success:
redirect(returnUrl.startsWith("/") ? returnUrl : "/dashboard");
// proxy unauth:
const login = new URL("/login", request.url);
login.searchParams.set("returnUrl", pathname + search);
return NextResponse.redirect(login);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HMAC `citymind_officer_session` | Supabase Auth + `@supabase/ssr` | Phase 1 | Phase 2 completes login + proxy gate |
| next-intl no-prefix (Phase 1 plan) | `localePrefix: 'always'` `/en` `/vi` | Phase 2 D-13 | Route tree moves under `[locale]` |
| `middleware.ts` | `proxy.ts` on Next.js 16 | Next 16 | AUTH-04 wording ≠ filename |
| `request.client.host` rate limit | XFF trusted hop + BFF forward | Phase 2 | DATA-08 actually works on Cloud Run |
| Content-Type image check | `filetype` magic bytes | Phase 2 | DATA-09 |
| Inline form success text | `/report/success` + one-time token | Phase 2 D-11 | PUB-04 |
| `imghdr` stdlib | Removed 3.13+; use `filetype` | Python 3.13 | Env already on 3.14 locally `[VERIFIED: python3 --version]` |

**Deprecated/outdated:**
- Custom officer password env auth for production flows — replace with Supabase (Phase 1/2).
- Protecting `/` as officer home — public Home now; dashboard at `/dashboard` (D-17).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cloud Run appends client IP as **rightmost** XFF entry (same as Cloud Functions) | DATA-08 | Spoofable or wrong IP keyed — verify in staging with known client IP |
| A2 | `secrets.token_urlsafe(32)` + SHA-256 is sufficient (no bcrypt) | DATA-03 | Negligible if entropy holds; document in security review |
| A3 | 365-day `expires_at` TTL acceptable | D-18 discretion | Product may want shorter — easy config change |
| A4 | `/login` + `/dashboard` outside `[locale]` OK for Phase 2 | AUTH-04 | If product wants bilingual login, nest under locale and update matcher |
| A5 | sessionStorage flash is acceptable vs httpOnly cookie | PUB-04 | XSS could read token once — mitigate with CSP later; still better than URL |
| A6 | Zod 4 works with `@hookform/resolvers@5.4.0` as in shadcn examples | PUB-03 | Pin mismatch — run smoke form test in Wave 0 |
| A7 | Phase 1 will ship shadcn + supabase SSR helpers before/with Phase 2 Track B/C | Stack | Track B blocked if Phase 1 incomplete — check `components.json` / package.json |

**If wrong:** Prefer staging verification for A1; product confirm A3/A4.

## Open Questions (RESOLVED)

1. **Exact XFF hop index behind current deploy topology** — **RESOLVED**
   - What we know: Direct Cloud Run vs Firebase Hosting / extra LB changes which hop is trusted. `[CITED: StackOverflow Cloud Run XFF discussion]`
   - **Decision:** Key rate limits on the **rightmost** non-empty `X-Forwarded-For` hop by default (Cloud Run–appended client). Optionally honor `TRUSTED_PROXY_COUNT` (default `1`) to peel N rightmost hops when topology adds an extra LB — if unset, rightmost-only. Verify once in staging with a known client IP (hashed log).

2. **Dashboard under locale prefix?** — **RESOLVED**
   - What we know: D-15 paths are `/dashboard` and `/login` without locale.
   - **Decision:** `/login` and `/dashboard` (including `/dashboard/reports/*`) stay **outside** `[locale]`. Public Home/Report/success only under `/en` and `/vi`. Bilingual officer UI deferred.

3. **Phase 1 completion state on this machine** — **RESOLVED**
   - **Verified 2026-07-20 against live `frontend/package.json` + tree:** `next-intl@4.13.2`, `@supabase/ssr@0.12.3`, `@supabase/supabase-js`, `components.json`, `frontend/src/components/ui/*`, and `frontend/src/lib/supabase/{client,server}.ts` are present. HMAC `auth.ts` still present (Track C replaces). Backend JWT + Supabase sink exist.
   - **Still missing for Track B form:** `react-hook-form`, `zod`, `@hookform/resolvers` — install in Plan 02-04 after package checkpoint.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend | ✓ | v24.14.0 | Engines say 22+ — OK |
| npm | Frontend installs | ✓ | 11.9.0 | — |
| Python | Backend | ✓ | 3.14.5 (local) / 3.12 (Docker) | Pin Docker 3.12 for prod parity |
| pytest | Backend tests | ✓ | 8.4.1 | — |
| `filetype` package | DATA-09 | ✗ not installed | — | Add `filetype==1.2.0` in Plan 02-01 after SUS checkpoint |
| Supabase Cloud project | Auth + tokens | env-dependent | — | Block Track A/C without keys |
| `next-intl` | Track B i18n | ✓ | 4.13.2 | Phase 1 pin — no reinstall required |
| `@supabase/ssr` | Track C auth | ✓ | 0.12.3 | Phase 1 pin — no reinstall required |
| shadcn `components.json` + `ui/*` | Track B/C | ✓ | present | Add form/textarea/badge pieces if missing |
| `react-hook-form` / `zod` / `@hookform/resolvers` | Track B form | ✗ not in package.json | pins 7.82.0 / 4.4.3 / 5.4.0 | Install in Plan 02-04 after checkpoint |

**Missing dependencies with no fallback:**
- Supabase project credentials (if not configured) block AUTH + token persistence.

**Missing dependencies with fallback:**
- `filetype` — install in Plan 02-01 after human approval; temporary signature helper only if install blocked.
- RHF/zod/resolvers — install in Plan 02-04 after human approval.

## Validation Architecture

> `workflow.nyquist_validation` is **true** in `.planning/config.json`. `[VERIFIED: config.json]`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.4.1 (backend); frontend currently lint/build only |
| Config file | backend tests under `backend/tests/` (no jest/vitest detected) |
| Quick run command | `cd backend && pytest tests/test_security.py tests/test_analyze.py -q` |
| Full suite command | `cd backend && pytest -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-03 | Analyze returns plaintext token; DB stores only hash | unit/integration | `pytest tests/test_analyze.py -k token -x` | ❌ Wave 0 |
| DATA-08 | Different XFF → different rate-limit keys | unit | `pytest tests/test_security.py -k forwarded -x` | ❌ extend existing |
| DATA-09 | JPEG OK; text-as-image 415 | unit | `pytest tests/test_analyze.py -k magic -x` | ❌ Wave 0 |
| DATA-10 | Exception → generic detail, no raw exc | unit | `pytest tests/test_analyze.py -k generic_error -x` | ❌ Wave 0 |
| PUB-03 | Zod rejects oversize / bad MIME client-side | manual + optional node test | `node --test` if added | ❌ no FE tests |
| PUB-04 | Success page without query token | manual / Playwright later | — | ❌ |
| AUTH-04 | Unauth `/dashboard` → `/login?returnUrl=` | manual / node contract | Phase 1 officer-auth tests if present | ❌ verify |
| PUB-01/02/06 | Home bilingual + a11y smoke | manual | — | ❌ |

### Sampling Rate
- **Per task commit:** targeted pytest file(s) for touched backend req
- **Per wave merge:** `pytest -q`
- **Phase gate:** Full backend suite green + manual bilingual Home/Report/success + login gate checklist before `$gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_access_tokens.py` — DATA-03 hash-at-rest + once-return
- [ ] Extend `backend/tests/test_security.py` — XFF keying / spoof leftmost ignored
- [ ] Extend `backend/tests/test_analyze.py` — magic bytes + generic 502 message
- [ ] `frontend` smoke: optional `node --test` for Zod schema helpers
- [ ] Confirm Phase 1 frontend packages (`next-intl`, shadcn, `@supabase/ssr`) installed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth + `getClaims()` in proxy; FastAPI JWKS |
| V3 Session Management | yes | `@supabase/ssr` cookies; no custom HMAC |
| V4 Access Control | yes | Dashboard gate; RLS officer/admin; token hash lookup (Phase 4) |
| V5 Input Validation | yes | Zod client + Pydantic + filetype magic bytes |
| V6 Cryptography | yes | `secrets` + SHA-256 for tokens; no hand-rolled ciphers |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed X-Forwarded-For bypasses rate limit | DoS / Spoofing | Trust platform-appended hop; never leftmost alone |
| Token in URL / logs | Information Disclosure | sessionStorage flash; never log plaintext |
| Polyglot / fake Content-Type upload | Tampering | Magic-byte allowlist before storage/Gemini |
| Exception message leak | Information Disclosure | Generic client errors + server logs (DATA-10) |
| Unauthenticated dashboard | Elevation of Privilege | proxy.ts `getClaims()` + role check; FastAPI JWT |
| XSS reads sessionStorage token | Information Disclosure | Short display window; clear after read; later CSP |

## Sources

### Primary (HIGH confidence)
- `[CITED: https://next-intl.dev/docs/routing/setup]` — App Router locale routing, `proxy.ts` on Next 16
- `[CITED: https://next-intl.dev/docs/routing/configuration]` — `localePrefix: 'always'`, Accept-Language detection
- `[CITED: https://nextjs.org/docs/messages/middleware-to-proxy]` — middleware → proxy rename
- `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` — SSR clients, `getClaims()` vs `getSession()`
- `[CITED: https://ui.shadcn.com/docs/forms/react-hook-form]` — RHF + Zod + Controller
- `[CITED: https://github.com/h2non/filetype.py]` — magic-byte API
- `[CITED: https://cloud.google.com/functions/docs/reference/headers]` — X-Forwarded-For semantics
- `[VERIFIED: codebase]` — `ReportForm.tsx`, `security.py`, `reports.py`, `proxy.ts`, `access_tokens` migration, `AnalyzeResponse`

### Secondary (MEDIUM confidence)
- `[CITED: adam-p XFF perils]` — rightmost trusted hop for rate limiting
- Community Cloud Run XFF discussions — hop index topology-dependent

### Tertiary (LOW confidence)
- Exact production proxy count for CityMind deploy — validate in staging (Open Question 1 RESOLVED: rightmost + optional TRUSTED_PROXY_COUNT)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — versions verified via npm/PyPI; packages named in official docs
- Architecture: **HIGH** — codebase seams + locked CONTEXT; BFF XFF gap verified
- Pitfalls: **HIGH** — matches CONCERNS.md + live code
- Code examples: **MEDIUM–HIGH** — docs-backed patterns; flash/XFF hop marked assumed where needed

**Research date:** 2026-07-20  
**Valid until:** 2026-08-19 (30 days — Next 16 / next-intl moving)

---

*Phase: 02-public-experience*  
*Research completed: 2026-07-20*  
*Ready for planning: yes*  
*Agent label: gsd-phase-researcher (generic-agent workaround)*
