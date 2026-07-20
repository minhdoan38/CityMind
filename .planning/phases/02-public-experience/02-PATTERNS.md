# Phase 2: Public Experience - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 28 planned new/modified files
**Analogs found:** 26 / 28
**Research:** `.planning/phases/02-public-experience/02-RESEARCH.md`
**Context:** `.planning/phases/02-public-experience/02-CONTEXT.md`

## Scope Interpretation

Concrete implementation surface for Phase 2 Tracks A ∥ B ∥ C from CONTEXT + RESEARCH + ROADMAP plans `02-01` / `02-02` / `02-03`. Paths marked *inferred* follow RESEARCH recommended structure when not named verbatim upstream.

**In scope:** DATA-03/08/09/10, PUB-01/02/03/04/06, AUTH-04 (dashboard paths).  
**Out of scope:** Phase 4 `/status` lookup UI (link prep only), Phase 3 data table/filters/export/resolve notes, PostGIS/maps, contact mailer backend.

**Critical migrations vs Phase 1 scaffold:**
- `localePrefix: 'never'` → `'always'` + move public routes under `app/[locale]/`
- HMAC `citymind_officer_session` + password login → Supabase Auth + `getClaims()` in `proxy.ts`
- AUTH-04 file is **`proxy.ts`** (Next.js 16), not `middleware.ts`
- Keep `/login` and `/dashboard` **outside** `[locale]` (RESEARCH A4)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/services/tokens.py` | service | CRUD | none (new capability); insert style from `supabase.py` | no exact / role-match sink |
| `backend/app/schemas.py` | schema | transform | same file `AnalyzeResponse` | exact |
| `backend/app/api/reports.py` | controller | request-response | same file `analyze_report` | exact |
| `backend/app/security.py` | middleware | request-response | same file `enforce_report_rate_limit` | exact |
| `backend/app/services/supabase.py` | service | CRUD | same file `insert` | exact (add token row helper) |
| `backend/requirements.txt` | config | batch | same file | exact |
| `frontend/src/app/api/public/reports/analyze/route.ts` | route | request-response | same file | exact |
| `backend/tests/test_access_tokens.py` | test | CRUD | `backend/tests/test_security.py` / analyze tests | role-match |
| `backend/tests/test_security.py` | test | request-response | same file XFF/rate-limit cases | exact extend |
| `backend/tests/test_analyze.py` *(or extend `test_reports.py`)* | test | request-response | existing report controller tests | flow-match |
| `frontend/package.json` | config | batch | same file | exact |
| `frontend/src/i18n/routing.ts` | config | request-response | same file | exact seam |
| `frontend/src/i18n/navigation.ts` | utility | request-response | none; next-intl `createNavigation` | no analog |
| `frontend/src/i18n/request.ts` | config | request-response | same file | exact seam |
| `frontend/src/services/locale.ts` | service | transform | same file | exact (deprecate cookie-only switch) |
| `frontend/src/proxy.ts` | middleware | request-response | same file | exact seam, matcher+auth replaced |
| `frontend/messages/en.json` | config | transform | same file | exact |
| `frontend/messages/vi.json` | config | transform | `en.json` pair | paired |
| `frontend/src/app/[locale]/layout.tsx` | component | request-response | `frontend/src/app/layout.tsx` | role-match |
| `frontend/src/app/[locale]/page.tsx` | component | request-response | `frontend/src/app/page.tsx` | exact content upgrade |
| `frontend/src/app/[locale]/report/page.tsx` | component | request-response | `frontend/src/app/report/page.tsx` | exact move |
| `frontend/src/app/[locale]/report/success/page.tsx` | component | request-response | none; flash UX from RESEARCH | no analog |
| `frontend/src/components/ReportForm.tsx` | component | event-driven | same file | exact rebuild |
| `frontend/src/components/LocaleSwitcher.tsx` | component | event-driven | same file | exact (prefix navigation) |
| `frontend/src/lib/supabase/client.ts` | service | request-response | `frontend/src/lib/backend.ts` | role-match (Phase 1 gap) |
| `frontend/src/lib/supabase/server.ts` | service | request-response | `frontend/src/lib/auth.ts` | role-match (Phase 1 gap) |
| `frontend/src/lib/auth.ts` | service | request-response | same file | exact seam, replace HMAC |
| `frontend/src/lib/backend.ts` | service | request-response | same file | exact (Bearer JWT) |
| `frontend/src/app/login/page.tsx` | component | request-response | same file | exact |
| `frontend/src/app/api/session/login/route.ts` | route | request-response | same file | exact seam or retire |
| `frontend/src/app/dashboard/page.tsx` | component | request-response | same file (full filters → simple cards) | exact simplify |
| `frontend/src/app/dashboard/layout.tsx` | component | request-response | dashboard header in `dashboard/page.tsx` | role-match *inferred* |
| `frontend/src/app/dashboard/reports/[reportId]/page.tsx` | component | request-response | `frontend/src/app/reports/[reportId]/page.tsx` | exact move |
| `frontend/src/components/dashboard/ReportCard.tsx` | component | request-response | dashboard `<article>` cards + `ui/card.tsx` | flow-match |

## Pattern Assignments

### Track A — Token, XFF, magic bytes, generic errors

---

### `backend/app/services/tokens.py` (service, CRUD) — NEW

**Analogs:** No existing token issuer. Persist via `SupabaseReportSink` insert style (`backend/app/services/supabase.py` lines 34–78) and schema `access_tokens` (`supabase/migrations/20260720_000001_foundation.sql` lines 30–36).

**Issue-once pattern** (from RESEARCH Pattern 2):

```python
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

def issue_access_token(report_id: str, *, ttl_days: int = 365) -> tuple[str, str, datetime]:
    plaintext = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    return plaintext, token_hash, expires_at
```

**Required divergence:** Never log or re-fetch plaintext. Always set `expires_at` (NOT NULL). Store only `token_hash` + `report_id` + timestamps via service-role client. Return plaintext solely to `analyze_report` for the JSON response.

---

### `backend/app/schemas.py` (schema, transform)

**Analog:** same file lines 33–36.

```python
class AnalyzeResponse(BaseModel):
    report_id: str
    analysis: ReportAnalysis
    persisted: bool
```

**Required change:** add `access_token: str` (plaintext, response-only). Do not add hash fields to the public response model.

---

### `backend/app/api/reports.py` (controller, request-response)

**Analog:** `analyze_report` lines 52–113 — keep Form/File signature, rate-limit Depends, sink insert order.

**Current image validation (Content-Type only — replace for DATA-09):**

```65:78:backend/app/api/reports.py
    if image is not None:
        mime_type = image.content_type
        image_bytes = await image.read()

        if not image_bytes:
            image_bytes = None
            mime_type = None
        elif mime_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                415,
                f"Only JPEG, PNG, or WebP images are accepted. Received: {mime_type}",
            )
        elif len(image_bytes) > get_settings().max_image_bytes:
            raise HTTPException(413, "Image exceeds configured size limit")
```

**Magic-byte sniff (RESEARCH):**

```python
import filetype

ALLOWED = {"image/jpeg", "image/png", "image/webp"}

kind = filetype.guess(image_bytes)
if kind is None or kind.mime not in ALLOWED:
    raise HTTPException(415, "Only JPEG, PNG, or WebP images are accepted.")
mime_type = kind.mime  # sniffed MIME for storage/Gemini
```

**Current error leakage (replace for DATA-10):**

```106:113:backend/app/api/reports.py
    except Exception as exc:
        raise HTTPException(502, f"Report analysis failed: {exc}") from exc

    return AnalyzeResponse(
        report_id=report_id,
        analysis=analysis,
        persisted=persisted,
    )
```

**Required pattern:**

```python
import logging
logger = logging.getLogger(__name__)

try:
    # upload → context → gemini → sink.insert → issue_access_token → insert hash
    ...
except Exception:
    logger.exception("report_analysis_failed", extra={"report_id": report_id})
    raise HTTPException(502, "Report analysis failed. Please try again later.")

return AnalyzeResponse(
    report_id=report_id,
    analysis=analysis,
    persisted=persisted,
    access_token=plaintext,  # once
)
```

**Order:** insert report first, then access_tokens row (FK). Prefer same try-block so partial failure surfaces as generic 502.

---

### `backend/app/security.py` (middleware, request-response)

**Analog:** `enforce_report_rate_limit` lines 90–98 — keep SlidingWindowLimiter; change key source.

```90:98:backend/app/security.py
def enforce_report_rate_limit(request: Request) -> None:
    limit = get_settings().report_rate_limit_per_minute
    client = request.client.host if request.client else "unknown"
    if not report_limiter.allow(client, limit):
        raise HTTPException(
            429,
            "Report submission rate limit exceeded",
            headers={"Retry-After": "60"},
        )
```

**Trusted IP (DATA-08 / RESEARCH Pattern 4):**

```python
def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]  # platform-appended hop; not leftmost
    return request.client.host if request.client else "unknown"
```

Wire `enforce_report_rate_limit` to `client_ip(request)`. Optional env `TRUSTED_PROXY_COUNT` later if topology differs (Open Question 1).

---

### `backend/app/services/supabase.py` (service, CRUD)

**Analog:** `insert` lines 34–78 — fluent `client.table(...).insert(row).execute()`.

Add `insert_access_token(token_hash, report_id, expires_at)` using service-role `get_client()` (no caller JWT). Table `access_tokens`; columns match migration.

```30:36:supabase/migrations/20260720_000001_foundation.sql
CREATE TABLE IF NOT EXISTS public.access_tokens (
    token_hash TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);
```

---

### `frontend/src/app/api/public/reports/analyze/route.ts` (route, request-response)

**Analog:** same file — FormData proxy body preserved; **must forward XFF**.

```1:13:frontend/src/app/api/public/reports/analyze/route.ts
import { backendEndpoint } from "@/lib/backend";

export async function POST(request: Request) {
  const form = await request.formData();
  const response = await fetch(backendEndpoint("/api/v1/reports/analyze"), {
    method: "POST",
    body: form,
  });
  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
```

**Required companion (DATA-08):**

```typescript
const headers = new Headers();
const xff = request.headers.get("x-forwarded-for");
const realIp = request.headers.get("x-real-ip");
if (xff) headers.set("x-forwarded-for", xff);
else if (realIp) headers.set("x-forwarded-for", realIp);
await fetch(backendEndpoint("/api/v1/reports/analyze"), {
  method: "POST",
  body: form,
  headers,
});
```

Without this, FastAPI keys rate limits on the BFF container IP.

---

### Backend tests (test, request-response / CRUD)

**Analogs:**
- Rate limit: `backend/tests/test_security.py` lines 148–172 (`SlidingWindowLimiter`, 429 + Retry-After)
- Controller isolation: Phase 1 patterns + existing `test_reports` monkeypatch of `get_sink`

**Wave 0 gaps (from RESEARCH):**
- `test_access_tokens.py` — plaintext in response; DB/sink receives only hash; `expires_at` set
- Extend `test_security.py` — different XFF → different keys; leftmost spoof ignored when using rightmost
- Analyze tests — JPEG magic OK; text-as-image → 415; exception → generic 502 detail (no `str(exc)`)

Reuse:

```148:172:backend/tests/test_security.py
def test_sliding_window_limiter_resets_after_window() -> None:
    limiter = security.SlidingWindowLimiter()
    assert limiter.allow("client", limit=2, now=100) is True
    ...

def test_report_endpoint_returns_429_after_limit(monkeypatch) -> None:
    ...
    assert second.status_code == 429
    assert second.headers["retry-after"] == "60"
```

---

### Track B — Bilingual Home / Report / success

---

### `frontend/src/i18n/routing.ts` + `navigation.ts` + `request.ts`

**Analog:** current no-prefix scaffold:

```1:7:frontend/src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "vi"],
  defaultLocale: "en",
  localePrefix: "never",
});
```

**Required (D-13 / PUB-02):** `localePrefix: 'always'`. Add `frontend/src/i18n/navigation.ts` via `createNavigation(routing)` for locale-aware `Link` / `useRouter` / `redirect`.

**Current request config (cookie locale — migrate):**

```1:10:frontend/src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { getUserLocale } from '../services/locale';

export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
```

**Required:** use `requestLocale` / `[locale]` segment per next-intl App Router docs; Accept-Language detection via middleware (D-14). `services/locale.ts` cookie switcher becomes secondary or removed once URL prefixes own locale.

---

### `frontend/src/proxy.ts` (middleware, request-response) — shared Track B+C

**Current HMAC gate on wrong paths:**

```1:14:frontend/src/proxy.ts
import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "citymind_officer_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/reports/:path*"],
};
```

**Required composition (RESEARCH Patterns 1 + 5):**
1. next-intl middleware from `routing` (locale negotiation + prefixes)
2. For `/dashboard/:path*` only: `@supabase/ssr` cookie client + **`getClaims()`** (not `getSession()`)
3. Unauth → `/login?returnUrl=<encoded path>` (D-15)
4. **Never** protect public Home / `[locale]` report routes (D-17)

On Next.js 16 keep filename `proxy.ts` (do not create deprecated `middleware.ts`).

---

### `frontend/messages/{en,vi}.json` (config, transform)

**Analog:** Phase 1 scaffold keys under `public`, `navigation`, `locale`:

```1:8:frontend/messages/en.json
{
  "public": {
    "title": "CityMind AI",
    "subtitle": "AI-assisted Decision Intelligence Platform for Smart Communities",
    "reportCTA": "Report an issue",
    "description": "...",
    "footer": "© 2026 CityMind AI. All rights reserved."
  },
```

**Required namespaces:** expand Home sections (howItWorks, instructions steps, about, contact, hero disclaimer), Report form (labels, helpers, analyzing state, Zod messages), Success (token once warning, copy labels, status-link prep), keep login/dashboard strings. Mirror all keys in `vi.json`.

---

### `frontend/src/app/[locale]/page.tsx` (component, request-response)

**Analog:** current Home shell:

```9:50:frontend/src/app/page.tsx
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="...">
        ...
        <Link href="/login" ...>{nav("login")}</Link>
        <LocaleSwitcher />
      </header>
      <main className="...">
        <h1>{t("title")}</h1>
        ...
        <Link href="/report" ...>{t("reportCTA")}</Link>
      </main>
      <footer>...</footer>
    </div>
  );
```

**Preserve:** brand-first title, primary CTA → report, subtle officer login link, LocaleSwitcher, light theme tokens (`bg-background`).  
**Upgrade per D-01–D-08:** full-bleed civic hero + AI advisory supporting line in hero; section order How it works → Instructions (3–5 steps) → About → Contact (static mailto / coming soon) → Footer; use `createNavigation` Links to `/report` under locale. Relocate file under `[locale]/`; remove or redirect old unprefixed `app/page.tsx`.

---

### `frontend/src/app/[locale]/report/page.tsx` + `ReportForm.tsx`

**Page analog:**

```4:18:frontend/src/app/report/page.tsx
export default function PublicReportPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      ...
        <ReportForm />
```

**Form analog — keep geolocation + FormData POST + double-submit disable; replace useState validation with RHF+Zod; on success navigate to success flash (not inline success):**

```43:72:frontend/src/components/ReportForm.tsx
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setLoading(true);
    ...
      const res = await fetch("/api/public/reports/analyze", {
        method: "POST",
        body: form,
      });
      ...
      const body = await res.json();
      formEl.reset();
      setSuccess(`Report submitted: ${body.report_id}`);
      router.refresh();
```

**Geolocation helper to preserve:**

```16:40:frontend/src/components/ReportForm.tsx
  function useMyLocation() {
    ...
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
```

**RHF+Zod submit glue (RESEARCH / PUB-03):**
- Schema: description max 3000; lat/lng optional; image optional with size ≤ `max_image_bytes` (8MB) and MIME jpeg/png/webp refine
- Location optional but encouraged (D-09) — helper copy, not required
- `isSubmitting` disables button; copy “Analyzing your report…” (D-12)
- Build `FormData` manually in `onSubmit`; POST same BFF path
- On OK: `sessionStorage` flash `{ reportId, accessToken }` → `router.push(\`/${locale}/report/success\`)` — **no query token** (D-11, PUB-04)
- Restyle with shadcn Input/Textarea/Button/Label; civic light UI (not slate-950 dashboard chrome)

**Install:** `react-hook-form@7.82.0`, `zod@4.4.3`, `@hookform/resolvers@5.4.0` + shadcn `form`/`textarea` as needed (`package.json` currently lacks RHF/zod).

---

### `frontend/src/app/[locale]/report/success/page.tsx` (component) — NEW

**Analog:** none in repo. Pattern from RESEARCH Pattern 3.

```typescript
const FLASH_KEY = "citymind:report-success";
// mount: parse sessionStorage, removeItem immediately
// missing → redirect to /[locale]/report
// show report_id + access_token once; copy buttons; aria-live
// status link prep: `/[locale]/status?token=...` or documented Phase 4 path — copyable, page itself deferred
```

Anti-pattern: `?access_token=` in URL.

---

### `frontend/src/components/LocaleSwitcher.tsx`

**Analog:** cookie `setUserLocale` + dropdown (lines 15–52).  
**Required:** switch via next-intl navigation (`usePathname` + `useRouter` from `i18n/navigation`) to same path under other locale prefix. Keep shadcn DropdownMenu + min-h-11 touch targets (PUB-06).

---

### Track C — Supabase Auth + dashboard cards

---

### `frontend/src/lib/supabase/{client,server}.ts` (service) — NEW (Phase 1 gap)

**Analogs:** `backend.ts` for server-only fetch boundary; `auth.ts` for cookie access.

```1:4:frontend/src/lib/backend.ts
import "server-only";
```

```66:75:frontend/src/lib/auth.ts
export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireOfficerSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
```

Implement `@supabase/ssr` `createBrowserClient` / `createServerClient` with cookie get/set/remove per Supabase Next.js docs. Packages already in `package.json` (`@supabase/ssr@0.12.3`). Replace HMAC helpers in `auth.ts`; `requireOfficerSession` should use claims/role from Supabase session.

---

### `frontend/src/app/login/page.tsx` + session login route

**Current password form → HMAC cookie:**

```15:28:frontend/src/app/login/page.tsx
        <form action="/api/session/login" method="post" className="mt-6">
          <label className="grid gap-2 text-sm text-slate-300">
            Access password
            <input name="password" type="password" required ... />
```

```11:30:frontend/src/app/api/session/login/route.ts
export async function POST(request: Request) {
  ...
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });
  response.cookies.set(SESSION_COOKIE, createSessionToken(role), sessionCookieOptions);
```

**Required (AUTH-04 / D-15):** email+password via `signInWithPassword`; honor `returnUrl` query (default `/dashboard`); redirect only to same-origin paths starting with `/`. Retire quick-access password path for production flow. Messages already sketched in `en.json` `login.*` (email/password). Keep login **outside** `[locale]`.

---

### `frontend/src/lib/backend.ts` — Bearer JWT

**Current API-key header (replace):**

```16:21:frontend/src/lib/backend.ts
export function officerFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const key = process.env.OFFICER_API_KEY;
  if (key) headers.set("X-CityMind-Officer-Key", key);
  return fetch(backendEndpoint(path), { ...init, headers });
}
```

**Required:** forward officer access token as `Authorization: Bearer <jwt>` from Supabase server session (aligns with Phase 1 FastAPI `require_officer`). Keep `backendEndpoint` helper.

---

### `frontend/src/app/dashboard/page.tsx` + `ReportCard.tsx`

**Analog:** existing dashboard list articles (D-16 = simplify, not Phase 3 table):

```222:265:frontend/src/app/dashboard/page.tsx
        <div className="mt-6 grid gap-4">
          {reports.map((report) => (
            <article key={report.report_id} className="rounded-xl border border-slate-800 bg-slate-900 p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-xl font-semibold capitalize">
                  {report.category || "Uncategorized"}
                </h2>
                <span ...>Priority: {report.priority}</span>
                <span ...>Status: {report.status ?? "new"}</span>
              </div>
              <p className="mt-3 text-slate-300">{report.summary}</p>
              ...
                <Link href={`/reports/${report.report_id}`} ...>
                  View detail
                </Link>
```

**Preserve:** `officerFetch` → `/api/v1/reports/recent`, category/priority/status/summary fields, link to detail.  
**Simplify for Phase 2:** drop summary KPI strip + advanced filter form (or keep optional minimal query params per agent discretion); extract `ReportCard` using shadcn `Card`; link to `/dashboard/reports/[reportId]`.  
**Move detail:** `app/reports/[reportId]/page.tsx` → `app/dashboard/reports/[reportId]/page.tsx` so proxy matcher covers it.

---

## Cross-Cutting Wiring Checklist

| Seam | From | To | Pattern |
|------|------|----|---------|
| Analyze response | FastAPI `access_token` | ReportForm flash | JSON field once; never URL |
| Rate limit IP | Browser → BFF | FastAPI | Forward XFF; key rightmost hop |
| Image trust | Client Zod MIME | FastAPI `filetype` | Server authoritative |
| Locale | Accept-Language / switcher | `/en|vi/...` | `localePrefix: 'always'` |
| Auth gate | Unauth `/dashboard` | `/login?returnUrl=` | `proxy.ts` + `getClaims()` |
| Officer API | Dashboard RSC | FastAPI `/recent` | Bearer JWT via `officerFetch` |

## Anti-Patterns (do not copy from MVP)

| Current code | Why wrong for Phase 2 |
|--------------|----------------------|
| Inline `setSuccess(report_id)` on form | D-11 requires dedicated success + token |
| `request.client.host` only for rate limit | Collapses to BFF IP on Cloud Run |
| `image.content_type` alone | DATA-09 magic bytes |
| `f"Report analysis failed: {exc}"` | DATA-10 leakage |
| `proxy` matcher `/reports/*` + HMAC cookie | Wrong paths; wrong auth |
| `localePrefix: 'never'` | Contradicts D-13 |
| Token in `?token=` query | Referer/history/log leak |
| Phase 3 filters/KPI grid as Phase 2 “done” | D-16 simple cards only |

## No-Analog Notes

1. **`backend/app/services/tokens.py`** — new module; copy hash/insert conventions from `supabase.py` + migration DDL only.
2. **`report/success` page** — new route; sessionStorage flash has no prior CityMind UI; follow RESEARCH Pattern 3.
3. **`i18n/navigation.ts`** — generated from next-intl docs; no local precursor.

## Downstream Planning Hints

- **Wave 0:** install frontend RHF/zod/resolvers + backend `filetype==1.2.0`; confirm Supabase SSR helpers exist before Track C polish.
- **Day-1 sync:** `AnalyzeResponse.access_token` + BFF XFF + `[locale]` route move before marketing copy polish.
- **AUTH-04 wording:** plans should say `proxy.ts`, matcher `/dashboard/:path*`, not protect `/`.
- **Nyquist:** extend `test_security.py` / add `test_access_tokens.py` before claiming DATA-03/08/09/10 done.

---

*Phase: 02-public-experience*  
*Pattern map completed: 2026-07-20*  
*Agent label: gsd-pattern-mapper (generic-agent workaround)*
