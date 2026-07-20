---
phase: 05-analytics-pipeline
reviewed: 2026-07-21T05:05:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - backend/app/jobs/etl_supabase_to_bigquery.py
  - backend/app/jobs/__init__.py
  - infra/bigquery/reports_analytics.sql
  - infra/bigquery/status_events_analytics.sql
  - infra/bigquery/etl_watermarks.sql
  - infra/bigquery/analytics_views.sql
  - backend/app/services/supabase.py
  - backend/app/services/bigquery.py
  - backend/app/api/analytics.py
  - backend/app/services/analytics.py
  - backend/app/schemas.py
  - backend/app/security.py
  - backend/app/config.py
  - backend/app/main.py
  - backend/.env.example
  - frontend/src/app/api/public/stats/route.ts
  - frontend/src/components/analytics/PublicStatsStrip.tsx
  - frontend/src/app/dashboard/analytics/page.tsx
  - frontend/src/app/dashboard/analytics/loading.tsx
  - frontend/src/components/ui/chart.tsx
  - frontend/src/components/analytics/DateRangeToolbar.tsx
  - frontend/src/components/analytics/VolumeChart.tsx
  - frontend/src/components/analytics/CategoryChart.tsx
  - frontend/src/components/analytics/SlaChart.tsx
  - frontend/src/components/analytics/HotspotTable.tsx
  - frontend/src/components/analytics/ChartBlock.tsx
  - frontend/src/components/analytics/AnalyticsErrorAlert.tsx
  - frontend/src/components/analytics/types.ts
  - frontend/src/components/DashboardSidebar.tsx
  - frontend/src/app/[locale]/page.tsx
  - frontend/messages/en.json
  - frontend/messages/vi.json
  - frontend/package.json
findings:
  critical: 1
  warning: 5
  info: 1
  total: 7
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-21T05:05:00Z  
**Depth:** standard  
**Files Reviewed:** 33  
**Status:** issues_found

## Summary

Phase 05 delivers a coherent analytics pipeline: privacy-projected ETL with dual watermarks, parameterized BigQuery reads, officer JWT-gated `/api/v1/analytics`, k≥3 public category filtering, Next BFF for `/api/public/stats`, and a bilingual officer dashboard with recharts. Privacy allowlists, parameterized SQL, and server-side k-anonymity are implemented correctly for the stated D-16/D-17 requirements.

One **BLOCKER** was found in ETL watermark handling during `--full-reload` against the live `BigQueryAnalyticsWarehouse` store: empty or partial reloads can leave stale high-water marks after table truncation, causing subsequent incremental runs to skip historical data. Several **WARNING**-level robustness and disclosure issues remain around watermark monotonicity, UTC date boundaries, SSR rate-limit bypass, and error surfacing.

Per review instructions: missing live GCP deployment and the pre-existing `ReportStarterBar` import gap were not scored as findings.

## Critical Issues

### CR-01: `--full-reload` does not reset BigQuery watermarks when batch is empty

**File:** `backend/app/jobs/etl_supabase_to_bigquery.py:247-258`, `backend/app/services/bigquery.py:308-315`  
**Issue:** On `--full-reload`, `load_analytics_batch` truncates `reports_analytics` and `status_events_analytics`, but `run_etl` only clears watermarks when the store exposes an in-memory `.values` dict (`FakeWatermarkStore`). Production `BigQueryAnalyticsWarehouse` has no such attribute, so when the extract batch is empty (`max_report_created_at` / `max_event_created_at` are `None`), watermarks remain at their pre-truncate high-water marks. The next incremental run then extracts only rows newer than the stale watermark while BigQuery tables are empty — **silent analytics data loss** until manual watermark repair.

**Fix:**
```python
# In run_etl, after successful load when full_reload=True:
if full_reload:
    if max_report is not None:
        watermarks.set(PIPELINE_REPORTS, max_report)
    elif hasattr(watermarks, "clear_watermark"):
        watermarks.clear_watermark(PIPELINE_REPORTS)
    # same pattern for events

# Add to BigQueryAnalyticsWarehouse:
def clear_watermark(self, pipeline: str) -> None:
    merge = f"""
    MERGE `{self.watermarks_table}` T
    USING (SELECT @pipeline AS pipeline, CAST(NULL AS TIMESTAMP) AS watermark, @updated_at AS updated_at) S
    ON T.pipeline = S.pipeline
    WHEN MATCHED THEN UPDATE SET watermark = NULL, updated_at = S.updated_at
    """
    # ... execute with ScalarQueryParameter ...
```

Alternatively, call watermark reset inside `load_analytics_batch` immediately after `_truncate` when `full_reload=True`.

## Warnings

### WR-01: Reports watermark can regress on dimension-refresh-only batches

**File:** `backend/app/jobs/etl_supabase_to_bigquery.py:247-248`  
**Issue:** Watermark advance uses `max(created_at)` from the current batch only. Incremental runs that contain only status-driven dimension refreshes for older reports can set the reports watermark **below** the stored value. This forces redundant re-extraction and, in edge cases where older rows were never loaded, can permanently skip reports with `created_at` below the regressed watermark.

**Fix:** Advance monotonically:
```python
current = watermarks.get(PIPELINE_REPORTS)
if max_report is not None:
    next_wm = max(current, max_report) if current else max_report
    watermarks.set(PIPELINE_REPORTS, next_wm)
```

### WR-02: Public stats window uses local `date.today()` instead of explicit UTC

**File:** `backend/app/services/analytics.py:70-71`  
**Issue:** `fetch_public_stats` documents a "last 30d UTC window" (plan 05-02) but uses `date.today()`, which follows the server OS timezone. Near UTC midnight or on hosts not running UTC, the 30-day window can shift by one day relative to `DATE(created_at)` semantics in BigQuery.

**Fix:**
```python
from datetime import datetime, timezone
date_to = datetime.now(timezone.utc).date()
date_from = date_to - timedelta(days=PUBLIC_STATS_WINDOW_DAYS - 1)
```

### WR-03: Home SSR stats path bypasses per-client rate limiting

**File:** `frontend/src/components/analytics/PublicStatsStrip.tsx:17-19`  
**Issue:** `PublicStatsStrip` calls `backendEndpoint("/api/v1/public/stats")` directly from the Next server without forwarding `X-Forwarded-For`. Backend `enforce_public_stats_rate_limit` keys on `client_ip(request)`, so all SSR fetches share the Next server's IP. Per-user rate limits are ineffective on the primary Home render path; only the optional BFF route applies client IP forwarding.

**Fix:** Route SSR through the BFF (`/api/public/stats`) with forwarded headers, or pass a trusted `X-Forwarded-For` from Next middleware when calling the backend directly.

### WR-04: Officer analytics 502 leaks internal exception text

**File:** `backend/app/api/analytics.py:40-41`  
**Issue:** `raise HTTPException(502, f"Analytics query failed: {exc}")` exposes BigQuery/SDK error strings to authenticated officers. This can leak dataset names, SQL fragments, or infrastructure details useful for reconnaissance.

**Fix:** Log the exception server-side and return a generic message:
```python
logger.exception("Analytics query failed")
raise HTTPException(502, "Analytics query failed") from exc
```

### WR-05: Frontend does not surface 366-day span validation

**File:** `frontend/src/components/analytics/types.ts:63-79`, `frontend/src/app/dashboard/analytics/page.tsx:29-30`  
**Issue:** `resolveAnalyticsRange` validates custom `from <= to` only. Ranges exceeding 366 days return HTTP 422 from the backend but the page maps any non-OK response to a generic `"load"` error, so officers cannot distinguish invalid span from warehouse/API failure.

**Fix:** Parse 422 responses in `loadAnalytics` and show `invalidDates` / a dedicated span-exceeded message from `dashboard.analytics` catalogs.

## Info

### IN-01: Misconfigured BigQuery shows misleading public zero stats

**File:** `backend/app/services/analytics.py:72-73`, `frontend/src/components/analytics/PublicStatsStrip.tsx:40-42`  
**Issue:** When BigQuery is disabled, `fetch_public_stats` returns `{ total_last_30d: 0, top_categories: [] }` with HTTP 200. `PublicStatsStrip` renders a "0 reports" snapshot instead of hiding (degrade path is only for fetch failures). Operators may misread a configuration outage as an empty community.

**Fix:** Return 503 when analytics warehouse is unavailable, or have the strip treat `empty warehouse + zero totals` as hide when `ENABLE_BIGQUERY=false`.

---

_Reviewed: 2026-07-21T05:05:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
