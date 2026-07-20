# Phase 1: Supabase Foundation - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 35 planned new/modified files
**Analogs found:** 32 / 35
**Research:** Disabled; assignments are derived from phase context, UI contract, requirements, and live code

## Scope Interpretation

The paths below are the concrete implementation surface implied by `01-CONTEXT.md`, `01-UI-SPEC.md`, and the three roadmap tracks. Paths not named verbatim upstream are marked as inferred by their placement in this map. Deferred Phase 2+ work (full landing copy, RHF/Zod form polish, citizen token issuance UX, dashboard data table, and `middleware.ts` route enforcement) is deliberately excluded. Phase 1 may create Supabase SSR helpers used by later middleware, but must not pull Phase 2 route-protection scope forward.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20260720_000001_foundation.sql` | migration | CRUD | `infra/bigquery/schema.sql` + `infra/bigquery/create_status_events.sql` | role-match |
| `backend/app/services/supabase.py` | service | CRUD | `backend/app/services/bigquery.py` | exact |
| `backend/app/services/storage.py` | service | file-I/O | same file | exact |
| `backend/app/security.py` | middleware | request-response | same file | exact seam, implementation replaced |
| `backend/app/config.py` | config | transform | same file | exact |
| `backend/app/api/reports.py` | controller | request-response | same file | exact |
| `backend/app/main.py` | config | request-response | same file | exact |
| `backend/requirements.txt` | config | batch | same file | exact |
| `backend/.env.example` | config | transform | same file | exact |
| `scripts/migrate_bigquery_to_supabase.py` | utility | batch | `scripts/seed_reports.py` | role-match |
| `scripts/seed_reports.py` | utility | batch | same file | exact |
| `backend/tests/test_supabase.py` | test | CRUD | `backend/tests/test_bigquery.py` | exact |
| `backend/tests/test_storage.py` | test | file-I/O | `backend/tests/test_reports.py` image tests | flow-match |
| `backend/tests/test_security.py` | test | request-response | same file | exact |
| `backend/tests/test_reports.py` | test | request-response | same file | exact |
| `frontend/package.json` | config | batch | same file | exact |
| `frontend/package-lock.json` | config | batch | same file | exact |
| `frontend/components.json` | config | transform | none | no analog |
| `frontend/src/lib/utils.ts` | utility | transform | none | no analog |
| `frontend/src/lib/supabase/client.ts` | service | request-response | `frontend/src/lib/backend.ts` | role-match |
| `frontend/src/lib/supabase/server.ts` | service | request-response | `frontend/src/lib/auth.ts` | role-match |
| `frontend/src/lib/auth.ts` | service | request-response | same file | exact seam, implementation replaced |
| `frontend/src/lib/backend.ts` | service | request-response | same file | exact |
| `frontend/src/app/api/session/login/route.ts` | route | request-response | same file | exact |
| `frontend/src/app/api/session/logout/route.ts` | route | request-response | same file | exact |
| `frontend/src/app/layout.tsx` | component | request-response | same file | exact |
| `frontend/src/app/globals.css` | config | transform | same file | exact |
| `frontend/src/app/page.tsx` | component | request-response | same file | role-match (replace dashboard with public shell) |
| `frontend/src/components/LocaleSwitcher.tsx` | component | event-driven | `frontend/src/components/StatusActions.tsx` | role-match |
| `frontend/src/app/dashboard/layout.tsx` | component | request-response | `frontend/src/app/page.tsx` | role-match |
| `frontend/src/app/dashboard/page.tsx` | component | request-response | `frontend/src/app/page.tsx` | exact content move/simplification |
| `frontend/src/app/login/page.tsx` | component | request-response | same file | exact |
| `frontend/messages/en.json` | config | transform | none | no code analog |
| `frontend/messages/vi.json` | config | transform | `frontend/messages/en.json` (created as a synchronized pair) | paired |
| `frontend/src/i18n/request.ts` | config | request-response | `frontend/src/app/layout.tsx` locale boundary | flow-match |

## Pattern Assignments

### `supabase/migrations/20260720_000001_foundation.sql` (migration, CRUD)

**Analogs:** `infra/bigquery/schema.sql` lines 4-20 and `infra/bigquery/create_status_events.sql` lines 1-6.

Preserve the report field contract while translating arrays/serialized objects to JSONB, renaming the image field to a storage-neutral path/URI, adding the Phase 1 `access_tokens` table, foreign keys, indexes, constraints, and RLS policies.

```sql
-- infra/bigquery/schema.sql:4-20
CREATE TABLE IF NOT EXISTS `PROJECT_ID.citymind.reports` (
  report_id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description STRING,
  latitude FLOAT64,
  longitude FLOAT64,
  category STRING,
  severity INT64,
  confidence FLOAT64,
  summary STRING,
  recommendation STRING,
  priority STRING,
  estimated_impact STRING,
  evidence ARRAY<STRING>,
  uncertainty ARRAY<STRING>,
  urban_context STRING,
  image_gcs_uri STRING
)
```

```sql
-- infra/bigquery/create_status_events.sql:1-6
CREATE TABLE IF NOT EXISTS `citymind-ai-500910.citymind.report_status_events` (
  report_id STRING NOT NULL,
  status STRING NOT NULL,
  note STRING,
  created_at TIMESTAMP NOT NULL
);
```

**Required divergence:** make `status_events` append-only; authorize `officer`/`admin` from `auth.jwt() -> 'app_metadata' ->> 'role'`; do not add PostGIS. Public browser clients must not gain general report reads. Service-role ingest bypass is server-only.

---

### `backend/app/services/supabase.py` (service, CRUD)

**Analog:** `backend/app/services/bigquery.py`.

Keep the method surface so the controller cutover remains mechanical: `list_recent`, `insert`, `summary`, `update_status`, image-path lookup, `get_report`, and `status_history`.

**Imports and service-object pattern** (lines 1-10):

```python
import json
from datetime import datetime, timezone

from google.cloud import bigquery

from app.config import Settings


class BigQueryReportSink:
    def __init__(self, settings: Settings):
```

Replace the Google import/client with `from supabase import Client, create_client`. Construct two explicit client modes: service-role for public ingest and caller-JWT for officer reads/updates. Never place the service key in a user-scoped client.

**Row mapping pattern** (lines 80-108):

```python
def insert(
    self,
    report_id,
    description,
    latitude,
    longitude,
    analysis,
    urban_context=None,
    image_gcs_uri: str | None = None,
) -> bool:
    row = {
        "report_id": report_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "description": description,
        "latitude": latitude,
        "longitude": longitude,
        "urban_context": json.dumps(urban_context or {}, ensure_ascii=False),
        "image_gcs_uri": image_gcs_uri,
        **analysis.model_dump(mode="json"),
    }
```

For Postgres JSONB, send Python dict/list values directly rather than `json.dumps`. Preserve UTC timestamps and `model_dump(mode="json")`.

**Append-only status pattern** (lines 141-156):

```python
def update_status(
    self, report_id: str, status: str, note: str | None = None
) -> bool:
    row = {
        "report_id": report_id,
        "status": status,
        "note": note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    errors = self.client.insert_rows_json(self.status_table_id, [row])
    if errors:
        raise RuntimeError(f"BigQuery status insert failed: {errors}")
    return True
```

Use an insert into `status_events`, not an update of prior history. Accept the caller access token/client for protected operations so RLS is actually exercised.

---

### `backend/app/services/storage.py` (service, file-I/O)

**Analog:** existing file, lines 12-31 and 32-48.

```python
class EvidenceStorage:
    def __init__(self, settings: Settings):
        self.enabled = settings.enable_image_storage

    def upload_image(self, report_id: str, image_bytes: bytes | None, mime_type: str | None) -> str | None:
        if not self.enabled or self.client is None or not image_bytes or not mime_type:
            return None

        ext = MIME_EXT.get(mime_type)
        if not ext:
            raise RuntimeError(f"Unsupported image MIME type: {mime_type}")

        object_name = f"reports/{report_id}/evidence.{ext}"
```

Preserve `MIME_EXT`, guard clauses, and the deterministic private object path. Replace the GCS bucket/blob calls with Supabase Storage bucket upload/download. Return/store the object path (or an explicit `supabase://bucket/path` URI) and keep downloads server mediated; do not make the bucket public. Legacy `gs://` rows may remain readable only if the chosen migration strategy deliberately retains a legacy adapter.

---

### `backend/app/security.py` and `backend/app/api/reports.py` (middleware/controller, request-response)

**Primary analog:** `backend/app/api/reports.py`.

**Dependency injection and cached factories** (lines 16-49):

```python
from app.config import get_settings
from app.schemas import AnalyzeResponse, Category, Priority
from app.security import enforce_report_rate_limit, require_officer

@lru_cache
def get_sink() -> BigQueryReportSink:
    return BigQueryReportSink(get_settings())

@lru_cache
def get_evidence_storage() -> EvidenceStorage:
    return EvidenceStorage(get_settings())
```

Keep short endpoint functions and dependency injection, but the new sink must be able to receive the caller JWT for RLS-scoped operations. Caching a service-role client is acceptable; do not cache a user JWT across requests.

**Public versus protected boundary** (lines 52-59 and 116-125):

```python
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_report(
    ...,
    _rate_limit: None = Depends(enforce_report_rate_limit),
) -> AnalyzeResponse:
```

```python
@router.get("/recent")
async def recent_reports(
    ...,
    _officer: None = Depends(require_officer),
):
```

Preserve unauthenticated `/analyze`; keep every officer read/update/image endpoint behind the JWT dependency.

**Validation and exception boundary** (lines 126-152):

```python
if limit < 1 or limit > 100:
    raise HTTPException(422, "limit must be between 1 and 100")
if status is not None and status not in VALID_STATUSES:
    raise HTTPException(422, "Invalid status filter")

try:
    items = get_sink().list_recent(...)
    return {"items": items, "count": len(items)}
except Exception as exc:
    raise HTTPException(502, f"BigQuery query failed: {exc}") from exc
```

Keep guard-clause validation and re-raise intentional `HTTPException` values (lines 173-182). Replace provider names in errors. Phase 2 owns broad error sanitization, but Phase 1 should not introduce new secret/token leakage.

**JWT implementation warning:** `backend/app/security.py:38-50` is a replacement target, not an auth analog. Delete the shared `X-CityMind-Officer-Key` comparison and the development fail-open. Validate bearer JWT signature via Supabase JWKS, issuer, audience as configured, expiry, and `app_metadata.role in {"officer", "admin"}`; return a typed claims/principal object for downstream user-scoped Supabase clients.

**CORS update:** `backend/app/main.py:10-16` currently allows `X-CityMind-Officer-Key`. Replace it with `Authorization` while retaining configured origins, credentials, methods, and `Content-Type`.

---

### Backend configuration, dependencies, migration, and tests

**Apply to:** `backend/app/config.py`, `backend/requirements.txt`, `backend/.env.example`, `scripts/migrate_bigquery_to_supabase.py`, `scripts/seed_reports.py`, `backend/tests/test_supabase.py`, `backend/tests/test_storage.py`, `backend/tests/test_security.py`, `backend/tests/test_reports.py`.

**Settings convention** (`backend/app/config.py:5-20`):

```python
class Settings(BaseSettings):
    app_env: str = "development"
    google_cloud_project: str = "citymind-ai-500910"
    ...
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
```

Add explicit `supabase_url`, anon/publishable key, service-role secret, JWT issuer/audience/JWKS inputs as required, and private evidence bucket. Remove operational BigQuery/GCS toggles only after migration tooling has its own source configuration. Keep secrets blank in `.env.example`.

**Idempotent batch utility pattern** (`scripts/seed_reports.py:29-36`, 88-138, 141-158):

```python
def parse_args():
    parser = argparse.ArgumentParser(description="Seed deterministic CityMind demo data.")
    parser.add_argument("--apply", action="store_true", ...)
    return parser.parse_args()

missing_reports = [r for r in REPORTS if r.report_id not in existing_reports]
...
return {
    "reports_inserted": len(report_rows),
    "reports_skipped": len(existing_reports),
    "status_events_inserted": len(status_rows),
    "image_uploaded": image_uri is not None,
}
```

Migration should default to dry-run, preserve report IDs/timestamps/JSON arrays/history, check existing keys for repeatability, report counts, and exit nonzero on failure. Officer accounts remain manually seeded; do not implement open signup.

**Fake-client unit pattern** (`backend/tests/test_bigquery.py:13-32`, 90-103):

```python
class FakeClient:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.queries = []
        self.inserts = []

def test_status_update_is_append_only_insert() -> None:
    client = FakeClient()
    sink = enabled_sink(client)
    assert sink.update_status("report-1", "reviewing", "Assigned") is True
    assert client.queries == []
```

Mock the Supabase fluent response/client chain; assert table names, filters, payload JSON types, service-role ingest, caller-token client creation, and append-only history.

**Controller isolation pattern** (`backend/tests/test_reports.py:23-46`, 95-113):

```python
sink = SimpleNamespace(get_report=lambda report_id: {
    "report_id": report_id,
    "status": "reviewing",
})
monkeypatch.setattr(reports_api, "get_sink", lambda: sink)
response = client.get("/api/v1/reports/report-1")
assert response.status_code == 200
```

Update tests to override JWT dependencies/claims, then retain endpoint assertions. Add negative cases for missing bearer token, invalid signature/issuer/audience, expired JWT, absent role, disallowed role, and allowed officer/admin. Explicitly test there is no development auth bypass.

---

### Supabase SSR helpers and BFF routes

**Apply to:** `frontend/src/lib/supabase/client.ts`, `frontend/src/lib/supabase/server.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/backend.ts`, and session routes.

**Server-only boundary and cookie access analog** (`frontend/src/lib/auth.ts:1-5`, 66-75):

```typescript
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireOfficerSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
```

Use `@supabase/ssr` cookie adapters in the server helper and `@supabase/supabase-js` in the browser helper. Preserve the `server-only` guard for server modules. Replace the custom HMAC token, password env vars, quick-access mode, and `citymind_officer_session` entirely.

**Backend fetch seam** (`frontend/src/lib/backend.ts:12-20`):

```typescript
export function backendEndpoint(path: string) {
  return `${backendUrl()}${path}`;
}

export function officerFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const key = process.env.OFFICER_API_KEY;
  if (key) headers.set("X-CityMind-Officer-Key", key);
  return fetch(backendEndpoint(path), { ...init, headers });
}
```

Keep URL normalization and `Headers` merging. Make `officerFetch` async, obtain the current Supabase session server-side, reject missing sessions, and set `Authorization: Bearer ${accessToken}`. Never forward the service-role key.

**BFF response pass-through** (`frontend/src/app/api/officer/reports/[reportId]/status/route.ts:6-20`):

```typescript
export async function PATCH(request: Request, { params }: Context) {
  if (!(await getSession())) return Response.json({ detail: "Unauthorized" }, { status: 401 });
  ...
  const response = await officerFetch(...);
  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
```

Continue checking session at the BFF boundary and passing backend status/body through. Login/logout routes should call Supabase password sign-in/sign-out and redirect to `/dashboard`/`/login`; preserve the 303 Post/Redirect/Get behavior from `frontend/src/app/api/session/login/route.ts:18-30`.

---

### shadcn setup, root layout, theme, and i18n

**Apply to:** `frontend/package.json`, lockfile, `components.json`, `src/lib/utils.ts`, `src/app/globals.css`, `src/app/layout.tsx`, messages, `src/i18n/request.ts`, and `LocaleSwitcher.tsx`.

**Root-layout convention** (`frontend/src/app/layout.tsx:15-32`):

```tsx
export const metadata: Metadata = {
  title: "CityMind AI",
  description: "AI-assisted decision intelligence for smarter communities",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="... h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

Replace Geist with Source Sans 3, set the active locale on `<html lang>`, and wrap children in the next-intl provider at this boundary. Keep metadata and full-height flex structure.

**Theme-token seam** (`frontend/src/app/globals.css:1-13`, 22-26):

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
```

Let shadcn initialization establish the canonical variable inventory, then map primary to `#0F766E`, background to `#FFFFFF`, secondary to `#F0F4F3`, foreground to `#14201D`, muted foreground to `#5C6B66`, border to `#D5DEDB`, and destructive to `#B42318`. Remove the automatic dark palette: the approved Phase 1 contract is a light civic shell. Add visible primary focus rings and reduced-motion behavior. Typography is exactly 14/16/20/28px and weights 400/600.

Message JSON must use identical keys in EN and VI. Phase 1 strings include public CTA, login copy/error, dashboard empty/load errors, sidebar labels, locale accessible name, and logout confirmation. Do not invent full Phase 2 marketing content.

`LocaleSwitcher.tsx` should be a small client component with an explicit accessible label, preserving the active URL while switching locale/cookie according to the chosen next-intl no-prefix routing setup.

---

### Public home scaffold (`frontend/src/app/page.tsx`)

**Analog:** current page component structure, but its dashboard content moves to `/dashboard`.

**Imports/component convention** (`frontend/src/app/page.tsx:1-6`, 139-150):

```tsx
import Link from "next/link";

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  ...
  return (
```

Use a server page with direct module imports and semantic `header`/`main`/`footer`. Phase 1 content is only a restrained public shell: CityMind wordmark first, “Report an issue” primary action, locale switcher, placeholder content, and footer. Do not preserve the current auth call at lines 139-145 on `/`; public Home must be unauthenticated.

---

### Dashboard shell (`frontend/src/app/dashboard/layout.tsx`, `page.tsx`)

**Analog:** `frontend/src/app/page.tsx` lines 150-173 and 267-275.

```tsx
<main className="min-h-screen ...">
  <section className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-start justify-between gap-4">
      ...
    </header>

    {(reportsResult.error || summaryResult.error) && (
      <div role="alert">{reportsResult.error || summaryResult.error}</div>
    )}
```

```tsx
{!reportsResult.error && reports.length === 0 && (
  <div className="..." >
    <p>{hasFilters ? "No reports match these filters." : "No reports found."}</p>
  </div>
)}
```

Move the authenticated application boundary to `/dashboard`. The layout owns sidebar/chrome; the page owns only placeholder/empty content. Sidebar labels: Reports, Export, Settings, Sign out; Reports is active. Use shadcn primitives and lucide icons, a restrained secondary surface, and accent only for the active indicator/action/focus. Keep the AI-advisory copy visible. Report data table/filter/export workflow is Phase 3, not this scaffold.

---

### Login (`frontend/src/app/login/page.tsx` and login route)

**Analog:** existing page lines 7-22.

```tsx
export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <section className="w-full max-w-md ...">
        <h1>Officer sign in</h1>
        <form action="/api/session/login" method="post" className="mt-6">
          ...
          {error && <p role="alert">Invalid password.</p>}
```

Retain centered single-card hierarchy, native POST form, autocomplete, and `role="alert"`. Replace password-only input with email + password and Supabase sign-in. Remove quick access. Apply exact approved copy (“Officer sign-in”, “Sign in to dashboard”, advisory supporting line, and actionable auth error), 44px minimum button/input target, Source Sans 3, civic tokens, and shadcn `Card`, `Label`, `Input`, `Button`, and `Alert`/`Sonner`.

## Shared Patterns

### Authentication and authorization

**Sources:** `backend/app/api/reports.py:116-125`, `frontend/src/lib/auth.ts:66-75`, `frontend/src/lib/backend.ts:16-20`  
**Apply to:** all officer FastAPI endpoints, BFF routes, server dashboard reads, and login/logout.

Flow:

1. Supabase Auth creates the access token and `@supabase/ssr` persists it in cookies.
2. Next server code reads/refreshes that session and forwards only the access token.
3. FastAPI verifies JWT cryptography and claims, then checks `app_metadata.role`.
4. FastAPI creates a caller-scoped Supabase client for officer CRUD so RLS is enforced.
5. Public `/analyze` uses a separate service-role client for the privileged insert.

Never use the service-role key in frontend/browser code. Never trust a decoded but unverified JWT. Never retain the current development fail-open.

### Error handling

**Source:** `backend/app/api/reports.py:173-182`  
**Apply to:** controllers and storage/sink boundaries.

```python
try:
    ...
except HTTPException:
    raise
except Exception as exc:
    raise HTTPException(502, "Status update failed") from exc
```

Preserve intended HTTP errors and chain provider exceptions. Provider/client details should remain server-side; do not return Supabase keys, JWT content, or raw SDK responses.

### Request validation

**Source:** `backend/app/api/reports.py:126-139`  
**Apply to:** all existing report filter/status inputs.

Continue using FastAPI/Pydantic constraints plus explicit enum and cross-field guards. The storage backend change must not loosen MIME/size guards at `backend/app/api/reports.py:63-81`.

### Frontend fetch failure states

**Source:** `frontend/src/app/page.tsx:67-106`  
**Apply to:** dashboard placeholder/server reads.

```typescript
try {
  const res = await officerFetch(path, { cache: "no-store" });
  if (!res.ok) return { data: [], error: `Could not load reports (HTTP ${res.status}).` };
  return { data: (await res.json()).items ?? [], error: null };
} catch {
  return { data: [], error: "Could not connect to the CityMind API." };
}
```

Keep explicit `res.ok` checks, stable fallback shapes, and visible `role="alert"` rendering.

### Tests

**Sources:** `backend/tests/test_bigquery.py:13-32`, `backend/tests/test_reports.py:23-46`, `backend/tests/test_security.py:22-52`  
**Apply to:** sink, storage, auth, and controller tests.

Prefer small fakes and `monkeypatch` at service/dependency boundaries. Verify behavior and authorization outcome, not Supabase SDK internals alone. RLS SQL also needs an integration verification against Supabase Cloud (officer/admin permitted; anon/cross-boundary reads denied), since unit mocks cannot prove policies.

## Replacement Targets — Do Not Copy

| Current Pattern | Location | Required Replacement |
|---|---|---|
| Development auth fail-open | `backend/app/security.py:41-50` | Verified Supabase JWT; fail closed in every environment |
| Shared officer header | `frontend/src/lib/backend.ts:16-20` | Caller `Authorization: Bearer` token |
| Custom HMAC session | `frontend/src/lib/auth.ts:8-83` | `@supabase/ssr` cookies/session |
| Password env + quick access | `frontend/src/app/api/session/login/route.ts:11-29` | Supabase password sign-in; no public signup |
| Dashboard at public root | `frontend/src/app/page.tsx:139-277` | Public `/`; dashboard shell at `/dashboard` |
| GCS operational evidence | `backend/app/services/storage.py:26-47` | Private Supabase Storage path/download |
| Raw provider name/error text | `backend/app/api/reports.py:151-160` | Storage-neutral messages without secrets |

## No Analog Found

| File | Role | Data Flow | Reason / Planner Direction |
|---|---|---|---|
| `frontend/components.json` | config | transform | First shadcn initialization. Generate via official shadcn CLI using new-york, zinc, CSS variables; do not hand-invent registry config. |
| `frontend/src/lib/utils.ts` | utility | transform | First shadcn utility. Use the official generated `cn` helper and dependency versions, not a local variant. |
| `frontend/messages/en.json` | config | transform | No localization files exist. Establish stable semantic keys and mirror them exactly in `vi.json`. |

## Metadata

**Analog search scope:** `backend/`, `frontend/`, `infra/`, `scripts/`, `.planning/codebase/`  
**Files scanned:** 55 project files inventoried; 24 relevant source/config/test files inspected  
**Primary analogs selected:** 5 (`bigquery.py`, `storage.py`, `reports.py`, `page.tsx`, `login/page.tsx`)  
**Pattern extraction date:** 2026-07-20
