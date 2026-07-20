# Phase 5: Analytics Pipeline - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 28
**Analogs found:** 24 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `infra/bigquery/etl_watermarks.sql` | migration | batch | `infra/bigquery/create_status_events.sql` | role-match |
| `infra/bigquery/analytics_views.sql` | migration | transform | `infra/bigquery/schema.sql` | role-match |
| `infra/bigquery/schema.sql` (adapt analytics tables) | migration | file-I/O | `infra/bigquery/schema.sql` | exact |
| `infra/bigquery/create_status_events.sql` (adapt) | migration | file-I/O | `infra/bigquery/create_status_events.sql` | exact |
| `backend/app/jobs/etl_supabase_to_bigquery.py` | service | batch | `scripts/migrate_bigquery_to_supabase.py` | exact |
| `backend/app/services/analytics.py` | service | request-response | `backend/app/services/bigquery.py` (`summary` / parameterized query) | exact |
| `backend/app/services/bigquery.py` (extend read/load) | service | CRUD + batch | `backend/app/services/bigquery.py` | exact |
| `backend/app/services/supabase.py` (extract helpers) | service | CRUD | `backend/app/services/supabase.py` (`list_recent` / service-role client) | exact |
| `backend/app/api/analytics.py` | route | request-response | `backend/app/api/reports.py` (`/summary`, `/status`) | exact |
| `backend/app/main.py` (include router) | config | request-response | `backend/app/main.py` | exact |
| `backend/app/security.py` (`public_stats_limiter`) | middleware | request-response | `backend/app/security.py` (`status_limiter`) | exact |
| `backend/app/config.py` (public stats rate limit) | config | — | `backend/app/config.py` | exact |
| `backend/app/schemas.py` (analytics DTOs) | model | request-response | `backend/app/schemas.py` (`CitizenStatusResponse`) | role-match |
| `scripts/deploy_etl_job.*` | config | batch | `scripts/deploy_cloudrun.ps1` | role-match |
| `frontend/src/app/dashboard/analytics/page.tsx` | route | request-response | `frontend/src/app/dashboard/page.tsx` | exact |
| `frontend/src/components/DashboardSidebar.tsx` | component | request-response | `frontend/src/components/DashboardSidebar.tsx` | exact |
| `frontend/src/components/analytics/DateRangeToolbar.tsx` | component | request-response | `frontend/src/app/[locale]/status/page.tsx` + `StatusActions.tsx` | partial |
| `frontend/src/components/analytics/VolumeChart.tsx` | component | transform | *(none — shadcn chart)* | none |
| `frontend/src/components/analytics/CategoryChart.tsx` | component | transform | *(none — shadcn chart)* | none |
| `frontend/src/components/analytics/SlaChart.tsx` | component | transform | *(none — shadcn chart)* | none |
| `frontend/src/components/analytics/HotspotTable.tsx` | component | request-response | `frontend/src/components/dashboard/ReportCard.tsx` | role-match |
| `frontend/src/components/analytics/PublicStatsStrip.tsx` | component | request-response | `frontend/src/app/[locale]/page.tsx` (section cadence) | partial |
| `frontend/src/components/ui/chart.tsx` | component | — | *(shadcn add — no local analog)* | none |
| `frontend/src/app/api/public/stats/route.ts` (optional BFF) | route | request-response | `frontend/src/app/api/public/reports/status/route.ts` | exact |
| `frontend/src/app/[locale]/page.tsx` (insert strip) | route | request-response | `frontend/src/app/[locale]/page.tsx` | exact |
| `frontend/messages/{en,vi}.json` | config | — | `frontend/messages/en.json` | exact |
| `backend/tests/test_etl_*.py` / `test_analytics_*.py` / `test_public_stats.py` | test | request-response | `backend/tests/test_citizen_status.py`, `test_bigquery.py`, `test_migrate_*` | exact |
| `frontend/tests/analytics-shell.test.mjs` / `public-stats.test.mjs` | test | — | `frontend/tests/dashboard-shell.test.mjs` | exact |

## Pattern Assignments

### `backend/app/jobs/etl_supabase_to_bigquery.py` (service, batch)

**Analog:** `scripts/migrate_bigquery_to_supabase.py`

**Imports / CLI bootstrap** (lines 1–35):
```python
import argparse
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.config import Settings  # noqa: E402
from google.cloud import bigquery
from supabase import create_client


def parse_args():
    parser = argparse.ArgumentParser(...)
    parser.add_argument("--apply", action="store_true", ...)
    parser.add_argument("--dry-run", action="store_true", ...)
    return parser.parse_args()
```

**Core batch + non-zero exit** (lines 55–63, 181–189):
```python
def migrate(settings, apply=False, dry_run=False, verify=False):
    reports, events = fetch_bigquery_data(settings)
    if dry_run:
        print("Dry run complete. No modifications made to Supabase.")
        return 0
    # ... write path ...
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
```

**Copy for ETL:** Same argparse flags spirit (`--full-reload` instead of `--apply`); service-role Supabase client (`settings.supabase_secret_key`); `sys.exit(non_zero)` on load/watermark failure (D-03). Prefer job under `backend/app/jobs/` with `python -m app.jobs.etl_supabase_to_bigquery` entry for Cloud Run Job.

**Privacy projection (must add — no legacy sync of forbidden cols):** Mirror migration’s selective field mapping, but **omit** `description`, `image_gcs_uri`, `evidence`, `summary`, `note`, `actor_id`, and never touch `access_tokens`.

---

### `backend/app/services/analytics.py` + `bigquery.py` read path (service, request-response)

**Analog:** `backend/app/services/bigquery.py`

**Imports + client gate** (lines 1–24):
```python
import json
from datetime import datetime, timezone

from google.cloud import bigquery

from app.config import Settings


class BigQueryReportSink:
    def __init__(self, settings: Settings):
        self.enabled = settings.enable_bigquery
        self.table_id = (
            f"{settings.google_cloud_project}."
            f"{settings.bigquery_dataset}.{settings.bigquery_reports_table}"
        )
        self.client = (
            bigquery.Client(project=settings.google_cloud_project)
            if self.enabled
            else None
        )
```

**Parameterized query pattern** (lines 38–78) — **reuse for officer analytics date filters**:
```python
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("limit", "INT64", limit),
                bigquery.ScalarQueryParameter("status", "STRING", status),
                # ...
            ]
        )
        rows = self.client.query(query, job_config=job_config).result()
        return [dict(row) for row in rows]
```

**Aggregate summary shape** (lines 110–139) — closest existing “analytics DTO” from warehouse:
```python
    def summary(self) -> dict:
        if not self.enabled or self.client is None:
            return {
                "total_reports": 0,
                "critical_reports": 0,
                "avg_severity": 0,
                "top_category": "none",
            }
        # SQL aggregate → dict(row)
```

**Anti-pattern to avoid for ETL load:** `insert_rows_json` streaming (lines 103–108) — RESEARCH requires load job + `MERGE` for analytics tables, not ops-style streaming inserts.

---

### `backend/app/services/supabase.py` extract helpers (service, CRUD)

**Analog:** same file — service-role client + projected `select`

**Service-role client** (lines 37–60):
```python
class SupabaseReportSink:
    def __init__(self, settings: Settings):
        self.enabled = bool(settings.supabase_url and settings.supabase_secret_key)
        if self.enabled:
            self.service_role_client = create_client(
                settings.supabase_url,
                settings.supabase_secret_key,
            )

    def get_client(self, caller_token: str | None = None) -> Client:
        # ETL must use service_role_client (caller_token=None)
```

**Projected select + filters** (lines 224–240) — copy column allowlist discipline:
```python
        client = self.get_client(caller_token)
        query = client.table("reports").select(
            "*, status_events(status, note, created_at)"
        )
        # ETL: select ONLY analytics-safe columns, e.g.
        # "report_id, created_at, category, severity, priority, current_status, latitude, longitude"
```

**Status-driven refresh (no `updated_at`):** Use `status_events` created_at watermark (see `update_status` / events append in same service) to re-MERGE touched `report_id`s — do not invent `reports.updated_at` unless Wave 0 adds it.

---

### `backend/app/api/analytics.py` (route, request-response)

**Analog:** `backend/app/api/reports.py`

**Imports + auth + limiter** (lines 13–38, 45–47):
```python
from fastapi import APIRouter, Depends, HTTPException, Query

from app.security import (
    OfficerPrincipal,
    enforce_status_rate_limit,  # pattern for dedicated public limiter
    require_officer,
)

router = APIRouter()
```

**Officer aggregate endpoint** — copy `/summary` (lines 271–301):
```python
@router.get("/summary")
async def reports_summary(
    created_after: str | None = None,
    created_before: str | None = None,
    officer: OfficerPrincipal = Depends(require_officer),
):
    _validate_report_filters(...)
    try:
        return get_sink().summary(...)
    except Exception as exc:
        raise HTTPException(502, f"Database summary failed: {exc}") from exc
```

**Public rate-limited endpoint** — copy citizen status Depends pattern (lines 187–211):
```python
@router.post("/status", response_model=CitizenStatusResponse)
async def citizen_report_status(
    body: CitizenStatusRequest,
    _rate_limit: None = Depends(enforce_status_rate_limit),
) -> CitizenStatusResponse:
    ...
    except HTTPException:
        raise
    except Exception as exc:
        logging.exception("Citizen status lookup failed")
        raise HTTPException(502, "Status lookup failed") from exc
```

**Date-range validation** — copy filter guard (lines 93–112):
```python
    if (
        min_severity is not None
        and max_severity is not None
        and min_severity > max_severity
    ):
        raise HTTPException(422, "min_severity cannot exceed max_severity")
# Analytics: if from > to → 422 "Invalid date range" (UI-SPEC); clamp max span ≤366 days.
```

**Router wiring** — `backend/app/main.py` lines 4, 22:
```python
from app.api.reports import router as reports_router
app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])
# Add: include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])
# Public: prefix="/api/v1/public" or mount GET /stats on analytics router without require_officer
```

---

### `backend/app/security.py` public stats limiter (middleware, request-response)

**Analog:** same file — `status_limiter` / `enforce_status_rate_limit` (lines 47–48, 137–146)

```python
report_limiter = SlidingWindowLimiter()
status_limiter = SlidingWindowLimiter()
# Add: public_stats_limiter = SlidingWindowLimiter()

def enforce_status_rate_limit(request: Request) -> None:
    """Citizen status lookup limiter — separate keyspace from analyze (CIT-04 / D-17)."""
    limit = get_settings().status_rate_limit_per_minute
    key = f"status:{client_ip(request)}"
    if not status_limiter.allow(key, limit):
        raise HTTPException(
            429,
            "Status lookup rate limit exceeded",
            headers={"Retry-After": "60"},
        )
```

**Copy:** Dedicated instance + key prefix `stats:{ip}`; new `public_stats_rate_limit_per_minute` in `config.py` beside `status_rate_limit_per_minute` (line 18). Officer analytics uses `require_officer` only — no public limiter.

---

### `infra/bigquery/*.sql` (migration, batch/transform)

**Analog:** `infra/bigquery/schema.sql` + `create_status_events.sql`

**Table DDL style** (`schema.sql` lines 1–23):
```sql
CREATE SCHEMA IF NOT EXISTS `PROJECT_ID.citymind`
OPTIONS(location="US");

CREATE TABLE IF NOT EXISTS `PROJECT_ID.citymind.reports` (
  report_id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  ...
)
PARTITION BY DATE(created_at)
CLUSTER BY category, priority;
```

**Adapt for analytics:** New tables (e.g. `reports_analytics`) with **allowlisted columns only** — drop `description`, `image_gcs_uri`, `evidence`, `summary`, `recommendation`, `uncertainty`, `urban_context`. Status events analytics: `event_id`, `report_id`, `status`, `created_at` — **no `note`**.

**Watermarks DDL** — follow `create_status_events.sql` minimal CREATE TABLE IF NOT EXISTS style:
```sql
CREATE TABLE IF NOT EXISTS `PROJECT_ID.citymind.etl_watermarks` (
  pipeline STRING NOT NULL,
  watermark TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

---

### `frontend/src/app/dashboard/analytics/page.tsx` (route, request-response)

**Analog:** `frontend/src/app/dashboard/page.tsx`

**Officer fetch + error/empty** (lines 1–69):
```typescript
import { officerFetch } from "@/lib/backend";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

async function getRecentReports(): Promise<FetchResult<Report[]>> {
  try {
    const res = await officerFetch("/api/v1/reports/recent?limit=5", {
      cache: "no-store",
    });
    if (!res.ok) {
      return { data: [], error: `Could not load reports (HTTP ${res.status}).` };
    }
    const body = await res.json();
    return { data: body.items ?? [], error: null };
  } catch {
    return { data: [], error: "Could not connect to the CityMind API." };
  }
}
```

**Empty / error UI** (lines 44–65):
```tsx
{result.error && (
  <Alert variant="destructive">
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>...</AlertDescription>
  </Alert>
)}
{!result.error && reports.length === 0 && (
  <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
    <p className="text-lg font-medium">No reports yet</p>
    ...
  </div>
)}
```

**Auth:** Layout already calls `requireOfficerSession` (`dashboard/layout.tsx` lines 15–24) — analytics page inherits shell; no extra guard required unless page is linked outside layout.

**Fetch shape for analytics:**
```typescript
const qs = new URLSearchParams({ from, to });
const res = await officerFetch(`/api/v1/analytics?${qs}`, { cache: "no-store" });
```

---

### `frontend/src/components/DashboardSidebar.tsx` (component)

**Analog:** same file — `menuItems` array (lines 34–53)

```typescript
  const menuItems = [
    {
      title: tNav('dashboard'),
      url: '/dashboard',
      icon: FileText,
      active: pathname === '/dashboard',
    },
    // Insert Analytics after Reports/Dashboard:
    // { title: tNav('analytics'), url: '/dashboard/analytics', icon: BarChart3,
    //   active: pathname.startsWith('/dashboard/analytics') },
```

**Active styling** (lines 75–86): `isActive` → `bg-secondary text-primary` — reuse for Analytics nav accent (UI-SPEC).

---

### `frontend/src/components/analytics/DateRangeToolbar.tsx` (component, request-response)

**Analogs:** URL `searchParams` read — `frontend/src/app/[locale]/status/page.tsx` (lines 53–57); write — `StatusActions.tsx` (lines 20–24)

```typescript
const searchParams = useSearchParams();
const initialReportId = (searchParams.get("reportId") ?? "").trim();

// Write pattern:
const url = new URL(..., window.location.origin);
url.searchParams.set("status", status);
```

**Also:** server `searchParams: Promise<...>` on `login/page.tsx` / `status/page.tsx` for RSC default `range=30`.

**Contract keys (UI-SPEC):** `range=7|30|90|custom`, `from`, `to`. Invalid `from > to` → inline error, **no fetch**. Prefer `router.replace` / `Link` with query string — **no nuqs**.

---

### Chart components + `components/ui/chart.tsx` (component, transform)

**Analog:** none in repo — install via `npx shadcn@latest add chart`.

**External pattern (RESEARCH / UI-SPEC):**
```tsx
"use client"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
```

**Local UI chrome to wrap charts:** `Alert` + `Skeleton` (`frontend/src/components/ui/alert.tsx`, `skeleton.tsx`) for loading/error slots; empty = dashed empty state from dashboard page — **do not** paint zero-filled series when warehouse empty (D-10).

---

### `frontend/src/components/analytics/PublicStatsStrip.tsx` + Home insert

**Analog:** `frontend/src/app/[locale]/page.tsx` section order

Place **after** `#instructions` (lines 156–183) and **before** `#about` / contact cadence — UI-SPEC says after Instructions / before Contact (Phase 2 D-03). Prefer insert between instructions and about, or between about and contact if product order requires Contact last; CONTEXT: “after Instructions / before Contact”.

**i18n:** `getTranslations("public")` / add `public.stats` keys — never hardcode EN.

**Degrade (D-12):** try/catch around fetch; on failure render **nothing** (UI-SPEC “Hidden”) or optional muted “unavailable” line — never block Home.

---

### Optional BFF `frontend/src/app/api/public/stats/route.ts`

**Analog:** `frontend/src/app/api/public/reports/status/route.ts` (lines 1–42)

```typescript
import { backendEndpoint } from "@/lib/backend";

export async function POST(request: Request) {
  const headers = new Headers();
  // Forward X-Forwarded-For / X-Real-Ip for rate limit
  const response = await fetch(backendEndpoint("/api/v1/reports/status"), {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
  // Propagate Retry-After
  return new Response(response.body, { status: response.status, headers: outbound });
}
```

**Adapt:** `GET` proxy to `/api/v1/public/stats`; forward XFF; short `revalidate` if called from RSC.

---

### Tests

**Backend auth + rate limit:** `backend/tests/test_citizen_status.py` (limiter clear fixture lines 40–48; mock sink; TestClient) and `test_security.py` (429 + Retry-After lines 207–222).

**BigQuery FakeClient:** `backend/tests/test_bigquery.py` (lines 5–32) — parameterized query assertions.

**ETL CLI / mocks:** `backend/tests/test_migrate_bigquery_to_supabase.py` — MockBigQueryClient / MockSupabaseClient pattern for privacy projection tests.

**Frontend smoke:** `frontend/tests/dashboard-shell.test.mjs` — `fs.existsSync` + string includes for Analytics nav / URL helpers.

---

## Shared Patterns

### Authentication (officer)
**Source:** `backend/app/security.py` `require_officer` (lines 51–103); frontend `officerFetch` + layout `requireOfficerSession`
**Apply to:** `api/analytics.py` officer routes; dashboard analytics page (via layout)
```python
officer: OfficerPrincipal = Depends(require_officer)
```
```typescript
const res = await officerFetch(`/api/v1/analytics?${qs}`, { cache: "no-store" });
```

### Public rate limiting
**Source:** `enforce_status_rate_limit` — separate `SlidingWindowLimiter` + key prefix
**Apply to:** `GET /api/v1/public/stats` only (not officer analytics)

### Error handling (API)
**Source:** `reports.py` — validate → 422; service failure → 502; auth → 401/403
**Apply to:** analytics officer + public handlers; generic public errors (no warehouse internals)

### Parameterized BigQuery
**Source:** `BigQueryReportSink.list_recent` QueryJobConfig
**Apply to:** all analytics view queries (`from`/`to` as DATE/TIMESTAMP params) — never string-interpolate dates

### Empty / loading UI
**Source:** `dashboard/page.tsx` Alert + dashed empty; `ui/skeleton.tsx`
**Apply to:** Analytics chart slots; Home stats hide-on-error

### CLI / Job exit codes
**Source:** `scripts/migrate_bigquery_to_supabase.py` `sys.exit(main())`
**Apply to:** ETL job — exit ≠ 0 on failure; do not advance watermarks before confirmed load

### Privacy allowlist
**Source:** RESEARCH D-16 + citizen status DTO stripping tests
**Apply to:** ETL column projection + public k≥3 filter server-side (never UI-only)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/ui/chart.tsx` | component | — | Not in repo; add via shadcn official `chart` (recharts) |
| `VolumeChart.tsx` / `CategoryChart.tsx` / `SlaChart.tsx` | component | transform | No chart components yet — follow UI-SPEC + shadcn chart docs |
| BigQuery `MERGE` load path | service | batch | Legacy sink uses `insert_rows_json` only — use RESEARCH MERGE sketch, not ops insert |
| Cloud Scheduler → Cloud Run Job wiring | config | batch | `deploy_cloudrun.ps1` deploys API service only — new Job+Scheduler docs/script |

## Metadata

**Analog search scope:** `backend/app/`, `backend/tests/`, `frontend/src/`, `frontend/tests/`, `infra/bigquery/`, `scripts/`
**Files scanned:** ~60 (services, API, dashboard, public BFF, infra SQL, migrate/deploy scripts, tests)
**Pattern extraction date:** 2026-07-20

## PATTERN MAPPING COMPLETE
