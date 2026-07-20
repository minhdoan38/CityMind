# Phase 4: Citizen Status - Research

**Researched:** 2026-07-20
**Domain:** Token-scoped public status lookup (FastAPI + Next BFF + bilingual `/status`) + officer reportId-only share link
**Confidence:** HIGH
**Researcher role:** gsd-phase-researcher (generic-agent workaround)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Status page entry
- **D-01:** Support **both** entry modes: (1) manual form fields for `report_id` + token, and (2) **auto-fill from query params** `reportId` + `token` matching the success-page prep URL (`/status?reportId=…&token=…`).
- **D-02:** When query params are present and valid-shaped, **prefill the form and auto-submit once** (or fetch immediately) so the shareable link “just works”; user can still edit fields and re-submit.
- **D-03:** Route lives under locale prefixes (`/en/status`, `/vi/status`) consistent with Phase 2 `localePrefix: 'always'`; keep unprefixed redirects aligned with next-intl routing.
- **D-04:** Visual tone matches **public civic/light** surfaces (not officer dashboard chrome). Prefer simple form + result panel — no marketing hero clutter on `/status`.

#### Citizen-visible payload
- **D-05:** Successful lookup returns **only**: current status, short summary (citizen-facing), and **status history** entries with timestamp + status (+ citizen-safe note text if present). **Do not** return AI recommendation, evidence arrays, urban context, confidence, severity internals, officer `actor_id`, or raw analysis JSON (CIT-02).
- **D-06:** Officer resolve/reject **notes** may appear in history **as plain text** when present — they are part of the citizen-facing outcome trail. Do **not** expose internal actor identifiers or officer emails.
- **D-07:** History order on the public page: **newest-first** (aligned with Phase 3 officer timeline direction).
- **D-08:** Empty history is allowed (show current status + “No updates yet” empty copy). Loading/error/empty states required on the page.

#### Shareable link security
- **D-09:** Keep the **query-string token** format already used on success (`reportId` + `token` query params). Do **not** switch to hash-fragment-only in Phase 4 (would break copy-paste from success and officer share links). Document that URLs are secrets; advise citizens not to post publicly.
- **D-10:** Continue **SHA-256 hash-at-rest** validation against `access_tokens`; never log plaintext tokens; never echo token back in API error bodies.
- **D-11:** Honor existing token **expiry** (`expires_at` from issuance, default ~365 days). Expired tokens use the **same uniform failure** as invalid tokens (CIT-03) — no “expired” vs “not found” distinction to clients.
- **D-12:** Server is authoritative: client must not infer existence from timing alone beyond best-effort constant messaging; prefer single generic failure message.

#### Officer copy-link UX (DASH-08)
- **D-13:** On `/dashboard/reports/[reportId]`, add a **“Copy status link”** control in the header/meta area (near report id / status), not buried only in resolve actions.
- **D-14:** Plaintext tokens are **not stored** (hash-at-rest only), so officers **cannot** reconstruct the citizen’s full tokenized URL. Phase 4 behavior:
  - **D-14a:** Officer control copies `/{locale}/status?reportId={reportId}` (**no token**) and toast explains the citizen still needs their access token from the success page.
  - **D-14b:** Show a short officer-facing **hint** that the full tokenized link was shown once at submission and cannot be recovered from the dashboard.
  - **D-14c:** Do **not** implement token re-issue/rotation in Phase 4. The success-page **full** `reportId`+`token` link remains the primary secret share URL for citizens.
- **D-15:** Copy feedback: clipboard + brief toast/live region (“Link copied”) EN/VI; same pattern as success-page copy buttons.

#### Failure & rate-limit UX
- **D-16:** Invalid, missing, malformed, or expired token → **one generic client message** (e.g. “We couldn’t verify that report and token.”) with HTTP **401** from API; **no** different copy for “wrong id” vs “wrong token” vs “expired” (CIT-03).
- **D-17:** Rate limit (CIT-04): reuse public analyze pattern — **IP via `X-Forwarded-For`** behind Cloud Run; return **429** with Retry-After when applicable; UI shows a calm “Too many attempts — try again shortly” message (EN/VI), still without existence leakage.
- **D-18:** Public status API is **unauthenticated** except for token proof; do not require citizen accounts.

### the agent's Discretion
- Exact rate-limit window/burst numbers (align with analyze limiter unless research finds a safer public-lookup default)
- Whether auto-submit on query-param deep link uses client fetch or RSC
- Exact EN/VI string IDs in message catalogs
- Whether officer copy button uses absolute URL (`window.location.origin`) vs path-only
- BFF vs direct FastAPI for public status lookup (prefer Next public BFF consistent with analyze)

### Deferred Ideas (OUT OF SCOPE)
- Token re-issue / rotation / officer-generated replacement links — future phase if product requires recovery
- Email/SMS notify citizen on status change (NOTF-01)
- Hash-fragment-only tokens or short-lived signed status JWTs — not Phase 4
- Maps / Phase 7 triage surfacing on status page
- Multi-token per report / family sharing
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CIT-01 | Public `/status` page accepts report_id + access token | Locale route `/[locale]/status`; form + `reportId`/`token` query prefill + one-shot auto-fetch (D-01..D-04); mirror success-page civic chrome |
| CIT-02 | Token-validated API returns status, summary, and status history only | FastAPI public endpoint + Pydantic DTO stripping recommendation/evidence/urban_context/actor_id; history newest-first from `status_events` |
| CIT-03 | Invalid token returns 401 without leaking report existence | Hash → PK lookup → report_id `compare_digest` → expiry; single 401 + generic detail for all failure paths; no 404 for missing report |
| CIT-04 | Status lookup endpoint is rate-limited | Separate `SlidingWindowLimiter` instance + `client_ip()` XFF peel; BFF forwards XFF; 429 + `Retry-After` |
| DASH-08 | Officer can copy citizen status link from detail page | Header control copies `{origin}/{locale}/status?reportId=` **without token**; recovery hint (D-14a/b); no plaintext recovery |
| DATA-03 | Access tokens stored hashed (already complete) | Reuse `issue_access_token` / `access_tokens.token_hash`; Phase 4 only verifies hashes — no re-issue |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- **Privacy:** Citizen status lookup is token-scoped; no cross-report data leakage. `[CITED: AGENTS.md]`
- **Security:** Access tokens must be hashed at rest; AI is advisory only — status UI must not present AI as authority. `[CITED: AGENTS.md]` `[CITED: 04-UI-SPEC.md]`
- **Tech stack:** FastAPI for API; Supabase Postgres for ops; Next.js App Router + next-intl EN/VI. `[CITED: AGENTS.md]`
- **Compatibility:** Maintain Cloud Run deployment; BFF must forward client IP for rate limits behind proxy. `[CITED: AGENTS.md]` `[VERIFIED: backend/app/security.py]`
- **Locale:** Bilingual EN/VI from Phase 2 onward — status page + officer copy strings in catalogs. `[CITED: AGENTS.md]`

## Summary

Phase 4 closes the citizen loop started in Phase 2: tokens are already issued (urlsafe 32 → SHA-256 hex → `access_tokens`) and the success page prepares a status URL, but there is **no** public verify endpoint, **no** `/[locale]/status` page, and officers cannot share a status deep link. `[VERIFIED: backend/app/services/tokens.py]` `[VERIFIED: frontend/src/app/[locale]/report/success/page.tsx]` Research shows the verify path should be a **service-role** FastAPI operation: hash the submitted token, look up by `token_hash` primary key, bind `report_id` with `secrets.compare_digest`, reject expired rows with the **same** 401 as invalid rows, then return a minimal DTO (`status`, `summary`, `history[]` without `actor_id`). `[CITED: https://docs.python.org/3.12/library/secrets.html#secrets.compare_digest]` `[CITED: OWASP ASVS 7.4.1 / WSTG enumeration guidance]`

Rate limiting should **not** share the analyze limiter’s event bucket (analyze is Gemini-expensive; status is cheap DB), but **must** reuse the same `client_ip()` / XFF rightmost-hop peel and BFF header-forward pattern already proven for analyze. `[VERIFIED: backend/app/security.py]` `[VERIFIED: frontend/src/app/api/public/reports/analyze/route.ts]` Frontend should add a public BFF + client status page (auto-fetch from query params) and a detail-page copy control that honestly copies **reportId-only** URLs because plaintext tokens are unrecoverable (D-14).

**Primary recommendation:** Ship Track A as `POST /api/v1/reports/status` (hash verify + uniform 401 + separate status IP limiter) behind Next BFF `/api/public/reports/status`; Track B as `[locale]/status` client form with one-shot auto-fetch; Track C as detail header “Copy status link” (no token) + EN/VI catalogs — fix success prep URL to include locale prefix.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token hash verify + expiry | API / Backend | Database / Storage | Service-role read of `access_tokens`; never client-trusted |
| Citizen DTO projection (strip secrets/AI internals) | API / Backend | — | Server authoritative for CIT-02 field allowlist |
| Status rate limit (IP / XFF) | API / Backend | Frontend Server (BFF XFF forward) | Same DATA-08 pattern as analyze |
| Public BFF proxy | Frontend Server | API / Backend | Prefer Next public BFF (discretion + analyze consistency) |
| `/[locale]/status` form + auto-fetch | Browser / Client | Frontend Server (RSC shell) | Query params + one-shot client fetch; keep form editable |
| Locale routing EN/VI | Frontend Server (`proxy.ts` + next-intl) | Browser (switcher) | `localePrefix: 'always'` already locked |
| Officer copy status link | Browser / Client | Frontend Server (detail page) | Clipboard + live region; no token reconstruction |
| Success-page status URL prep | Browser / Client | — | Align locale prefix with D-03; full tokenized link remains citizen secret |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | `0.115.14` `[CITED: AGENTS.md]` | Public status endpoint + Pydantic DTO | Existing backend boundary |
| Python `hashlib` + `secrets` | stdlib 3.12+ | SHA-256 hash + `compare_digest` | Already used for issuance; official constant-time compare `[CITED: docs.python.org/3.12/library/secrets.html]` |
| supabase-py via `SupabaseReportSink` | existing | Service-role lookup of tokens/reports/events | RLS denies anon on `access_tokens`; service role required `[VERIFIED: supabase/migrations/20260720_000001_foundation.sql]` |
| Next.js App Router | `16.2.10` `[VERIFIED: frontend/package.json]` | `/[locale]/status` + public BFF | Matches Phase 2 public surface |
| next-intl | `4.13.2` `[VERIFIED: frontend/package.json]` | EN/VI catalogs + locale prefixes | `localePrefix: 'always'` `[VERIFIED: frontend/src/i18n/routing.ts]` |
| shadcn/ui (existing) | initialized | Form, Alert, Badge, Skeleton, Button | UI-SPEC reuse; no new registry blocks required `[CITED: 04-UI-SPEC.md]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `SlidingWindowLimiter` (in-repo) | existing | Per-IP status rate limit | Reuse class; **new** limiter instance + settings key |
| lucide-react | `1.25.0` | Copy/Check icons | Match success-page clipboard UX |
| pytest | `8.4.1` `[VERIFIED: pytest --version]` | Backend CIT-02/03/04 tests | Wave 0 + phase gate |
| Node assert tests (`frontend/tests/*.mjs`) | existing | Smoke for route/i18n keys | Mirror `public-shell.test.mjs` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| POST status body via BFF | GET with query token on FastAPI | GET puts secrets in access logs/referrers at API edge; deep link still uses query on browser page (D-09) — keep secrets out of FastAPI URL |
| Separate status limiter | Share `report_limiter` bucket | Analyze + status would starve each other; separate instance with `status:{ip}` key is cleaner |
| Absolute officer copy URL | Path-only clipboard | Absolute preferred for paste into SMS/email (UI-SPEC); path-only OK for same-origin only |
| New toast library (`sonner`) | Live region + Check icon | UI-SPEC prefers success-page pattern — **no new package** |

**Installation:** None required for Phase 4 — reuse existing stack.

```bash
# No new npm/pip packages expected
```

## Package Legitimacy Audit

> Phase installs **no** new external packages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | N/A |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Citizen browser
  │  (1) open /{locale}/status?reportId=&token=  OR  manual form
  │  (2) POST JSON { report_id, token }  [one-shot auto or CTA]
  ▼
Next public BFF  /api/public/reports/status
  │  forward X-Forwarded-For / X-Real-Ip
  ▼
FastAPI  POST /api/v1/reports/status
  │  enforce_status_rate_limit(client_ip) ──429──► Retry-After: 60
  │
  ├─ hash = SHA-256(token)
  ├─ SELECT access_tokens WHERE token_hash = hash   (service role)
  │     missing | expired | report_id mismatch ──401──► generic detail
  │     (secrets.compare_digest on report_id)
  ├─ load reports.current_status + summary
  ├─ load status_events (newest-first); strip actor_id
  └─ 200 { status, summary, history:[{status, note, created_at}] }

Officer dashboard /dashboard/reports/[reportId]
  └─ Copy status link → clipboard `{origin}/{locale}/status?reportId=` (NO token)
```

### Recommended Project Structure

```text
backend/app/
├── api/reports.py              # + POST /status (public)
├── schemas.py                  # + CitizenStatusResponse, StatusHistoryItem
├── security.py                 # + status_limiter, enforce_status_rate_limit
├── config.py                   # + status_rate_limit_per_minute
└── services/
    ├── tokens.py               # + verify helpers (hash + compare) OR keep inline
    └── supabase.py             # + get_access_token_by_hash, citizen_status_payload

frontend/src/
├── app/api/public/reports/status/route.ts   # BFF (mirror analyze XFF)
├── app/[locale]/status/page.tsx             # civic status UI
├── components/CopyStatusLink.tsx            # officer header control
└── messages/{en,vi}.json                    # public.status* + dashboard.copyStatus*

backend/tests/
└── test_citizen_status.py                   # CIT-02/03/04 Wave 0+

frontend/tests/
└── citizen-status.test.mjs                  # route + catalog smoke
```

### Pattern 1: Hash-then-bind verification (no existence leak)

**What:** Always SHA-256 the plaintext, look up by PK, then constant-time bind `report_id`; any failure → identical 401.  
**When to use:** All public status lookups (CIT-03).  
**Example:**

```python
# Source: https://docs.python.org/3.12/library/secrets.html#secrets.compare_digest
# Pattern adapted for CityMind access_tokens PK [VERIFIED: migration]
import hashlib
import secrets
from datetime import datetime, timezone

def verify_access(report_id: str, plaintext: str, row: dict | None) -> bool:
    if row is None:
        return False
    if datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        return False
    return secrets.compare_digest(row["report_id"], report_id)
```

Callers must **not** branch HTTP status/detail by failure reason. `[CITED: OWASP WSTG account enumeration]`

### Pattern 2: Public BFF with XFF forward

**What:** Next route proxies to FastAPI and copies client IP headers so rate limit keys on citizen IP, not Cloud Run/BFF IP.  
**When to use:** Every public unauthenticated backend call (analyze already; status next).  
**Example:**

```typescript
// Source: frontend/src/app/api/public/reports/analyze/route.ts [VERIFIED]
const headers = new Headers({ "Content-Type": "application/json" });
const xff = request.headers.get("x-forwarded-for");
const xrip = request.headers.get("x-real-ip");
if (xff) headers.set("X-Forwarded-For", xff);
else if (xrip) headers.set("X-Forwarded-For", xrip);

const response = await fetch(backendEndpoint("/api/v1/reports/status"), {
  method: "POST",
  headers,
  body: JSON.stringify({ report_id, token }),
});
```

### Pattern 3: Client auto-fetch once from query params

**What:** On mount, if `reportId` and `token` are non-empty trimmed strings, prefill and fetch **once**; ignore further param changes unless user submits.  
**When to use:** Deep link from success page (D-01, D-02). Prefer client fetch over RSC so token stays out of Next server logs from page data fetches. `[ASSUMED]` — RSC would still see searchParams in server logs on some hosts.

### Anti-Patterns to Avoid

- **Returning 404 when report missing but token wrong:** Leaks existence; always 401. `[CITED: CIT-03]`
- **Looking up by report_id first, then comparing hash:** Timing/DB differences can enumerate valid IDs; prefer token_hash PK path. `[ASSUMED]` residual timing risk remains; rate limit + entropy mitigate.
- **Including `actor_id` in history JSON:** Violates D-06 / CIT-02; strip in DTO builder.
- **Officer “Copy status link” with reconstructed token:** Impossible without plaintext; do not fake re-issue (D-14c).
- **Success prep URL without locale:** Current `/status?...` conflicts with `localePrefix: 'always'`. `[VERIFIED: success/page.tsx]` `[VERIFIED: i18n/routing.ts]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time string compare | Custom XOR loops | `secrets.compare_digest` | Official, reviewed crypto helper `[CITED: Python 3.12 secrets docs]` |
| Token entropy / hashing | New crypto scheme | Existing `issue_access_token` SHA-256 hex | DATA-03 already shipped |
| Rate-limit window math | New Redis limiter (Phase 4) | In-process `SlidingWindowLimiter` + `client_ip` | Matches analyze; Cloud Run single-instance OK for MVP |
| Toast system | New `sonner` install | Success-page Check + `aria-live` | UI-SPEC preference; no package risk |
| i18n routing | Manual locale path parsing | next-intl `Link` / `useLocale` | Prefix redirects already configured |

**Key insight:** Phase 4 is mostly **composition of Phase 1–2 seams** (tokens table, limiter, public BFF, next-intl). The novel security requirement is uniform failure semantics + DTO stripping — not new infrastructure.

## Common Pitfalls

### Pitfall 1: Existence leak via status codes or copy
**What goes wrong:** Client shows “Report not found” vs “Invalid token” or API returns 404 vs 401.  
**Why it happens:** Reusing officer `get_report` 404 pattern. `[VERIFIED: backend/app/api/reports.py report_detail]`  
**How to avoid:** Single helper raises one `HTTPException(401, "...")` for all verify failures; UI only maps 401 → `statusVerifyFailed`.  
**Warning signs:** Tests asserting different statuses for missing report vs wrong token.

### Pitfall 2: BFF forgets XFF → global rate limit
**What goes wrong:** All citizens share one limiter key (BFF egress IP); one user trips everyone.  
**Why it happens:** Direct `fetch(backend)` without header copy. Analyze already fixed this. `[VERIFIED: analyze/route.ts]`  
**How to avoid:** Copy analyze’s XFF/`X-Real-Ip` forward verbatim in status BFF; add test that limiter key uses forwarded hop.  
**Warning signs:** 429 under light load in Cloud Run only.

### Pitfall 3: Locale-less status URLs break deep links
**What goes wrong:** Copied `/status?...` redirects oddly or loses params under `localePrefix: 'always'`.  
**Why it happens:** Success page hardcodes unprefixed path. `[VERIFIED: success/page.tsx L55-56]`  
**How to avoid:** Build `/${locale}/status?reportId=…&token=…` with `useLocale()`; officer copy uses same locale rule (default `en` if dashboard unlocalized).  
**Warning signs:** Manual QA: paste success link → land on wrong locale or empty form.

### Pitfall 4: Oversharing officer history fields
**What goes wrong:** Public API returns `actor_id` because `status_history()` selects it for officers. `[VERIFIED: supabase.py status_history]`  
**Why it happens:** Reusing officer query unchanged.  
**How to avoid:** Dedicated citizen projection mapping `{status, note, created_at}` only; never pass through raw rows.  
**Warning signs:** Snapshot tests include `actor_id`.

### Pitfall 5: Logging plaintext tokens
**What goes wrong:** Debug logs or exception messages include request body token.  
**Why it happens:** Generic exception handlers stringify request.  
**How to avoid:** Never log request body for status; log only `report_id` + outcome code; DATA-10 generic client errors.  
**Warning signs:** Token substrings in Cloud Logging.

## Code Examples

### Citizen status response schema

```python
# Recommended Pydantic models for CIT-02 [ASSUMED shape locked by CONTEXT D-05]
from pydantic import BaseModel

class CitizenStatusHistoryItem(BaseModel):
    status: str
    note: str | None = None
    created_at: str

class CitizenStatusResponse(BaseModel):
    status: str
    summary: str | None = None
    history: list[CitizenStatusHistoryItem]
```

### Uniform 401 + rate limit dependency

```python
# Extend security.py patterns [VERIFIED: enforce_report_rate_limit]
status_limiter = SlidingWindowLimiter()

def enforce_status_rate_limit(request: Request) -> None:
    limit = get_settings().status_rate_limit_per_minute
    if not status_limiter.allow(f"status:{client_ip(request)}", limit):
        raise HTTPException(
            429,
            "Status lookup rate limit exceeded",
            headers={"Retry-After": "60"},
        )
```

**Discretion recommendation for limit value:** Default `0` (disabled) in Settings like `report_rate_limit_per_minute`; document production **`status_rate_limit_per_minute=30`** (status is cheaper than analyze). If ops wants one knob, set equal to analyze’s prod value — do **not** share the same deque. `[ASSUMED]`

### Officer copy control (reportId-only)

```tsx
// Discretion: absolute URL preferred [CITED: 04-UI-SPEC.md]
const locale = "en"; // dashboard currently unlocalized [VERIFIED: login note]
const url = `${window.location.origin}/${locale}/status?reportId=${encodeURIComponent(reportId)}`;
await navigator.clipboard.writeText(url);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Officer shared-key MVP status | Token-scoped public lookup | Milestone v2 / Phase 4 | Citizens track without accounts |
| BigQuery-only ops | Supabase `access_tokens` + `status_events` | Phase 1 | Hash-at-rest + RLS deny-by-default |
| Success “coming soon” link | Live `/[locale]/status` | Phase 4 | CIT-01 closes PUB-04 prep |
| Distinct 404 for missing resources | Uniform 401 for token failures | Phase 4 (CIT-03) | Anti-enumeration |

**Deprecated/outdated:**
- Treating officer `/status-history` as citizen API — wrong auth + overshares `actor_id`.
- Unprefixed `/status` clipboard values under next-intl `always`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Client-side auto-fetch is preferable to RSC for keeping tokens out of Next server request logs | Pattern 3 | If hosting already logs all query strings at CDN, need ops log-redaction instead |
| A2 | Prefer token_hash PK lookup over report_id-first to reduce ID enumeration | Anti-Patterns | Residual timing differences may still exist; rate limit remains primary brake |
| A3 | Prod status limit ~30/min is a safer default than sharing analyze’s lower budget | Rate limit discretion | Ops may want identical knobs; document both |
| A4 | `reports.summary` is the citizen-facing summary (AI-structured description summary, not recommendation) | CIT-02 DTO | Product may want a redacted/custom citizen blurb later — out of Phase 4 scope |
| A5 | Dashboard remains locale-unprefixed; officer copy defaults to `en` | DASH-08 | If dashboard gains locales, copy control must use active locale |

## Open Questions

1. **GET vs POST for FastAPI status** — **RESOLVED (2026-07-20 planning)**
   - Decision: **POST** `/api/v1/reports/status` + POST BFF; page never GETs FastAPI with token in URL (deep links keep query params on the browser page only — D-09).
   - Locked in: `04-01-PLAN.md` / `04-02-PLAN.md`.

2. **ROADMAP 04-03 “audit log display” wording** — **RESOLVED (2026-07-20 planning)**
   - Decision: **Out of scope** — detail history already ships from Phase 3; Track C (`04-03-PLAN.md`) implements DASH-08 copy control + recovery hint only. ROADMAP checklist realigned to drop “audit log display.”

3. **Dummy work on failed verify for timing equalization** — **RESOLVED (2026-07-20 planning)**
   - Decision: Best-effort only (hash + single query path); rely on token entropy + rate limit; **no artificial sleep** in Phase 4 unless a later security audit demands it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend status page / BFF | ✓ | v24.14.0 | — |
| Python 3 | FastAPI status API | ✓ | 3.14.5 (dev); target 3.12 in Docker `[CITED: AGENTS.md]` | — |
| pytest | Backend CIT tests | ✓ | 8.4.1 | — |
| Supabase project (service role) | Token/report reads | ✓ (Phase 1) | cloud | Blocker if unset — same as analyze persistence |
| Cloud Run / XFF | CIT-04 prod semantics | ✓ (deploy path) | — | Local: `request.client.host` |

**Missing dependencies with no fallback:** none for code-only Phase 4  
**Missing dependencies with fallback:** none

Step 2.6: External deps present; no blocking gaps.

## Validation Architecture

> `workflow.nyquist_validation: true` — include. `[VERIFIED: .planning/config.json]`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.4.1 (backend); Node `node:test` assert (frontend `*.mjs`) |
| Config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd backend && pytest tests/test_citizen_status.py tests/test_access_tokens.py -q` |
| Full suite command | `cd backend && pytest -q` + `node --test frontend/tests/*.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CIT-02 | Response contains only status/summary/history; no actor_id/recommendation | unit/api | `pytest tests/test_citizen_status.py::test_status_dto_strips_sensitive_fields -x` | ❌ Wave 0 |
| CIT-03 | Wrong token / wrong id / expired / missing → same 401 + same detail | unit/api | `pytest tests/test_citizen_status.py::test_uniform_401_no_existence_leak -x` | ❌ Wave 0 |
| CIT-03 | `compare_digest` used / report_id mismatch fails closed | unit | `pytest tests/test_citizen_status.py::test_report_id_binding -x` | ❌ Wave 0 |
| CIT-04 | Over-limit → 429 + Retry-After; XFF hop keys limiter | unit | `pytest tests/test_citizen_status.py::test_status_rate_limit_xff -x` | ❌ Wave 0 |
| CIT-01 | Locale route + catalog keys present | smoke | `node --test frontend/tests/citizen-status.test.mjs` | ❌ Wave 0 |
| DASH-08 | Copy builds reportId-only URL (no token) | unit/smoke | component test or mjs string assert | ❌ Wave 0 |
| DATA-03 | Hash-at-rest unchanged | regression | `pytest tests/test_access_tokens.py -q` | ✅ |

### Sampling Rate

- **Per task commit:** `pytest tests/test_citizen_status.py -q` (once created)
- **Per wave merge:** `pytest -q` + `node --test frontend/tests/*.mjs`
- **Phase gate:** Full suite green before `$gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_citizen_status.py` — CIT-02/03/04
- [ ] `frontend/tests/citizen-status.test.mjs` — route file + `public.status*` / `dashboard.copyStatus*` keys in en.json + vi.json
- [ ] Settings/env example: document `STATUS_RATE_LIMIT_PER_MINUTE` alongside analyze

## Security Domain

> `security_enforcement: true`, ASVS level 1. `[VERIFIED: .planning/config.json]`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | Bearer not used; **token proof** is the credential |
| V3 Session Management | no | Stateless lookup; no citizen session |
| V4 Access Control | yes | Token binds to single `report_id`; service-layer enforce (4.1.1); fail closed (4.1.5) `[CITED: ASVS V4]` |
| V5 Input Validation | yes | Pydantic max lengths on report_id/token; reject empty |
| V6 Cryptography | yes | SHA-256 at rest (existing); `secrets.compare_digest` for binding |
| V7 Error Handling & Logging | yes | Generic 401/429 messages (7.4.1); never log plaintext tokens (7.1.x) `[CITED: ASVS V7]` |

### Known Threat Patterns for token-scoped status lookup

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Report existence enumeration | Information disclosure | Uniform 401 + identical client copy (CIT-03) |
| Token brute force / stuffing | Spoofing | 256-bit urlsafe token + IP rate limit (CIT-04) |
| IDOR cross-report read | Elevation | Bind token_hash row’s `report_id` via compare_digest |
| Token in server access logs | Information disclosure | POST body via BFF; avoid FastAPI query tokens; no body logging |
| XFF spoof rate-limit bypass | DoS / abuse | Rightmost trusted hop (`trusted_proxy_count`) `[VERIFIED: security.py]` |
| Officer overshare of AI/evidence | Information disclosure | DTO allowlist only (CIT-02) |

## Sources

### Primary (HIGH confidence)
- Codebase: `backend/app/services/tokens.py`, `backend/app/security.py`, `backend/app/api/reports.py`, `backend/app/services/supabase.py`, `supabase/migrations/20260720_000001_foundation.sql`, `frontend/src/app/api/public/reports/analyze/route.ts`, `frontend/src/app/[locale]/report/success/page.tsx`, `frontend/src/i18n/routing.ts`
- [Python 3.12 secrets.compare_digest](https://docs.python.org/3.12/library/secrets.html#secrets.compare_digest) — constant-time compare
- Phase artifacts: `04-CONTEXT.md`, `04-UI-SPEC.md`, `REQUIREMENTS.md`, prior `01/02-CONTEXT.md`

### Secondary (MEDIUM confidence)
- [OWASP ASVS V4 Access Control](https://asvs.dev/v4.0.3/V4-Access-Control/) — fail securely / least privilege
- [OWASP ASVS V7 Error Handling](https://asvs.dev/v4.0.3/V7-Error-Logging/) — generic security-sensitive messages
- [OWASP WSTG Account Enumeration](https://owasp.org/www-project-web-security-testing-guide/v41/4-Web_Application_Security_Testing/03-Identity_Management_Testing/04-Testing_for_Account_Enumeration_and_Guessable_User_Account) — same response for failed auth

### Tertiary (LOW confidence - needs validation)
- Artificial response-time equalization for expired vs missing tokens — optional hardening only

## Metadata

**Research scope:**
- Core technology: Public token verify API + Next BFF + bilingual status page + officer copy
- Ecosystem: Existing FastAPI/Next/Supabase (no new packages)
- Patterns: Hash-bind verify, uniform 401, XFF rate limit, DTO strip, locale deep links
- Pitfalls: Existence leak, XFF omission, locale-less URLs, actor_id leakage, token logging

**Confidence breakdown:**
- Standard stack: HIGH — reuse verified in-repo versions; no new installs
- Architecture: HIGH — seams and schema verified in code + migrations
- Pitfalls: HIGH — derived from existing analyze/officer patterns and ASVS/WSTG
- Code examples: MEDIUM — recommended shapes aligned to CONTEXT; not yet implemented

**Research date:** 2026-07-20  
**Valid until:** 2026-08-19 (30 days — stable stack)

---

*Phase: 04-citizen-status*  
*Research completed: 2026-07-20*  
*Ready for planning: yes*
