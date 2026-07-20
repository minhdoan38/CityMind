# Phase 4: Citizen Status - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 14
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/app/api/public/reports/status/route.ts` | route (BFF) | request-response | `frontend/src/app/api/public/reports/analyze/route.ts` | exact |
| `backend/app/api/reports.py` (+ `POST /status`) | controller | request-response | `backend/app/api/reports.py` (`analyze_report`) | exact |
| `backend/app/schemas.py` (+ citizen DTOs) | model | transform | `backend/app/schemas.py` (`AnalyzeResponse`) | exact |
| `backend/app/security.py` (+ status limiter) | middleware | request-response | `backend/app/security.py` (`enforce_report_rate_limit`) | exact |
| `backend/app/config.py` (+ `status_rate_limit_per_minute`) | config | — | `backend/app/config.py` (`report_rate_limit_per_minute`) | exact |
| `backend/app/services/tokens.py` (+ verify/hash) | utility | transform | `backend/app/services/tokens.py` (`issue_access_token`) | role-match |
| `backend/app/services/supabase.py` (+ token lookup / citizen projection) | service | CRUD | `backend/app/services/supabase.py` (`insert_access_token` + `status_history`) | role-match |
| `frontend/src/app/[locale]/status/page.tsx` | component | request-response | `frontend/src/app/[locale]/report/success/page.tsx` + `ReportForm.tsx` | role-match |
| `frontend/src/app/status/page.tsx` | route | request-response | `frontend/src/app/report/page.tsx` | exact |
| `frontend/src/components/CopyStatusLink.tsx` | component | request-response | `frontend/src/app/[locale]/report/success/page.tsx` (clipboard) | exact |
| `frontend/src/app/dashboard/reports/[reportId]/page.tsx` | component | request-response | same file (header/meta placement) | exact |
| `frontend/src/app/[locale]/report/success/page.tsx` (locale URL fix) | component | — | same file (`statusPrepValue`) | exact |
| `frontend/messages/{en,vi}.json` | config | — | existing `public.*` / `dashboard.*` keys | exact |
| `backend/tests/test_citizen_status.py` | test | request-response | `backend/tests/test_security.py` + `test_access_tokens.py` + `test_reports.py` | role-match |
| `frontend/tests/citizen-status.test.mjs` | test | — | `frontend/tests/public-shell.test.mjs` | exact |

## Pattern Assignments

### `frontend/src/app/api/public/reports/status/route.ts` (route, request-response)

**Analog:** `frontend/src/app/api/public/reports/analyze/route.ts`

**Imports / XFF forward + proxy pattern** (lines 1–26):
```typescript
import { backendEndpoint } from "@/lib/backend";

export async function POST(request: Request) {
  const headers = new Headers();
  const xff = request.headers.get("x-forwarded-for");
  const xrip = request.headers.get("x-real-ip");

  if (xff) {
    headers.set("X-Forwarded-For", xff);
  } else if (xrip) {
    headers.set("X-Forwarded-For", xrip);
  }

  const response = await fetch(backendEndpoint("/api/v1/reports/analyze"), {
    method: "POST",
    body: form,
    headers: headers,
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
```

**Adapt for status:**
- Parse JSON body `{ report_id, token }` (not FormData).
- Set `Content-Type: application/json` on outbound headers.
- Target `backendEndpoint("/api/v1/reports/status")`.
- Preserve status + body passthrough (including 401/429 + `Retry-After`).

---

### `backend/app/api/reports.py` — `POST /status` (controller, request-response)

**Analog:** `analyze_report` (public + rate-limit Depends) and officer history (DTO shape — do **not** copy 404 existence leak).

**Public endpoint + rate-limit Depends** (lines 55–62):
```python
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_report(
    description: str = Form(default="", max_length=3000),
    ...
    _rate_limit: None = Depends(enforce_report_rate_limit),
) -> AnalyzeResponse:
```

**Officer history return shape** (lines 222–231) — copy structure, strip fields:
```python
@router.get("/{report_id}/status-history")
async def report_status_history(
    report_id: str, officer: OfficerPrincipal = Depends(require_officer)
):
    ...
    items = sink.status_history(report_id, caller_token=officer.token)
    return {"items": items, "count": len(items)}
```

**Anti-pattern to avoid** (lines 239–246):
```python
# Officer get_report returns 404 — MUST NOT use for citizen verify (CIT-03)
if not report:
    raise HTTPException(404, "Report not found")
```

**Core pattern for Phase 4:**
```python
@router.post("/status", response_model=CitizenStatusResponse)
async def citizen_report_status(
    body: CitizenStatusRequest,
    _rate_limit: None = Depends(enforce_status_rate_limit),
) -> CitizenStatusResponse:
    # 1) hash token; 2) lookup by token_hash; 3) compare_digest report_id;
    # 4) check expires_at; ANY failure → same HTTPException(401, generic)
    # 5) load report status + summary + history projection (no actor_id)
```

**Generic error wrapping** (analyze lines 115–117):
```python
except Exception as exc:
    logging.exception("Report analysis failed")
    raise HTTPException(502, "Report analysis failed") from exc
```
Use a generic 502 only for unexpected sink failures — never distinguish missing vs invalid token.

---

### `backend/app/schemas.py` — citizen DTOs (model, transform)

**Analog:** `AnalyzeResponse` / `ReportAnalysis` Field constraints (lines 21–37):

```python
class ReportAnalysis(BaseModel):
    summary: str = Field(min_length=5, max_length=500)
    ...

class AnalyzeResponse(BaseModel):
    report_id: str
    analysis: ReportAnalysis
    persisted: bool
    access_token: str | None = None
```

**Copy for Phase 4 (CIT-02 allowlist only):**
```python
class CitizenStatusHistoryItem(BaseModel):
    status: str
    note: str | None = None
    created_at: str

class CitizenStatusResponse(BaseModel):
    status: str
    summary: str | None = None
    history: list[CitizenStatusHistoryItem]

class CitizenStatusRequest(BaseModel):
    report_id: str = Field(min_length=1, max_length=64)
    token: str = Field(min_length=1, max_length=128)
```

Never include `recommendation`, `evidence`, `actor_id`, `confidence`, `severity`.

---

### `backend/app/security.py` — status rate limit (middleware, request-response)

**Analog:** `SlidingWindowLimiter` + `client_ip` + `enforce_report_rate_limit` (lines 23–44, 105–133):

```python
report_limiter = SlidingWindowLimiter()

def client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        if hops:
            count = get_settings().trusted_proxy_count
            ...
            return hops[-count]
    return request.client.host if request.client else "unknown"

def enforce_report_rate_limit(request: Request) -> None:
    limit = get_settings().report_rate_limit_per_minute
    if not report_limiter.allow(client_ip(request), limit):
        raise HTTPException(
            429,
            "Report submission rate limit exceeded",
            headers={"Retry-After": "60"},
        )
```

**Adapt:** New `status_limiter = SlidingWindowLimiter()` instance; key as `f"status:{client_ip(request)}"` (do **not** share `report_limiter` deque). Read `status_rate_limit_per_minute` from settings. Same `Retry-After: 60` header.

---

### `backend/app/config.py` — status limit setting (config)

**Analog:** lines 16–18:

```python
report_rate_limit_per_minute: int = 0
# Peel N rightmost X-Forwarded-For hops for rate-limit keying (default: rightmost).
trusted_proxy_count: int = 1
```

**Add:** `status_rate_limit_per_minute: int = 0` (disabled locally; prod docs recommend ~30). Env: `STATUS_RATE_LIMIT_PER_MINUTE`.

---

### `backend/app/services/tokens.py` — verify helpers (utility, transform)

**Analog:** hash issuance (lines 1–11):

```python
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

def issue_access_token(ttl_days: int = 365) -> tuple[str, str, datetime]:
    plaintext = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plaintext.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    return plaintext, token_hash, expires_at
```

**Extend (do not invent new crypto):**
```python
def hash_access_token(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()

def token_binds_report(row: dict | None, report_id: str, now: datetime | None = None) -> bool:
    if row is None:
        return False
    # parse expires_at; if expired → False
    return secrets.compare_digest(row["report_id"], report_id)
```

Reuse `hashlib.sha256(...).hexdigest()` exactly as issuance; use stdlib `secrets.compare_digest` for report_id binding.

---

### `backend/app/services/supabase.py` — token lookup + citizen projection (service, CRUD)

**Analog A — insert (hash-only persistence)** (lines 440–453):
```python
def insert_access_token(
    self, report_id: str, token_hash: str, expires_at: datetime
) -> bool:
    row = {
        "token_hash": token_hash,
        "report_id": report_id,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    client = self.get_client()
    client.table("access_tokens").insert(row).execute()
    return True
```

**Analog B — officer history (strip for citizen)** (lines 425–438):
```python
def status_history(
    self, report_id: str, caller_token: str | None = None
) -> list[dict]:
    response = (
        client.table("status_events")
        .select("status, note, actor_id, created_at")  # officer includes actor_id
        .eq("report_id", report_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data
```

**Adapt:**
- `get_access_token_by_hash(token_hash)` → `.table("access_tokens").select(...).eq("token_hash", token_hash)` via **service role** (`get_client()` with no caller JWT).
- Citizen history: select only `status, note, created_at` OR map rows and drop `actor_id` before return.
- Prefer token_hash PK lookup first (not report_id-first) to reduce ID enumeration.

---

### `frontend/src/app/[locale]/status/page.tsx` (component, request-response)

**Analog A — public civic chrome:** `frontend/src/app/[locale]/report/page.tsx` (lines 12–41) and success page header/footer.

```tsx
<div className="flex min-h-screen flex-col bg-background text-foreground">
  <header className="w-full border-b border-border bg-background">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <Link href="/" className="... text-primary ...">{t("title")}</Link>
      <LocaleSwitcher />
    </div>
  </header>
  <main className="mx-auto flex w-full max-w-xl flex-grow flex-col justify-center px-6 py-12">
    ...
  </main>
  <footer className="w-full border-t border-border bg-muted/40 py-6 text-center text-sm text-muted-foreground">
    <p>{t("footer")}</p>
  </footer>
</div>
```

**Analog B — form + fetch + Alert errors:** `frontend/src/components/ReportForm.tsx`

**Imports pattern** (lines 1–21):
```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
```

**Fetch + error branch** (lines 122–135) — adapt to map status codes to catalog keys:
```tsx
const res = await fetch("/api/public/reports/analyze", {
  method: "POST",
  body: formData,
});
if (!res.ok) {
  const body = await res.json().catch(() => null);
  setError(
    typeof body?.detail === "string"
      ? body.detail
      : t("formErrorNetwork"),
  );
  return;
}
```

**Phase 4 client error mapping (UI-SPEC):**
- `401` → `t("statusVerifyFailed")` only (ignore distinct `detail` strings)
- `429` → `t("statusRateLimited")`
- network/5xx → `t("statusNetworkError")`

**Deep-link auto-fetch (D-01/D-02):** `useSearchParams()` for `reportId` + `token`; one-shot `useEffect` fetch when both non-empty trimmed; keep fields editable.

Prefer **client component** page (or thin RSC shell + client form) so token stays out of RSC data fetches — mirror success page `"use client"` style for interactive bits.

---

### `frontend/src/app/status/page.tsx` (route, request-response)

**Analog:** `frontend/src/app/report/page.tsx` (entire file):

```tsx
import { redirect } from "next/navigation";

/** Unprefixed /report bypasses locale prefixes — send citizens to default locale. */
export default function PublicReportRedirectPage() {
  redirect("/en/report");
}
```

**Adapt:** `redirect("/en/status")` — query params are preserved by Next redirect of same search string when using `redirect` with full URL if needed; prefer reading `searchParams` and appending `?reportId=&token=` so deep links survive locale bounce.

---

### `frontend/src/components/CopyStatusLink.tsx` (component, request-response)

**Analog:** success-page clipboard + live region (`success/page.tsx` lines 59–79, 197–204):

```tsx
async function copyText(value: string, which: "id" | "token" | "status") {
  try {
    await navigator.clipboard.writeText(value);
    setLiveMessage(t("copied"));
    // icon swap Check for 2s
    setTimeout(() => setCopiedStatus(false), 2000);
  } catch {
    setLiveMessage("");
  }
}

<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {liveMessage}
</div>
```

**Adapt for DASH-08 / D-14a:**
```tsx
const locale = "en"; // dashboard unlocalized today
const url = `${window.location.origin}/${locale}/status?reportId=${encodeURIComponent(reportId)}`;
// NO token in URL
await navigator.clipboard.writeText(url);
setLiveMessage(t("statusLinkCopied")); // dashboard.* catalog
```

Use lucide `Copy` / `Check`, `Button variant="outline"`, min 44×44 hit target — same as success. Show muted recovery hint (`statusLinkRecoveryHint`) always visible under control.

**Placement analog:** `frontend/src/app/dashboard/reports/[reportId]/page.tsx` header (lines 141–154) — insert control near report id / status badge, not only beside `StatusActions`.

---

### `frontend/src/app/[locale]/report/success/page.tsx` — locale URL fix

**Current anti-pattern** (lines 55–57):
```tsx
const statusPrepValue = flash
  ? `/status?reportId=${encodeURIComponent(flash.reportId)}&token=${encodeURIComponent(flash.accessToken)}`
  : "";
```

**Fix pattern:** use `useLocale()` from `next-intl` (or locale from route) → `` `/${locale}/status?reportId=...&token=...` ``. Update catalog `statusLinkPrep` copy from “coming soon” to UI-SPEC live wording.

---

### `frontend/messages/{en,vi}.json` (config)

**Analog:** existing `public` keys (`statusLinkPrep`, `copied`, `reportIdLabel`, `accessTokenLabel`) and `dashboard` namespace.

**Add under `public`:** `statusHeading`, `statusBody`, `checkStatus`, `statusChecking`, `statusPrivacyNote`, `statusEmptyHeading`, `statusEmptyBody`, `statusHistoryEmpty`, `statusHistoryHeading`, `statusCurrentLabel`, `statusSummaryLabel`, `statusVerifyFailed`, `statusRateLimited`, `statusNetworkError`; update `statusLinkPrep`.

**Add under `dashboard`:** `copyStatusLink`, `statusLinkCopied`, `statusLinkRecoveryHint`.

Keep EN/VI key trees identical (enforced by `public-shell.test.mjs` walkKeys pattern).

---

### `backend/tests/test_citizen_status.py` (test, request-response)

**Analog A — rate limit 429 + Retry-After:** `backend/tests/test_security.py` lines 205–220:

```python
def test_report_endpoint_returns_429_after_limit(monkeypatch) -> None:
    monkeypatch.setattr(
        security,
        "get_settings",
        lambda: security_settings(limit=1),
    )
    security.report_limiter.clear()
    ...
    assert second.status_code == 429
    assert second.headers["retry-after"] == "60"
```

**Analog B — XFF keying:** `test_xff_rate_limiter_uses_rightmost_hop` (lines 234–265) — assert limiter key uses forwarded hop; for status assert key prefix `status:`.

**Analog C — hash-at-rest:** `backend/tests/test_access_tokens.py` lines 9–15:

```python
plaintext, token_hash, expires_at = issue_access_token()
assert token_hash == hashlib.sha256(plaintext.encode()).hexdigest()
assert token_hash != plaintext
```

**Analog D — API monkeypatch + TestClient:** `backend/tests/test_reports.py` status_history tests (lines 189–206).

**Required Phase 4 cases (Wave 0):**
1. DTO strips `actor_id` / recommendation / evidence
2. Wrong token / wrong id / expired / missing → **same** 401 + same detail
3. `compare_digest` binding fails closed on report_id mismatch
4. Over-limit → 429 + Retry-After; separate limiter from analyze

---

### `frontend/tests/citizen-status.test.mjs` (test)

**Analog:** `frontend/tests/public-shell.test.mjs` — filesystem + catalog asserts:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('EN/VI catalogs share identical key trees', () => {
  const en = JSON.parse(read(path.join(messagesDir, 'en.json')));
  const vi = JSON.parse(read(path.join(messagesDir, 'vi.json')));
  assert.deepEqual(walkKeys(en), walkKeys(vi));
});

test('unprefixed public pages redirect into locale prefixes', () => {
  const reportPage = read(src('app', 'report', 'page.tsx'));
  assert.match(reportPage, /redirect\(['"]\/en\/report['"]\)/);
});
```

**Adapt asserts:**
- `src/app/[locale]/status/page.tsx` exists
- `src/app/status/page.tsx` redirects to `/en/status`
- `src/app/api/public/reports/status/route.ts` exists and forwards `X-Forwarded-For`
- Catalog keys `public.statusHeading`, `public.statusVerifyFailed`, `dashboard.copyStatusLink`, etc.
- Success page builds locale-prefixed `/status?reportId=` (no bare `/status?`)
- CopyStatusLink / detail page builds reportId-only URL (no `token=`)

## Shared Patterns

### Public BFF + XFF forward
**Source:** `frontend/src/app/api/public/reports/analyze/route.ts`  
**Apply to:** Status BFF route  
Copy XFF / X-Real-Ip peel verbatim so Cloud Run rate limits citizen IP, not BFF egress.

### Rate limiting
**Source:** `backend/app/security.py` (`SlidingWindowLimiter`, `client_ip`, `enforce_report_rate_limit`)  
**Apply to:** Status endpoint via new `enforce_status_rate_limit` + separate limiter instance + settings key.

### Token hashing
**Source:** `backend/app/services/tokens.py` + `test_access_tokens.py`  
**Apply to:** Verify path — SHA-256 hexdigest only; never store or log plaintext; never echo token in error bodies.

### Uniform security failures (CIT-03)
**Source:** CONTEXT/RESEARCH (no officer 404 analog)  
**Apply to:** All verify failure branches  
Single `HTTPException(401, "...")` detail for missing row, expired, report_id mismatch, empty token. UI maps only status code → one catalog string.

### Public civic chrome
**Source:** `[locale]/report/page.tsx`, `[locale]/report/success/page.tsx`  
**Apply to:** `/[locale]/status`  
Sticky header + brand Link + LocaleSwitcher + `max-w-xl` main + quiet footer; Clinic Blue primary; no marketing hero.

### Clipboard + live region
**Source:** `success/page.tsx` `copyText` + `role="status"` `aria-live`  
**Apply to:** Officer `CopyStatusLink` and any status-page copy affordances  
No new toast library (`sonner` optional only if live-region insufficient — UI-SPEC prefers reuse).

### Locale prefix redirects
**Source:** `frontend/src/app/report/page.tsx` + `i18n/routing.ts` (`localePrefix: 'always'`)  
**Apply to:** Unprefixed `/status` bounce; success prep URL; officer absolute copy URL.

### next-intl catalogs
**Source:** `frontend/messages/en.json` / `vi.json` + `public-shell.test.mjs` key-tree parity  
**Apply to:** All new `public.status*` and `dashboard.copyStatus*` strings.

### Generic client errors
**Source:** `ReportForm.tsx` fetch error handling; officer detail `FetchResult` catch messages  
**Apply to:** Status page — but **override** raw `body.detail` for 401 (always catalog verify-failed) to avoid existence-leak copy from API drift.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All Phase 4 files have at least a role-match analog. Novel behavior is **composition**: uniform 401 anti-enumeration has no prior endpoint (officer uses 404) — planner must follow RESEARCH Pattern 1, not `report_detail`. |

## Metadata

**Analog search scope:** `frontend/src/app/api/public/`, `frontend/src/app/[locale]/`, `frontend/src/components/`, `frontend/src/app/dashboard/`, `frontend/tests/`, `backend/app/api/`, `backend/app/security.py`, `backend/app/services/`, `backend/app/schemas.py`, `backend/app/config.py`, `backend/tests/`  
**Files scanned:** ~25 primary touchpoints  
**Pattern extraction date:** 2026-07-20

---

*Phase: 04-citizen-status*  
*Pattern mapping completed: 2026-07-20*  
*Ready for planning: yes*
