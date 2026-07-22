# Phase 7: Next.js-Only Google-Free Platform - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 31 planned file/module groups
**Analogs found:** 27 / 31
**Scope:** `frontend/src`, `frontend/tests`, `backend/app`, `backend/tests`, `supabase/migrations`, `scripts`

## Mapping Principle

Phase 7 is a contract-preserving runtime migration. Copy TypeScript module, Route Handler, Supabase Auth, test, SQL, and PowerShell conventions from the frontend and Supabase tree. Copy API shapes, validation bounds, privacy projections, and orchestration order from the Python backend, but do **not** copy its FastAPI, Google SDK, BigQuery, GCS, Docker, or provider-specific implementation.

The strongest analog set is intentionally limited to five families:

1. Next.js Route Handlers: `frontend/src/app/api/officer/reports/[reportId]/{status,image}/route.ts` and `frontend/src/app/api/public/reports/status/route.ts`
2. Auth/client boundaries: `frontend/src/lib/auth.ts`, `frontend/src/lib/supabase/server.ts`, and `backend/app/services/supabase.py`
3. Legacy behavior contracts: `backend/app/schemas.py`, `backend/app/api/reports.py`, `backend/app/api/analytics.py`, and focused backend tests
4. Database/Storage patterns: `supabase/migrations/20260720120001_foundation.sql`, `supabase/migrations/20260721120002_geo_pins_rpc.sql`, and `backend/app/services/storage.py`
5. Tests/operations: `frontend/tests/citizen-status.test.mjs`, `frontend/tests/analytics-shell.test.mjs`, and `scripts/seed_officer_role.ps1`

## File Classification

| New/Modified File or Module | Role | Data Flow | Closest Existing Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/server/config/env.ts` | config | request-response | `frontend/src/lib/auth.ts` (server-only boundary) + `backend/app/config.py` (required settings inventory) | partial |
| `frontend/src/server/domain/report-analysis.ts` | model | transform | `backend/app/schemas.py` | exact contract |
| `frontend/src/server/validation/analysis-policy.ts` | utility | transform | `backend/app/services/gemini.py::SYSTEM_INSTRUCTION` | partial |
| `frontend/src/server/ai/provider.ts` | provider | request-response | `backend/app/services/gemini.py::GeminiAnalyzer.analyze` | role-match |
| `frontend/src/server/ai/openai-compatible.ts` | provider | request-response | `backend/app/services/gemini.py::GeminiAnalyzer.analyze` | role-match; protocol differs |
| `frontend/src/server/repositories/reports.ts` | service/repository | CRUD | `backend/app/services/supabase.py::SupabaseReportSink` | exact contract |
| `frontend/src/server/repositories/analytics.ts` | service/repository | batch/transform | `backend/app/services/analytics.py::AnalyticsService` + `get_report_geo_pins` RPC | role-match |
| `frontend/src/server/services/report-service.ts` | service | request-response | `backend/app/api/reports.py::analyze_report` | exact orchestration contract |
| `frontend/src/server/services/evidence-service.ts` | service | file-I/O/streaming | `backend/app/services/storage.py::EvidenceStorage` | exact role; remove GCS branch |
| `frontend/src/server/security/access-tokens.ts` | utility | CRUD/transform | `backend/app/services/tokens.py` | exact contract |
| `frontend/src/server/security/rate-limit.ts` | middleware/utility | request-response | `backend/app/security.py::SlidingWindowLimiter` and three enforcement functions | exact contract |
| `frontend/src/server/exports/reports.ts` | utility | streaming/transform | `backend/app/api/reports.py::_csv_iter`, `_build_xlsx_path`, `export_reports` | exact contract |
| `frontend/src/server/http/errors.ts` | utility | request-response | guard clauses and `HTTPException` mapping in `backend/app/api/reports.py` | role-match |
| `frontend/src/lib/supabase/admin.ts` | provider/config | CRUD/file-I/O | `backend/app/services/supabase.py::service_role_client` | exact boundary |
| `frontend/src/lib/supabase/server.ts` | provider/config | request-response | same file + `frontend/src/lib/auth.ts` | exact; modify/preserve |
| `frontend/src/app/api/v1/reports/**/route.ts` | route/controller | request-response/streaming | existing `app/api/officer/**` and `app/api/public/**` handlers + `backend/app/api/reports.py` | exact boundary + contract |
| `frontend/src/app/api/v1/analytics/route.ts` | route/controller | request-response | `backend/app/api/analytics.py` | exact contract |
| `frontend/src/app/api/v1/public/stats/route.ts` | route/controller | request-response | `frontend/src/app/api/public/stats/route.ts` + legacy public stats endpoint | exact boundary + contract |
| `frontend/src/app/api/health/route.ts` and readiness module | route/service | request-response | `backend/app/main.py::health` | role-match |
| existing `app/api/public|officer/**`, dashboard pages, and `PublicStatsStrip.tsx` | route/component | request-response | current files | exact; modify to direct server modules where server-rendered |
| `supabase/migrations/*_next_backend_contract.sql` | migration | CRUD/transactional | `20260720120001_foundation.sql` + `20260721120002_geo_pins_rpc.sql` | role-match |
| `supabase/migrations/*_postgres_analytics.sql` | migration | batch/transform | `get_report_geo_pins` RPC + `backend/app/services/analytics.py` query shapes | role-match |
| `supabase/migrations/*_evidence_path_additive.sql` and later `*_remove_legacy_evidence.sql` | migration | file-I/O/CRUD | `20260720120001_foundation.sql` and current `image_gcs_uri` column | partial; additive migration/reconciliation/restore/approval must precede destructive drop |
| `frontend/vitest.config.mts`, `package.json` test scripts | config | batch | `frontend/package.json` script style; existing Node test command | role-match |
| `frontend/src/server/**/*.test.ts` | test | request-response/CRUD/transform | focused `backend/tests/test_*.py` behavioral cases | exact behavior; framework differs |
| `frontend/tests/contracts/fastapi-golden/**` | test/fixture | request-response | `backend/tests/test_analyze.py`, `test_reports.py`, `test_citizen_status.py`, `test_export.py`, `test_analytics_api.py` | exact contract |
| `frontend/tests/migration/reconciliation.test.ts` | test | batch/file-I/O | `backend/tests/test_migrate_bigquery_to_supabase.py` | role-match |
| `frontend/scripts/migrate-google-data.*` and `reconcile-migration.ts` | utility | batch/file-I/O | deleted/legacy `scripts/migrate_bigquery_to_supabase.py` plus its backend test | partial; migration-only |
| `frontend/scripts/smoke-ai.mjs`, `smoke-production.mjs`, `google-exit-audit.mjs` | utility/test | request-response/batch | frontend `.mjs` tests and `frontend/package.json` scripts | role-match |
| `frontend/scripts/register-citymind-task.ps1`, `backup-citymind.ps1`, `restore-citymind.ps1` | config/utility | batch/file-I/O | `scripts/seed_officer_role.ps1` | role-match |
| `README.md`, `AGENTS.md` generated active sections, `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS}.md`, env examples | config/docs | file-I/O | current active documentation and env examples | exact; replace architecture |
| backend/Python, Docker, Google deployment scripts/config/tests/packages | config/removal | batch | Google-exit inventory in `07-RESEARCH.md` | no copy analog; deletion-gated |

## Pattern Assignments

### 1. Next.js compatibility Route Handlers

**Apply to:** `frontend/src/app/api/v1/reports/**/route.ts`, `api/v1/analytics/route.ts`, `api/v1/public/stats/route.ts`, and browser-facing `app/api/public|officer/**` handlers.

**Primary analog:** `frontend/src/app/api/officer/reports/[reportId]/status/route.ts`

**Imports and route context** (lines 1-8):

```typescript
import { getClaims } from "@/lib/auth";
import { officerFetch } from "@/lib/backend";

type Context = { params: Promise<{ reportId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  if (!(await getClaims())) return Response.json({ detail: "Unauthorized" }, { status: 401 });
  const { reportId } = await params;
```

**Response streaming/status preservation** (lines 17-20):

```typescript
return new Response(response.body, {
  status: response.status,
  headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
});
```

**Binary evidence response analog:** `frontend/src/app/api/officer/reports/[reportId]/image/route.ts` lines 6-17:

```typescript
export async function GET(_request: Request, { params }: Context) {
  if (!(await getClaims())) return Response.json({ detail: "Unauthorized" }, { status: 401 });
  const { reportId } = await params;
  const response = await officerFetch(
    `/api/v1/reports/${encodeURIComponent(reportId)}/image`,
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=60",
    },
  });
}
```

**Preserve:** named HTTP-method exports, Web `Request`/`Response`, promised dynamic params, `encodeURIComponent`, exact status/content type, private evidence caching, and short boundary functions.

**Phase 7 difference:** replace `officerFetch()`/`backendEndpoint()` with direct calls to `src/server` services/repositories. Authentication stays before any privileged read. Server Components must import the same server modules directly instead of self-fetching a Route Handler. Keep HTTP adapters only for browser/external compatibility.

**Public caller identity:** preserve the forwarding behavior in `frontend/src/app/api/public/reports/status/route.ts` lines 9-20, but feed the normalized address into the local rate limiter rather than forwarding it to FastAPI. Do not trust the leftmost arbitrary `X-Forwarded-For` value; retain the trusted-hop rule from `backend/app/security.py::client_ip` lines 199-217.

### 2. Officer auth and explicit Supabase clients

**Apply to:** `frontend/src/lib/supabase/admin.ts`, `frontend/src/lib/supabase/server.ts`, all repositories, officer routes, and dashboard Server Components.

**Primary analog:** `frontend/src/lib/auth.ts`

**Server-only and verified claims pattern** (lines 1-30):

```typescript
import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "officer" | "admin";
export type Session = { role: Role; userId: string };

// ...roleFromClaims validates sub and app_metadata.role...

export async function getClaims(): Promise<Session | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    return roleFromClaims(data.claims);
  } catch {
    return null;
  }
}
```

**Cookie-aware user-scoped client:** `frontend/src/lib/supabase/server.ts` lines 4-25 uses `createServerClient`, the publishable key, `cookies().getAll()`, and guarded `setAll()`. Preserve this as the officer/RLS client.

**Client-selection contract:** `backend/app/services/supabase.py` lines 87-101:

```python
def get_client(self, caller_token: str | None = None) -> Client:
    if caller_token and self.settings.supabase_url:
        options = SyncClientOptions(
            headers={"Authorization": f"Bearer {caller_token}"},
            auto_refresh_token=False,
            persist_session=False,
        )
        return create_client(
            self.settings.supabase_url,
            self.settings.supabase_publishable_key,
            options=options,
        )
    if self.service_role_client is None:
        raise RuntimeError("Supabase client is not configured (missing URL or keys)")
    return self.service_role_client
```

**Phase 7 difference:** make the choice explicit at construction/call sites, not an optional token hidden inside repository methods. Officer reads/writes receive the cookie/JWT-scoped client and remain subject to RLS. The service-role client is `server-only`, uses a non-`NEXT_PUBLIC_` secret, disables session persistence/refresh, and is restricted to public ingest, access-token verification, migration, readiness, and private Storage operations. No component or officer handler may import it.

### 3. Domain schemas, AI port, and synchronous report orchestration

**Apply to:** `domain/report-analysis.ts`, `validation/analysis-policy.ts`, `ai/provider.ts`, `ai/openai-compatible.ts`, and `services/report-service.ts`.

**Contract analog:** `backend/app/schemas.py` lines 7-39.

```python
class Category(StrEnum):
    POTHOLE = "pothole"
    FLOODING = "flooding"
    WASTE = "waste"
    STREETLIGHT = "streetlight"
    OBSTRUCTION = "obstruction"
    OTHER = "other"

class ReportAnalysis(BaseModel):
    category: Category
    severity: int = Field(ge=1, le=5)
    confidence: float = Field(ge=0, le=1)
    summary: str = Field(min_length=5, max_length=500)
    recommendation: str = Field(min_length=5, max_length=1000)
    priority: Priority
    estimated_impact: str = Field(min_length=3, max_length=500)
    evidence: list[str] = Field(default_factory=list, max_length=8)
    uncertainty: list[str] = Field(default_factory=list, max_length=8)

class AnalyzeResponse(BaseModel):
    report_id: str
    analysis: ReportAnalysis
    persisted: bool
    access_token: str | None = None
```

Translate this once to strict Zod schemas and inferred TypeScript types. Generate the outbound JSON Schema from that same Zod schema. Also port the citizen and analytics DTOs from `backend/app/schemas.py` lines 42-115, including the citizen-safe history shape and analytics `from`/`to` aliases.

**Advisory policy analog:** `backend/app/services/gemini.py` lines 8-13:

```python
SYSTEM_INSTRUCTION = """You analyze urban incident reports for triage support.
Return evidence-based output only. Do not invent facts not visible in the image or text.
Severity scale: 1 cosmetic, 2 minor, 3 service disruption, 4 safety risk, 5 immediate danger.
Priority must reflect severity, affected people, urgency, and uncertainty.
When evidence is insufficient, lower confidence and state uncertainty.
This is decision support, not an autonomous final decision."""
```

**Provider interface behavior analog:** `GeminiAnalyzer.analyze` lines 27-46 assembles text plus optional image, uses low temperature, demands JSON shaped by `ReportAnalysis`, rejects empty output, and parses through the runtime schema.

**Phase 7 difference:** do not copy imports, client creation, Vertex flags, Google project/location, or `Gemini` naming. The new adapter uses native `fetch`, an environment-only normalized HTTPS base URL plus fixed `chat/completions` path, `redirect: "error"`, `AbortSignal.timeout`, a bounded response read, strict JSON-schema response format, optional image content, and generic errors. Return `{ analysis, lineage }`, where lineage records the configured non-secret provider label, actual response model, request ID, and latency. Never return/log API keys, endpoint URLs, authorization headers, descriptions, evidence bytes, or upstream bodies.

**Report service orchestration contract:** `backend/app/api/reports.py::analyze_report` lines 115-184. Preserve input bounds, image MIME/byte validation before Storage/AI, optional context enrichment behavior if still in scope, evidence upload, persistence, issue-once access token, and stable response shape. Keep the path synchronous in Phase 7; no queue, worker, retry lifecycle, `manual_review` state, or durable triage-run tables.

### 4. Reports repository, citizen tokens, atomic status, analytics, and exports

**Apply to:** `repositories/reports.ts`, `repositories/analytics.ts`, `security/access-tokens.ts`, `exports/reports.ts`, and the backend-contract/analytics migrations.

**Repository analog:** `backend/app/services/supabase.py::SupabaseReportSink`.

Preserve its public method responsibilities: `insert` (line 103), filter mapping (149), row mapping (177), keyset pagination (213), `list_recent` (243), `summary` (300), geo pins (391), filtered iteration (459), status update (518), report/image/history lookups (542-599), access tokens (600-630), and citizen-safe status projection (631-665).

**Citizen-safe projection** (lines 631-665):

```python
report_response = (
    client.table("reports")
    .select("report_id, summary, current_status")
    .eq("report_id", report_id)
    .limit(1)
    .execute()
)
events_response = (
    client.table("status_events")
    .select("status, note, created_at")
    .eq("report_id", report_id)
    .order("created_at", desc=True)
    .execute()
)
```

Do not add actor IDs, descriptions, evidence references, provider failures, or officer-only metadata to this projection.

**Access-token analog:** `backend/app/services/tokens.py` lines 6-16 and 19-48:

```python
plaintext = secrets.token_urlsafe(32)
token_hash = hash_access_token(plaintext)
expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)

def hash_access_token(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()
```

Port with Node `randomBytes`/base64url, SHA-256, UTC expiry, report binding, and timing-safe report-ID comparison. Only the hash is persisted; plaintext is returned once. `backend/app/api/reports.py` lines 187-211 is the error contract: hash first, bind report and expiry, return one uniform 401 for missing report, bad token, wrong report, or expired token.

**Known anti-pattern to fix:** `backend/app/services/supabase.py` lines 518-540 inserts `status_events` and updates `reports` in two separate calls. Do **not** copy this. Create one Postgres RPC that validates status/note/role, updates the report, inserts the event, records the actor, and commits atomically. Use a user-scoped client and `SECURITY INVOKER` so RLS remains effective.

**Analytics analogs:** preserve the DTO and query semantics from `backend/app/services/analytics.py`: total, daily volume, category mix, SLA, hotspots, public last-30-day count/top categories, 366-day maximum, explicit empty flag, and public k>=3 category threshold. Put aggregation in Postgres views/RPCs and map returned rows in TypeScript. Follow the typed parameter/filter pattern of `supabase/migrations/20260721120002_geo_pins_rpc.sql` lines 2-23 and explicit grant pattern at lines 87-88, but prefer `SECURITY INVOKER` for officer data operations.

**Export analog:** `backend/app/api/reports.py` lines 401-480. Preserve identical filters, officer auth, CSV/XLSX only, 10k soft cap, attachment names/headers, and streaming/bounded-memory behavior. The current CSV response pattern is lines 440-449:

```python
rows = get_sink().iter_filtered(**filter_kwargs)
return StreamingResponse(
    _csv_iter(rows),
    media_type="text/csv",
    headers={"Content-Disposition": 'attachment; filename="reports.csv"'},
)
```

Phase 7 must additionally neutralize cells beginning with `=`, `+`, `-`, or `@` consistently in CSV and XLSX before writing citizen-controlled values.

### 5. Evidence Storage-only service and authenticated streaming

**Apply to:** `services/evidence-service.ts`, evidence Route Handlers, and the evidence-path migration.

**Upload/path analog:** `backend/app/services/storage.py` lines 37-54:

```python
ext = MIME_EXT.get(mime_type)
if not ext:
    raise RuntimeError(f"Unsupported image MIME type: {mime_type}")

object_name = f"reports/{report_id}/evidence.{ext}"
self.client.storage.from_(self.bucket_name).upload(
    path=object_name,
    file=image_bytes,
    file_options={"content-type": mime_type, "x-upsert": "true"}
)
return f"supabase://{self.bucket_name}/{object_name}"
```

**Preserve:** deterministic report-scoped keys, JPEG/PNG/WebP allowlist, private bucket, MIME retention, server-side download, and authenticated response streaming.

**Phase 7 differences:** use `file-type` magic-byte detection and validate `Content-Length`, `File.size`, byte cap, detected MIME, and optional dimensions before Storage or AI. Use `upsert: false`; do not overwrite evidence silently. Persist a provider-neutral path such as `reports/{reportId}/evidence.ext`, not `gs://` or a public URL. If DB persistence fails after upload, compensate by deleting the newly uploaded object. Remove `gcs_client` and the `gs://` read branch only after signed object reconciliation.

**SQL analog and correction:** `supabase/migrations/20260720120001_foundation.sql` lines 81-93 creates a private bucket and officer select policy. Preserve private bucket/file-size/MIME configuration. Tighten the existing broad public insert policy; trusted server uploads should use the service role, and no anonymous direct upload path should be opened by Phase 7.

### 6. Rate limiting and stable errors

**Apply to:** `security/rate-limit.ts`, public routes, and shared HTTP error mapping.

**Analog:** `backend/app/security.py` lines 24-50 and 199-251.

```python
report_limiter = SlidingWindowLimiter()
status_limiter = SlidingWindowLimiter()
public_stats_limiter = SlidingWindowLimiter()

key = f"status:{client_ip(request)}"
if not status_limiter.allow(key, limit):
    raise HTTPException(
        429,
        "Status lookup rate limit exceeded",
        headers={"Retry-After": "60"},
    )
```

Preserve independent keyspaces/limits for analyze, citizen status, and public stats; trusted-proxy client-IP derivation; 429 responses; and `Retry-After: 60`. A process-local limiter matches present semantics for one laptop Node process. Do not imply distributed durability.

At every Route Handler boundary, use guard clauses and map internal/provider/database failures to stable generic JSON. Preserve intentional 4xx/404/429 errors. Do not reproduce legacy messages that interpolate exception text (for example `Status update failed: {exc}` or `Image fetch failed: {exc}`), because those can expose upstream details.

### 7. Supabase migrations: additive cutover, RLS, and RPCs

**Apply to:** the three new Phase 7 migrations and SQL tests.

**Analog:** `supabase/migrations/20260720120001_foundation.sql` lines 39-93.

```sql
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_reports_officer_admin ON public.reports
    FOR SELECT
    USING (public.is_officer_or_admin());

-- access_tokens has no general-user policy; service role bypasses RLS

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence', 'evidence', false, 10485760,
       ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
```

**Conventions to preserve:** immutable prior migrations, additive/idempotent DDL where practical, explicit indexes, RLS enabled on every application table, deny-by-default access-token table, role checks from JWT `app_metadata`, explicit function grants, fixed `search_path`, and SQL comments naming the behavior being protected.

**Required differences:**

- Add `evidence_path` (final discretionary name), backfill the current `supabase://` row, switch readers/writers, verify no active `gs://`, then remove the legacy column in a later gated step. Never rewrite the applied foundation migration.
- Implement atomic report+token creation and atomic report-status+event transitions as transactional RPCs.
- Prefer `SECURITY INVOKER`; if any helper must be `SECURITY DEFINER`, pin `search_path`, revoke public execution, grant narrowly, and add privilege tests.
- Implement analytics views/RPCs and supporting indexes in Postgres. Derived analytics are rebuilt from canonical operational rows, not maintained as a second source of truth.
- Add SQL tests for anonymous denial, authenticated officer/admin access, non-officer denial, service-role-only token lookup, private evidence, atomic rollback, analytics parity, and legacy-column cutover.

### 8. Wave 0 tests and golden contracts

**Apply to:** `vitest.config.mts`, `src/server/**/*.test.ts`, `tests/contracts/fastapi-golden/**`, `tests/migration/**`, and retained `.mjs` architecture tests.

**Existing frontend convention:** `frontend/tests/citizen-status.test.mjs` lines 1-9:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const src = (...parts) => path.join(root, 'src', ...parts);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');
```

These tests use named requirements/decisions in descriptions, explicit failure messages, filesystem existence checks, source-string architecture assertions, and EN/VI catalog parity. Preserve them as inexpensive architecture guards, but update assertions that require FastAPI, `backendEndpoint`, or `officerFetch`.

**Vitest difference:** new server tests must execute behavior, not merely inspect strings. Use dependency injection for Supabase clients, clock/randomness, provider fetch, and rate limiter state. Organize by the production module and assert exact status, JSON, headers, auth client selection, RLS-sensitive calls, privacy projection, timeout/refusal/error mapping, lineage, upload compensation, filter/cursor validation, formula neutralization, and transaction RPC calls.

**Golden fixture source:** capture sanitized cases from:

- `backend/tests/test_analyze.py` — multipart/text/image, byte/MIME limits, persistence and generic 502
- `backend/tests/test_citizen_status.py` and `test_access_tokens.py` — issue-once token, binding, expiry, uniform 401, actor omission
- `backend/tests/test_reports.py`, `test_geo_pins.py`, `test_export.py` — filters, keyset cursor, 404s, note rule, headers and formats
- `backend/tests/test_analytics_api.py`, `test_public_stats.py`, `test_analytics_views.py` — date bounds, empty state, privacy threshold and aggregate formulas
- `backend/tests/test_security.py` — roles, malformed/expired tokens, separate rate-limit keyspaces and `Retry-After`
- `backend/tests/test_storage.py` — private upload/download path and MIME behavior

`frontend/package.json` currently uses the compact script style at lines 5-9. Extend it with `test:unit = vitest run`, `test:legacy = node --test tests/*.test.mjs`, `test`, `smoke:production`, and `audit:google-exit`. Human-verification of the official Vitest package/version is a Wave 0 checkpoint before installation.

### 9. Migration, reconciliation, smoke, audit, and laptop scripts

**Apply to:** all `frontend/scripts/*` files listed in the classification table.

**PowerShell analog:** `scripts/seed_officer_role.ps1` lines 1-24.

```powershell
param(
    [Parameter(Mandatory = $true)]
    [string]$Email
)

$backendEnv = Join-Path $PSScriptRoot "..\backend\.env"
if (-not (Test-Path $backendEnv)) {
    Write-Error "backend/.env not found. Configure SUPABASE_URL and SUPABASE_SECRET_KEY first."
    exit 1
}
```

Preserve mandatory typed parameters, `$PSScriptRoot`-relative paths, guard clauses, native PowerShell HTTP/cmdlet use, clear `Write-Error`, nonzero failure exits, and concise success output. Phase 7 scripts must read the frontend environment/config path and never print secrets.

**Migration/reconciliation pattern:** source access is read-only; write deterministic manifests containing row/object IDs, counts, timestamp bounds, null distributions, canonical row hashes, daily/category/status aggregates, object size/MIME/SHA-256, conflicts, tool version, timestamp, and pass/fail. An exit code of zero is not the deletion gate. Preserve a pre-cutover DB dump, separate Storage backup, signed manifest, and last Python-capable revision until restore/application rollback are rehearsed.

**Production smoke pattern:** build/start the real production server, bind loopback by default, poll liveness and readiness, exercise representative public/officer behavior, stop gracefully, and fail if the process exits, the port is wrong, readiness is 503, or secrets appear in logs. Normal readiness checks configuration and Supabase connectivity without spending provider tokens; live AI capability is a separate authenticated/manual smoke.

**Google-exit audit pattern:** parse manifests and exact forbidden imports/env names/URLs/files; scan active source/config/docs, ignored local env key names, clean build output, process command line, scheduled task definition, open bind address, and signed reconciliation artifacts. Allow only exact `next/font/google` use in `frontend/src/lib/fonts.ts` and corresponding design documentation. Applied historical migrations and `.planning/phases/**` are provenance, not active runtime; verify current schema separately. Do not fail on unrelated transitive package strings such as Docker detection or a Python license.

### 10. Health, startup, backup, restore, and documentation

**Apply to:** health/readiness handler, Task Scheduler registration, backup/restore scripts, env examples, README, AGENTS generated sections, and codebase docs.

**Health contract analog:** `backend/app/main.py::health` provides the liveness concept. Implement separate cheap liveness and dependency-aware readiness. Return only public dependency name/status/latency, `Cache-Control: no-store`, 200 when ready and 503 when degraded; never expose URLs, SQL errors, models, keys, or provider bodies.

**Direct-laptop conventions:** use pinned Node 22, `npm ci`, `next build`, and `next start`; set an explicit absolute working directory in Task Scheduler; keep a non-secret log path and restart policy; and verify startup after reboot/logon plus automatic restart after forced termination. Do not introduce PM2 or CityMind Docker orchestration.

**Backup boundary:** discover the existing self-hosted Supabase operator's supported Postgres backup mechanism before writing assumptions into scripts. Database dump and Storage object backup are separate artifacts. Restore into an isolated target and compare the same manifests used for migration reconciliation.

**Documentation difference:** current active docs still describe FastAPI, Gemini, BigQuery, GCS, Cloud Run, and Docker. Replace active instructions with the single Next.js process, generic third-party API key configuration, existing self-hosted Supabase, startup/restart, health, backup/restore, and Google-exit constraints. Historical phase artifacts remain untouched.

## Shared Patterns

### Server-only imports

**Source:** `frontend/src/lib/auth.ts:1`

```typescript
import "server-only";
```

**Apply to:** environment validation, admin client, repositories, AI adapter, security/token utilities, report/evidence services, exports, and migration helpers imported by the app. No secret-bearing module may be reachable from a client component.

### Authentication and authorization

**Source:** `frontend/src/lib/auth.ts:21-30`

Use `supabase.auth.getClaims()` and require `officer|admin`; do not authorize from `getSession()` alone. Use `requireOfficerSession()` for pages and an explicit JSON 401 guard for API handlers. After claims validation, pass the user-scoped Supabase client to repositories so RLS remains defense in depth.

### Validation

Use one strict Zod definition per boundary and infer types from it. Validate environment, query/path/body/form inputs, DB/RPC rows, provider output, and public API responses. Keep guard clauses and exact bounds from Pydantic/FastAPI. Image validation additionally uses magic bytes, not extension or request MIME.

### Error handling and privacy

Return stable `{ detail: string }`-style errors and preserve contract status codes/headers. Log only a generated correlation ID and safe operation/result metadata. Never log or return access tokens, token hashes, citizen descriptions, evidence bytes, service-role/third-party keys, authorization headers, configurable endpoint URLs, raw SQL/upstream errors, or provider response bodies. Citizen token failures are uniform 401s.

### Database transactions

All multi-table state changes use one database RPC. Storage cannot join the DB transaction, so upload first only after validation and delete the object if subsequent report persistence fails. Repository methods receive an explicit client and do not silently elevate to service role.

### Naming and imports

Use direct `@/server/...` or `@/lib/...` imports rather than new barrels. TypeScript functions/variables are `camelCase`, constants are `UPPER_SNAKE_CASE`, route/page components remain default exports where applicable, and utilities use named exports. Keep external imports separated from internal imports and use `import type` for type-only dependencies.

## No Analog Found

| File/Module | Role | Data Flow | Reason / Planner Direction |
|---|---|---|---|
| `frontend/src/server/config/env.ts` full implementation | config | request-response | No existing Zod environment module; use the `07-RESEARCH.md` `server-only` `EnvSchema.parse(process.env)` pattern and reject unsafe AI base URLs. |
| `frontend/src/server/ai/openai-compatible.ts` protocol details | provider | request-response | No provider-neutral TypeScript adapter exists; use research protocol pattern, native fetch, and live capability gate. Do not adapt Google client code beyond the input/output contract. |
| `frontend/scripts/google-exit-audit.mjs` | utility/test | batch | No manifest-aware audit exists; implement from the research audit method and test false-positive allowlists. |
| `frontend/scripts/backup-citymind.ps1` / `restore-citymind.ps1` operational commands | utility | file-I/O/batch | Exact commands depend on the self-hosted Supabase operator and installed compatible tools; planning must include a blocking discovery/checkpoint and isolated restore drill. |

## Deletion and Cutover Guardrails

- Keep the Python backend and Google migration readers runnable until golden contract parity, BigQuery/GCS inventory, signed reconciliation, backup, and restore gates pass.
- Never treat current `gs://` row count as proof that GCS has no orphan objects.
- Do not edit immutable applied migrations to rename `image_gcs_uri`; add and later remove through new migrations.
- Do not delete remote Google resources without separate authorization. This phase removes CityMind dependencies/configuration and can inventory remote state; destructive remote cleanup must remain explicitly authorized.
- Final cleanup removes backend/Python manifests and caches, Google SDK/config/env/tests, BigQuery ETL/views/jobs, GCS compatibility, Cloud Run/Build/Scheduler/deployment assets, CityMind Dockerfiles/compose/images, `BACKEND_API_URL`, stale tests, and active docs only after all gates pass.
- Google Fonts is the sole exact allowlist exception.

## Metadata

**Analog search scope:** `frontend/src`, `frontend/tests`, `backend/app`, `backend/tests`, `supabase/migrations`, `scripts`
**Strong analog families:** 5
**Concrete source files read:** 18
**Pattern extraction date:** 2026-07-21
**Working-tree policy:** only this `07-PATTERNS.md` artifact was written; unrelated modified/untracked/deleted files were preserved.
