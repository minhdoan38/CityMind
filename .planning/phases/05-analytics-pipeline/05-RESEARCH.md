# Phase 5: Analytics Pipeline - Research

**Researched:** 2026-07-20
**Domain:** Supabase → BigQuery incremental ETL, analytics SQL views, officer/public aggregate APIs, shadcn/recharts dashboard charts
**Confidence:** HIGH (architecture + official GCP/shadcn docs); MEDIUM (k-anonymity practice literature; local `gcloud` not installed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### ETL cadence & freshness
- **D-01:** Run ETL on a **daily** schedule (Cloud Scheduler → Cloud Run Job / script). Target freshness: data through **previous UTC day** available by ~06:00 local (agent may refine window in research).
- **D-02:** Prefer **incremental sync** keyed by `updated_at` / `created_at` watermarks for reports and status_events; support a **manual full reload** flag for recovery (not the default cron path).
- **D-03:** ETL failures must be **observable** (job exit non-zero + structured log); no silent skip. Alert channel is agent discretion (Cloud Logging alert or README ops note) — do not block MVP on PagerDuty.
- **D-04:** Destination remains existing BigQuery dataset/table conventions under `infra/bigquery/` (adapt schema for analytics columns + status history as needed). Supabase remains source of truth for ops.

#### Analytics tab charts (officer)
- **D-05:** MVP Analytics tab shows **three chart blocks** (not a chart kitchen-sink):
  1. **Volume over time** — reports created per day in range  
  2. **Category mix** — counts (or %) by category in range  
  3. **SLA / time-to-resolution** — distribution or median days from `new` → `resolved`/`rejected` for closed reports in range  
- **D-06:** Hotspot insight on the tab is a **ranked table/list** (top N categories or coarse area labels by volume), not a map (D-15).
- **D-07:** Analytics UI lives under the **officer dashboard** (new tab/route e.g. `/dashboard/analytics`), officer JWT only — never public.

#### Date-range UX
- **D-08:** Provide **presets**: Last 7 / 30 / 90 days + **custom** from→to date inputs.
- **D-09:** **Default = Last 30 days.** Persist selection in URL `searchParams` (same pattern as Phase 3 filters) so refresh/share keeps range.
- **D-10:** Empty range / no data → calm empty state (DASH-07 spirit); loading and error states required. Charts must not invent zeros that imply data exists when the warehouse is empty.

#### Public Home stats (Track B)
- **D-11:** **Ship a thin optional public stats strip** on locale Home: **only** non-sensitive aggregates — e.g. total reports in last 30 days + top 1–2 categories by count. No lat/lng, no descriptions, no evidence, no tokens, no officer notes.
- **D-12:** If analytics API/warehouse is unavailable, Home stats **degrade gracefully** (hide section or show “Stats unavailable”) — never block Home render.
- **D-13:** Public stats read path is **read-only aggregate API** (or cached BFF) with rate limit; do not expose raw BigQuery to the browser.

#### Hotspots without maps
- **D-14:** Phase 5 “hotspot” = **category concentration** (and optionally reverse-geocode / stored area label if already present on reports). **Do not** require PostGIS or MapLibre.
- **D-15:** Defer map pins, clustering, and bbox APIs to **Phase 6**. Analytics may store lat/lng in BigQuery for later use but UI does not plot them here.

#### Privacy boundary
- **D-16:** BigQuery analytics tables **must not** contain: access token plaintext/hashes, evidence storage URLs/paths, citizen contact fields (none today — keep it that way), officer emails. Prefer report_id, timestamps, category, priority, status, lat/lng (optional), area label, SLA intervals.
- **D-17:** Public aggregates (D-11) are **count-only / category-only** — minimum k-anonymity: if a category has **&lt; 3** reports in the window, **omit or bucket as “Other”** (agent may tune threshold in research; default 3).
- **D-18:** Officer analytics may show finer breakdowns than public, still without evidence URIs or token material.

### the agent's Discretion
- Exact Cloud Scheduler cron expression and job packaging (Cloud Run Job vs Cloud Functions)
- Chart library choice (recharts / chart.js / shadcn-compatible) — research legitimacy before install
- Whether SLA clock starts at report `created_at` or first status transition
- Exact BigQuery view SQL shape and dataset naming beyond existing `citymind` conventions
- Whether public stats are server-rendered from BFF cache vs client fetch
- Watermark storage location (BQ control table vs GCS vs Supabase meta)

### Deferred Ideas (OUT OF SCOPE)
- Interactive MapLibre hotspot map / geo clustering — Phase 6
- Real-time CDC / sub-hourly ETL — future ops maturity
- Predictive models / anomaly detection — future
- Email/Slack PagerDuty onboarding for ETL alerts — optional later
- Public “open data” portal beyond Home strip — backlog
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANLY-01 | Supabase → BigQuery ETL job syncs report/status data | Track A: Cloud Scheduler → Cloud Run Job; watermarked incremental extract; privacy column projection; MERGE/append load; full-reload flag |
| ANLY-02 | BigQuery views for category trends, SLA/time-to-resolution, hotspots | Track A: analytics-safe fact tables + SQL views (`v_volume_daily`, `v_category_mix`, `v_sla_closed`, `v_hotspot_category`); no maps |
| ANLY-03 | Dashboard analytics tab with date range selector | Track C: `/dashboard/analytics` + URL `range/from/to`; recharts via shadcn `chart`; officer JWT; Track B optional public strip |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- **Tech stack:** Keep FastAPI for AI pipeline; Supabase for ops/auth; BigQuery analytics-only post-migration. `[CITED: AGENTS.md]`
- **Security:** AI output is advisory; officers remain decision authority; access tokens must be hashed at rest — **never sync tokens into analytics**. `[CITED: AGENTS.md]` `[CITED: 05-CONTEXT.md D-16]`
- **Privacy:** Citizen status lookup is token-scoped; no cross-report data leakage — public analytics must stay aggregate-only with k-anonymity. `[CITED: AGENTS.md]` `[CITED: D-11/D-17]`
- **Compatibility:** Maintain Cloud Run deployment path; existing demo/seed data must migrate. `[CITED: AGENTS.md]`
- **Locale:** Bilingual EN/VI for citizen-facing surfaces (Track B). `[CITED: AGENTS.md]` `[CITED: 05-UI-SPEC.md]`
- **Performance:** Synchronous analyze path acceptable for MVP; **maps deferred** (aligns with D-14/D-15). `[CITED: AGENTS.md]`

## Summary

Phase 5 turns BigQuery into a **read-only analytics warehouse** fed by a **daily incremental ETL** from Supabase (ops SoT). The existing `infra/bigquery/schema.sql` and `report_status_events` tables are the destination conventions to **adapt** — not to regain ops CRUD. `[VERIFIED: infra/bigquery/schema.sql]` `[VERIFIED: 05-CONTEXT.md D-04]` Critical codebase finding: Supabase `reports` has **no `updated_at`**; status changes update `current_status` in place and append `status_events`. `[VERIFIED: supabase/migrations/20260720_000001_foundation.sql]` `[VERIFIED: supabase/migrations/20260720_000002_dashboard_polish.sql]` `[VERIFIED: backend/app/services/supabase.py::update_status]` Incremental sync therefore cannot rely solely on `reports.updated_at` today.

Officer Analytics (Track C) is a new `/dashboard/analytics` route behind the existing dashboard layout + `requireOfficerSession` / `officerFetch` JWT path, with three chart blocks + hotspot list and URL-persisted date presets per UI-SPEC. `[VERIFIED: frontend/src/app/dashboard/layout.tsx]` `[CITED: 05-UI-SPEC.md]` Chart stack is locked to **shadcn official `chart` → `recharts`**. `[CITED: https://ui.shadcn.com/docs/components/chart]` `[VERIFIED: plugin-shadcn chart registry deps = recharts@3.8.0]`

Public Home stats (Track B) are a thin, optional, **k≥3** aggregate strip via a rate-limited FastAPI public endpoint (or Next BFF cache) — never BigQuery credentials in the browser. `[CITED: D-11..D-13, D-17]`

**Primary recommendation:** Ship Track A as a dedicated Cloud Run Job (`scripts/etl_supabase_to_bigquery.py` or `backend/app/jobs/…`) scheduled `0 6 * * *` `Asia/Ho_Chi_Minh`, dual watermarks (reports by `created_at` + status-driven MERGE; status_events append-only by `created_at`), analytics-safe column projection, BQ views for the four metrics; Track C officer read API on FastAPI + shadcn/recharts UI; Track B SSR-cached public aggregates with k=3 suppression.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Incremental ETL extract/load | API / Backend (batch Job) | Database / Storage (BQ + Supabase) | Service-role read + BQ write; not request-path |
| Watermark persistence | Database / Storage (BQ control table) | — | Survives job restarts; same project as warehouse |
| Analytics SQL views / SLA math | Database / Storage (BigQuery) | — | Warehouse owns aggregations |
| Officer analytics read API | API / Backend (FastAPI) | Frontend Server (optional BFF) | Reuse `require_officer`; BQ query server-side |
| Public aggregate API + rate limit | API / Backend | Frontend Server (BFF cache) | D-13; never browser→BQ |
| Analytics tab charts / URL range | Browser / Client | Frontend Server (RSC shell) | Client islands for charts; layout auth SSR |
| Public Home stats strip | Frontend Server (SSR) | API / Backend | Fetch once with short cache; hide on failure (D-12) |
| Privacy projection / k-anonymity | API / Backend | Database / Storage (views) | Enforce at ETL column list + public API filter |

## Discretion Recommendations (agent picks for planner)

| Discretion item | Recommendation | Confidence |
|-----------------|----------------|------------|
| Job packaging | **Cloud Run Job** (not Functions) — finite ETL, non-HTTP, matches deploy path | HIGH `[CITED: https://cloud.google.com/run/docs/execute/jobs-on-schedule]` |
| Cron | `0 6 * * *` timezone **`Asia/Ho_Chi_Minh`** — meets “by ~06:00 local”; sync window = rows with timestamps **&lt; start of current UTC day** (data through previous UTC day) | HIGH `[ASSUMED]` local = ICT for CityMind ops |
| Watermarks | Table `citymind.etl_watermarks (pipeline STRING, watermark TIMESTAMP, updated_at TIMESTAMP)` in BQ | HIGH |
| Chart library | **recharts via `npx shadcn add chart`** — UI-SPEC lock + official shadcn dependency | HIGH |
| SLA open clock | **Report `created_at`** as open; close = **MIN(`status_events.created_at`)** where `status IN ('resolved','rejected')` | HIGH — avoids waiting for a synthetic “new” event |
| Public stats delivery | **SSR in Home** calling BFF/public API with `revalidate` ~300–3600s; hide section on error | HIGH `[CITED: D-12]` |
| Area labels | **Category-only hotspots** in MVP — no `area_label` column exists today | HIGH `[VERIFIED: foundation migration]` |

## Standard Stack

### Core

| Library / Service | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Cloud Run Jobs + Cloud Scheduler | GCP managed | Daily ETL trigger | Official “execute jobs on a schedule” pattern `[CITED: https://cloud.google.com/run/docs/execute/jobs-on-schedule]` |
| `google-cloud-bigquery` | **3.34.0** (already pinned) | Warehouse load + analytics queries | Existing sink dependency `[VERIFIED: backend/requirements.txt]` |
| `supabase` (Python) | **2.31.0** (already pinned) | Service-role extract | Existing `SupabaseReportSink` patterns `[VERIFIED: backend/requirements.txt]` |
| FastAPI | **0.115.14** | Officer + public analytics read APIs | Project stack `[CITED: AGENTS.md]` |
| shadcn `chart` + **recharts** | registry pins **recharts@3.8.0**; npm latest **3.9.2** | Officer charts | Official shadcn chart dependency `[VERIFIED: plugin-shadcn @shadcn/chart]` `[CITED: https://ui.shadcn.com/docs/components/chart]` |
| Next.js App Router `searchParams` | **16.2.10** | Date-range URL sync | Phase 3 pattern; avoid `nuqs` `[CITED: 03-RESEARCH.md]` `[VERIFIED: frontend/package.json]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-is` | peer of recharts (npm **19.2.7** available) | Recharts peer | Install if not already present when adding chart |
| pytest | **8.4.1** | Backend ETL/API tests | Already in use `[VERIFIED: backend/requirements.txt]` |
| frontend `*.test.mjs` | node:test style | Smoke for URL helpers / sidebar | Existing `frontend/tests/` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cloud Run Job | Cloud Functions (HTTP) | Functions fit short HTTP; ETL needs longer timeout/batch UX — Job is better |
| BQ control watermarks | GCS JSON / Supabase meta | GCS adds another bucket; Supabase meta couples ops DB to ETL state — BQ keeps warehouse self-describing |
| recharts | Chart.js / Visx | Violates 05-UI-SPEC lock |
| nuqs | — | Phase 3 legitimacy SUS; native searchParams sufficient |

**Installation:**

```bash
# Frontend (from frontend/) — prefer shadcn so chart.tsx + deps land together
npx shadcn@latest add chart
# If peer missing:
npm install react-is

# Backend — no new packages required for MVP ETL/read if google-cloud-bigquery + supabase already present
# Optional: none
```

**Version verification (this session):**
- `npm view recharts version` → **3.9.2**; package created **2015-08-07**; 286 versions; **54M+/wk** downloads; no `postinstall`. `[VERIFIED: npm registry]`
- shadcn registry `@shadcn/chart` dependencies → **`recharts@3.8.0`**. `[VERIFIED: plugin-shadcn-shadcn]`
- `google-cloud-bigquery==3.34.0` already in `backend/requirements.txt`. `[VERIFIED: backend/requirements.txt]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `recharts` | npm | created 2015; latest publish 2026-07-04 | ~54.3M/wk | github.com/recharts/recharts | **SUS** (`too-new` on latest publish only) | **Keep** — official shadcn dependency; planner adds `checkpoint:human-verify` before install. Tag claims `[CITED: ui.shadcn.com]` not `[VERIFIED: npm registry]` because seam ≠ OK |
| `react-is` | npm | established | high | facebook/react | OK (peer) | Approved if needed for recharts peers |
| `google-cloud-bigquery` | PyPI | already pinned 3.34.0 | n/a in seam | googleapis/python-bigquery | **SUS** (seam: too-new/unknown-downloads) | **Keep existing pin** — no new install; already in production path |
| `nuqs` | npm | — | — | — | — | **Do not install** (Phase 3 decision) |
| Chart.js / `chart.js` | — | — | — | — | — | **Rejected** by UI-SPEC |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** `recharts` (install with human-verify; established package, false-positive age on latest tag)

*Install via official shadcn registry only — do not invent alternate chart package names.*

## Architecture Patterns

### System Architecture Diagram

```text
Supabase Postgres (ops SoT)
  reports | status_events | access_tokens (NEVER synced)
        │
        │  service-role read (projected columns only)
        ▼
Cloud Scheduler  ──POST :run──►  Cloud Run Job: etl_supabase_to_bq
        │                            │
        │                            ├─ read etl_watermarks
        │                            ├─ extract incremental batches
        │                            ├─ stage → MERGE reports_analytics
        │                            ├─ APPEND status_events_analytics
        │                            ├─ advance watermarks ONLY on success
        │                            └─ exit≠0 + structured JSON log on failure
        ▼
BigQuery dataset `citymind`
  reports_analytics (or adapted `reports`)
  status_events_analytics (or adapted `report_status_events`)
  etl_watermarks
  VIEW v_volume_daily | v_category_mix | v_sla_closed | v_hotspot_category
        │
        ├─► FastAPI GET /api/v1/analytics/*   [require_officer]
        │         ▲
        │         │ officerFetch Bearer JWT
        │         │
        │    Next /dashboard/analytics  (Track C charts)
        │
        └─► FastAPI GET /api/v1/public/stats  [rate limit + k≥3]
                  ▲
                  │ BFF / SSR short cache
                  │
             Home [locale] stats strip (Track B)
```

### Recommended Project Structure

```text
infra/bigquery/
├── schema.sql                    # adapt: analytics column set (drop PII/evidence)
├── create_status_events.sql      # adapt: no note/actor email material
├── analytics_views.sql           # NEW: v_volume_daily, v_category_mix, v_sla_closed, v_hotspot_category
└── etl_watermarks.sql            # NEW: control table DDL

backend/app/
├── jobs/
│   └── etl_supabase_to_bigquery.py   # NEW: CLI entry for Cloud Run Job
├── services/
│   ├── supabase.py                   # + extract helpers (or job-local client)
│   ├── bigquery.py                   # + analytics query methods (read-only)
│   └── analytics.py                  # NEW: view query + DTO shaping
├── api/
│   ├── reports.py                    # unchanged ops
│   └── analytics.py                  # NEW: officer + public routers
└── security.py                       # + public_stats_limiter (separate bucket)

frontend/src/
├── app/dashboard/analytics/page.tsx  # NEW Track C
├── components/analytics/
│   ├── DateRangeToolbar.tsx
│   ├── VolumeChart.tsx
│   ├── CategoryChart.tsx
│   ├── SlaChart.tsx
│   ├── HotspotTable.tsx
│   └── PublicStatsStrip.tsx          # Track B
├── components/ui/chart.tsx           # via shadcn add
└── components/DashboardSidebar.tsx   # + Analytics nav item

scripts/
└── deploy_etl_job.*                  # optional: Job + Scheduler wiring notes
```

### Pattern 1: Scheduler → Cloud Run Job

**What:** HTTP POST to Jobs API `:run` with OAuth SA that has `roles/run.invoker`.  
**When to use:** Daily ETL (D-01).  
**Example:**

```bash
# Source: https://cloud.google.com/run/docs/execute/jobs-on-schedule
gcloud scheduler jobs create http citymind-etl-daily \
  --location=REGION \
  --schedule="0 6 * * *" \
  --time-zone="Asia/Ho_Chi_Minh" \
  --uri="https://run.googleapis.com/v2/projects/PROJECT/locations/REGION/jobs/citymind-etl:run" \
  --http-method=POST \
  --oauth-service-account-email=SA@PROJECT.iam.gserviceaccount.com
```

`[CITED: https://cloud.google.com/run/docs/execute/jobs-on-schedule]`

### Pattern 2: Dual-watermark incremental sync (no `updated_at`)

**What:** Because `reports` lacks `updated_at`, use:
1. **Reports insert path:** `WHERE created_at > reports_watermark AND created_at < utc_day_start` → MERGE on `report_id`.
2. **Reports dimension refresh:** for `report_id`s appearing in new `status_events` since events watermark, re-fetch projected report rows and MERGE (`current_status`, priority, category if ever corrected).
3. **Status events:** append-only `WHERE created_at > events_watermark` keyed by `event_id` (UUID PK) — never rewrite history.

**When to use:** Default cron path (D-02). Full reload: `--full-reload` truncates/reloads analytics tables and resets watermarks.

**Optional Wave 0 schema improvement:** add `reports.updated_at TIMESTAMPTZ` + trigger — simplifies future increments. Not required if dual-watermark is implemented.

### Pattern 3: Privacy column projection (D-16)

**MUST NOT sync:**

| Source | Columns / tables | Reason |
|--------|------------------|--------|
| `access_tokens` | entire table | Token hashes/secrets `[CITED: D-16]` `[CITED: Phase 4]` |
| `reports` | `image_gcs_uri`, `evidence`, `description`, `summary`, `recommendation`, `uncertainty`, `urban_context` | Evidence URLs + free-text / PII-adjacent |
| `status_events` | `note`, `actor_id` | Officer notes / identity material `[CITED: D-16/D-18]` |

**MAY sync:** `report_id`, `created_at`, `category`, `severity`, `priority`, `current_status`, `latitude`, `longitude` (for Phase 6; unused in UI now), `status_events.event_id`, `status`, `created_at`.

Existing legacy BQ `reports` schema includes `image_gcs_uri`, `description`, etc. `[VERIFIED: infra/bigquery/schema.sql]` — **adapt DDL** for analytics tables (new names or REPLACE) so ETL cannot load forbidden columns even by accident.

### Pattern 4: Officer analytics API + public BFF

**Officer (Track C):**

```http
GET /api/v1/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
Authorization: Bearer <officer JWT>
```

Returns JSON for volume series, category mix, SLA summary/histogram, hotspots. Auth = existing `require_officer`. `[VERIFIED: backend/app/security.py]`

**Public (Track B):**

```http
GET /api/v1/public/stats
# or Next BFF /api/public/stats → FastAPI
```

Response: `{ total_last_30d, top_categories: [{category, count}] }` with categories **count &lt; 3 omitted or rolled into Other** (D-17). Separate `SlidingWindowLimiter` bucket (like status vs analyze). `[VERIFIED: backend/app/security.py]`

### Pattern 5: URL date-range (Phase 3 spirit + UI-SPEC)

Keys: `range=7|30|90|custom`, `from`, `to` (ISO date). Default `range=30`. Native Next `searchParams` / `URLSearchParams` — **no nuqs**. `[CITED: 05-UI-SPEC.md]` `[CITED: 03-RESEARCH.md D-09]`

Invalid `from > to` → inline error, **no fetch**. Empty warehouse → empty-state copy from UI-SPEC (do not paint zero series).

### Pattern 6: SLA without double-counting

```sql
-- Conceptual; implement in v_sla_closed
WITH closed AS (
  SELECT
    e.report_id,
    MIN(e.created_at) AS closed_at
  FROM status_events_analytics e
  WHERE e.status IN ('resolved', 'rejected')
  GROUP BY e.report_id   -- one close event per report
)
SELECT
  r.report_id,
  DATE_DIFF(DATE(c.closed_at), DATE(r.created_at), DAY) AS days_to_close
FROM reports_analytics r
JOIN closed c USING (report_id)
WHERE c.closed_at BETWEEN @from AND @to  -- closed in range (UI caption)
```

Do **not** average every status transition; do **not** count reopen cycles as multiple SLAs in MVP.

### Anti-Patterns to Avoid

- **Ops CRUD via BigQuery again:** Violates hard cutover / D-04. `[CITED: 01-CONTEXT D-08]`
- **Syncing `access_tokens` or `image_gcs_uri` “just in case”:** Privacy breach (D-16).
- **Streaming inserts as SoT for analytics without MERGE:** Duplicate `report_id` rows break volume counts.
- **Advancing watermark before BQ load confirms:** Silent data loss (D-03).
- **Drawing flat zero charts for empty warehouse:** Misleading (D-10 / UI-SPEC).
- **Public endpoint returning categories with count 1–2:** Breaks k-anonymity (D-17).
- **Browser BigQuery / service account keys:** Forbidden (D-13).
- **Using Chart.js or custom SVG kitchen-sink:** Violates UI-SPEC.
- **UTC day boundary bugs:** Presets must compute `from/to` in a documented TZ; warehouse partitions/views use **UTC dates**; freshness caption says “previous UTC day”.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron + auth to run container | Custom always-on worker | Cloud Scheduler → Cloud Run Job `:run` | Official IAM + skip-if-running semantics `[CITED: cloud.google.com/run/docs/execute/jobs-on-schedule]` `[CITED: cloud.google.com/scheduler/docs/creating]` |
| Chart primitives | Custom SVG/D3 | shadcn `chart` + recharts | Design-system + a11y patterns |
| URL state library | Ad-hoc string bugs / nuqs | `URLSearchParams` + Next `searchParams` | Phase 3 precedent |
| Upsert logic in app loops | Delete-all + insert row-by-row only | BigQuery `MERGE` | Idempotent incremental loads `[CITED: https://cloud.google.com/bigquery/docs/reference/standard-sql/dml-syntax#merge_statement]` |
| Auth for officer analytics | New API key scheme | Existing `require_officer` JWT | Already ASVS-aligned for dashboard |
| Public rate limit | Shared analyze bucket | Dedicated limiter instance | Analyze is expensive; stats is cheap (Phase 4 pattern) |

**Key insight:** Phase 5 is mostly **warehouse + projection + read APIs**. Chart UI is thin if the views and DTOs are correct. Privacy is enforced at **ETL projection**, not only in the React layer.

## Runtime State Inventory

> Migration of BigQuery from ops sink → analytics warehouse.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | BQ `citymind.reports` may still hold legacy ops columns (`description`, `image_gcs_uri`, `evidence`, …) `[VERIFIED: infra/bigquery/schema.sql]`; Supabase holds ops SoT including `access_tokens` | Prefer **new analytics tables/views** or rebuild tables without forbidden columns; do not ETL tokens; optional one-time purge/migrate of legacy sensitive BQ columns |
| Live service config | Cloud Run API service exists (`scripts/deploy_cloudrun.ps1`); **no ETL Job/Scheduler** found in repo yet | Create Job + Scheduler in GCP (ops); document in README — not only code |
| OS-registered state | None for ETL cron on laptop (`gcloud` **missing** on research host) | Deploy from CI/ops machine with gcloud |
| Secrets/env vars | `SUPABASE_*`, GCP ADC / SA for BQ already used by backend; Job needs Supabase **service role** + BQ write SA | New Job env/secrets; never put service role in frontend |
| Build artifacts | Existing backend Docker image may not include Job entrypoint | Add Job Dockerfile/cmd or reuse image with different command |

**Nothing found in category:** N/A — all five categories answered.

## Common Pitfalls

### Pitfall 1: Empty warehouse UX
**What goes wrong:** Charts render a week of zeros after deploy before first sync.  
**Why:** Treating missing series as zero-filled date spine.  
**How to avoid:** If API returns `empty: true` / zero total and no points, show UI-SPEC empty warehouse copy; only zero-fill days when **at least one** report exists in range.  
**Warning signs:** Freshness note claims data while totals are 0 with continuous axes.

### Pitfall 2: Timezone / UTC day boundaries
**What goes wrong:** “Last 7 days” differs for officers in ICT vs UTC; SLA days off-by-one.  
**Why:** Mixing local midnight with `DATE(created_at)` UTC.  
**How to avoid:** Persist ISO dates in URL; interpret range as **UTC inclusive dates** in API; caption: “Data through previous UTC day after the daily sync.” `[CITED: 05-UI-SPEC.md]`  
**Warning signs:** Volume spikes/drops at local midnight.

### Pitfall 3: Double-counting status events for SLA
**What goes wrong:** Median TTR inflated/deflated by multiple `resolved` events or counting every transition.  
**Why:** Joining all events without `GROUP BY report_id` / `MIN(closed_at)`.  
**How to avoid:** One closed_at per report; open = report `created_at`.  
**Warning signs:** SLA sample size ≫ closed report count.

### Pitfall 4: Incremental miss on `current_status`
**What goes wrong:** Warehouse status stuck at `new` while ops moved to `resolved`.  
**Why:** No `updated_at`; only `created_at` watermark on reports.  
**How to avoid:** Dual-watermark Pattern 2 (refresh reports touched by new status_events).  
**Warning signs:** SLA view empty despite many status_events.

### Pitfall 5: Watermark advanced on failed load
**What goes wrong:** Permanent silent gap (D-03).  
**Why:** Update control table before BQ job succeeds.  
**How to avoid:** Transactional ordering — load → verify row counts/errors → then watermark; non-zero exit.  
**Warning signs:** Job “success” with zero rows inserted while source had growth.

### Pitfall 6: Public k-anonymity only in UI
**What goes wrong:** API still returns small cells; scrapers re-identify.  
**Why:** Client-only filtering.  
**How to avoid:** Enforce k≥3 in FastAPI/SQL for public endpoint.  
**Warning signs:** Network tab shows category with count 1.

### Pitfall 7: Legacy BQ streaming buffer / insert_rows_json duplicates
**What goes wrong:** Duplicate report_ids if ETL uses streaming insert without row_ids/MERGE.  
**Why:** Old `BigQueryReportSink.insert` pattern. `[VERIFIED: backend/app/services/bigquery.py]`  
**How to avoid:** Load via load job + MERGE, or `insert_rows_json` with deterministic `row_ids` then dedupe views with `QUALIFY`.

## Code Examples

### Officer analytics fetch (reuse)

```typescript
// Source: frontend/src/lib/backend.ts [VERIFIED]
import { officerFetch } from "@/lib/backend";

const qs = new URLSearchParams({ from, to });
const res = await officerFetch(`/api/v1/analytics?${qs}`, { cache: "no-store" });
```

### shadcn + recharts import shape

```tsx
// Source: https://ui.shadcn.com/docs/components/chart [CITED]
"use client"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
```

### BigQuery MERGE sketch

```sql
-- Source: https://cloud.google.com/bigquery/docs/reference/standard-sql/dml-syntax#merge_statement [CITED]
MERGE `PROJECT.citymind.reports_analytics` T
USING `PROJECT.citymind.reports_analytics_staging` S
ON T.report_id = S.report_id
WHEN MATCHED THEN UPDATE SET
  category = S.category,
  priority = S.priority,
  current_status = S.current_status,
  latitude = S.latitude,
  longitude = S.longitude
WHEN NOT MATCHED THEN INSERT (report_id, created_at, category, priority, current_status, latitude, longitude)
VALUES (S.report_id, S.created_at, S.category, S.priority, S.current_status, S.latitude, S.longitude);
```

### Public k-filter

```python
# Enforce server-side [CITED: D-17]; k=3 aligned with SDC min frequency practice [CITED: sdctools.github.io/HandbookSDC]
K = 3
top = [c for c in categories if c["count"] >= K][:2]
# residual small cells → omit (prefer omit over "Other" when only 1–2 tiny cats)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BigQuery as ops SoT (`BigQueryReportSink` CRUD) | Supabase ops + BQ analytics-only | Milestone v2 / Phase 1 | ETL is one-way Supabase→BQ |
| Streaming insert per report to BQ at analyze time | Scheduled batch incremental ETL | Phase 5 | Fresher ops, delayed analytics (~daily) |
| Card dashboard summary from live ops | Dedicated Analytics tab from warehouse views | Phase 5 | Separates ops latency from analytics |
| No public aggregates | Thin Home strip with k-anonymity | Phase 5 Track B | Civic transparency without PII |

**Deprecated/outdated:**
- Using BQ `list_recent` / officer filters against warehouse for **ops** workflows — stay on Supabase.
- Chart.js for this phase — UI-SPEC forbids.
- Real-time CDC — deferred.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ops “local” timezone for D-01 is `Asia/Ho_Chi_Minh` | Discretion / cron | Schedule misses “by 06:00 local” for another TZ — adjust cron TZ |
| A2 | Category-only hotspots suffice (no area_label column) | Discretion | Product wanted neighborhood labels — would need geocoding store later |
| A3 | k=3 remains appropriate for public category cells (SDC minimum) | Privacy | Some jurisdictions prefer 5–10 — raise constant if compliance demands |
| A4 | Closing statuses are exactly `resolved` and `rejected` | SLA SQL | If more terminal statuses added, views must extend IN-list |
| A5 | SSR + short cache is better than client fetch for Home stats | Track B | Client fetch also OK if degrade-hide still holds |
| A6 | Dual-watermark without adding `updated_at` is enough for MVP | ETL | If report fields other than status change often, add `updated_at` |

## Open Questions

### Resolved in research

1. **Chart library?** → recharts via shadcn `chart` (UI-SPEC + registry).  
2. **Job vs Function?** → Cloud Run Job + Scheduler.  
3. **Watermark store?** → BQ `etl_watermarks`.  
4. **SLA open time?** → report `created_at`.  
5. **k threshold?** → keep **3** (D-17); literature supports 3 as minimum frequency; higher is policy preference not required for MVP. `[CITED: https://sdctools.github.io/HandbookSDC/04-magnitude-tabular-data.html]`  
6. **Public delivery?** → SSR/BFF with graceful hide.

### Remaining (planner / ops)

1. **GCP project/region/SA names** for Job + Scheduler — not in repo as code; need deploy checklist.  
2. **Whether to rename BQ tables** (`reports` → `reports_analytics`) vs in-place column drop — recommend **new analytics tables** to avoid breaking any leftover readers of old schema.  
3. **Cloud Logging alert policy** vs README-only for D-03 — recommend README + optional log-based alert; not PagerDuty.  
4. **Phase 4 dependency:** ROADMAP says Phase 5 depends on Phase 4 — plan can proceed; execute after Phase 4 complete. `[CITED: ROADMAP.md]`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Frontend charts | ✓ | v24.14.0 / 11.9.0 | — |
| Python 3 | ETL + FastAPI | ✓ | 3.14.5 (dev); project targets 3.12 | Use 3.12 in Docker/Job image |
| Docker | Job image build | ✓ | 29.3.0 | — |
| gcloud CLI | Deploy Job/Scheduler | ✗ | — | Document manual console steps; CI machine |
| BigQuery API / GCP project | Warehouse | unknown on this host | — | Requires ADC/SA at execute time |
| Supabase service role | ETL extract | via env (not probed) | — | Job fails closed (exit ≠ 0) |
| pytest | Validation | ✓ | 8.4.1 | — |
| recharts (installed) | Charts | ✗ not in package.json yet | — | `shadcn add chart` |
| chart.tsx | Charts | ✗ missing | — | Wave 0 UI add |

**Missing dependencies with no fallback:**
- Live GCP credentials / gcloud on research laptop — **execution** of deploy needs ops environment.

**Missing dependencies with fallback:**
- gcloud missing → use Cloud Console “Add Scheduler Trigger” UI per official docs.

## Validation Architecture

> `workflow.nyquist_validation` is **true** in `.planning/config.json`. `[VERIFIED: .planning/config.json]`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.4.1 (backend); Node test runner via `frontend/tests/*.test.mjs` |
| Config file | `backend/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd backend && pytest tests/test_analytics_api.py tests/test_etl_privacy.py -q` |
| Full suite command | `cd backend && pytest -q` && `node --test frontend/tests/*.test.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLY-01 | ETL projects only allowlisted columns; never reads `access_tokens` | unit | `pytest tests/test_etl_privacy.py::test_projection_excludes_forbidden -x` | ❌ Wave 0 |
| ANLY-01 | Incremental watermark does not advance on load failure | unit | `pytest tests/test_etl_watermarks.py::test_watermark_not_advanced_on_error -x` | ❌ Wave 0 |
| ANLY-01 | Full reload flag path exists / resets watermarks | unit | `pytest tests/test_etl_watermarks.py::test_full_reload_flag -x` | ❌ Wave 0 |
| ANLY-02 | SLA view one row per closed report (no double-count) | SQL/unit | `pytest tests/test_analytics_views.py::test_sla_single_close_per_report -x` | ❌ Wave 0 |
| ANLY-02 | Volume / category / hotspot aggregations honor from–to | unit | `pytest tests/test_analytics_views.py -q` | ❌ Wave 0 |
| ANLY-03 | Officer analytics requires JWT / 401 without | api | `pytest tests/test_analytics_api.py::test_officer_analytics_requires_auth -x` | ❌ Wave 0 |
| ANLY-03 | Date range validation rejects from&gt;to | api | `pytest tests/test_analytics_api.py::test_invalid_range_422 -x` | ❌ Wave 0 |
| D-17 | Public stats omits categories with count &lt; 3 | api | `pytest tests/test_public_stats.py::test_k_anonymity_threshold -x` | ❌ Wave 0 |
| D-12 | Public stats failure does not 500 Home (frontend smoke) | smoke | `node --test frontend/tests/public-stats.test.mjs` | ❌ Wave 0 |
| UI | Sidebar includes Analytics link; URL keys documented | smoke | `node --test frontend/tests/analytics-shell.test.mjs` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted pytest file(s) for the task  
- **Per wave merge:** full backend pytest + frontend analytics/public smoke tests  
- **Phase gate:** Full suite green before `$gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_etl_privacy.py` — ANLY-01 column allowlist  
- [ ] `backend/tests/test_etl_watermarks.py` — failure/success watermark behavior  
- [ ] `backend/tests/test_analytics_views.py` — SLA/volume/category logic (can mock BQ or pure SQL fixtures)  
- [ ] `backend/tests/test_analytics_api.py` — officer auth + range validation  
- [ ] `backend/tests/test_public_stats.py` — k-anonymity + rate limit header behavior  
- [ ] `frontend/tests/analytics-shell.test.mjs` — nav + URL param helpers  
- [ ] `frontend/tests/public-stats.test.mjs` — degrade/hide contract  
- [ ] `infra/bigquery/analytics_views.sql` + `etl_watermarks.sql` — schema Wave 0  
- [ ] `npx shadcn add chart` — UI dependency Wave 0 (after human-verify on recharts SUS)

## Security Domain

> `security_enforcement: true`, ASVS level 1. `[VERIFIED: .planning/config.json]`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (officer) | Supabase JWT via `require_officer` `[VERIFIED: backend/app/security.py]` |
| V3 Session Management | yes (dashboard) | Existing Next session cookie → Bearer to API |
| V4 Access Control | yes | Officer-only analytics; public endpoint aggregate-only |
| V5 Input Validation | yes | Pydantic date bounds; max range clamp (e.g. ≤366 days) `[ASSUMED]` clamp value |
| V6 Cryptography | partial | No new crypto; tokens never synced |
| V7 Error Handling & Logging | yes | Structured ETL logs without PII; generic public errors |

### Known Threat Patterns for analytics pipeline

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token/evidence exfiltration via warehouse | Information disclosure | ETL allowlist; omit `access_tokens`, GCS URIs, notes |
| Public small-cell re-identification | Information disclosure | k≥3 server-side suppression (D-17) |
| Unauthenticated officer analytics | Elevation of privilege | `Depends(require_officer)` |
| BQ credential exposure to browser | Information disclosure | Server-only queries (D-13) |
| ETL job abuse / data scrape | Information disclosure | Job SA least privilege; Scheduler OAuth; no public Job URL |
| SQL injection in analytics filters | Tampering | Parameterized BigQuery query params (existing pattern in `bigquery.py`) |
| Rate abuse on public stats | Denial of service | Dedicated IP limiter + 429 |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/05-analytics-pipeline/05-CONTEXT.md` — D-01..D-18  
- `.planning/phases/05-analytics-pipeline/05-UI-SPEC.md` — recharts/shadcn chart lock, URL keys, copy  
- `infra/bigquery/schema.sql`, `create_status_events.sql`  
- `supabase/migrations/20260720_000001_foundation.sql`, `000002_dashboard_polish.sql`  
- `backend/app/services/bigquery.py`, `supabase.py`, `security.py`, `api/reports.py`  
- `frontend/src/app/dashboard/layout.tsx`, `DashboardSidebar.tsx`, `lib/backend.ts`  
- https://cloud.google.com/run/docs/execute/jobs-on-schedule — Scheduler → Job  
- https://cloud.google.com/scheduler/docs/creating — cron / idempotency notes  
- https://cloud.google.com/bigquery/docs/reference/standard-sql/dml-syntax#merge_statement — MERGE  
- https://ui.shadcn.com/docs/components/chart — Recharts v3  
- plugin-shadcn `@shadcn/chart` registry — dependency `recharts@3.8.0`  
- npm view `recharts` — version/peers/created date  

### Secondary (MEDIUM confidence)

- https://sdctools.github.io/HandbookSDC/04-magnitude-tabular-data.html — minimum frequency n=3  
- Eurostat/SDC threshold guidance (k=3 minimum) via web search digests  
- Phase 3 RESEARCH — native searchParams / avoid nuqs  

### Tertiary (LOW confidence)

- Community ETL blog patterns (watermark in GCS) — superseded by BQ control table pick  
- classify-confidence seam returned LOW for webfetch even with `--verified` — provenance tags above use protocol (official docs = CITED/VERIFIED via tool), not the seam’s LOW quirk alone  

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — shadcn/GCP official docs + installed backend pins  
- Architecture: **HIGH** — locked decisions + verified schema gaps (`updated_at`)  
- Pitfalls: **HIGH** — empty UX, TZ, SLA double-count, watermark ordering grounded in D-03/D-10  

**Research date:** 2026-07-20  
**Valid until:** ~2026-08-20 (30 days; recharts major / shadcn registry may move)

## RESEARCH COMPLETE

**Phase:** 5 - analytics-pipeline  
**Confidence:** HIGH  

### Key Findings
- Use **Cloud Scheduler → Cloud Run Job** daily (`0 6 * * *` `Asia/Ho_Chi_Minh`); dual watermarks because **`reports.updated_at` does not exist**.
- Adapt BQ schemas to **analytics-safe columns**; never sync tokens, evidence URIs, notes, or free-text PII-adjacent fields.
- Officer API reuses **`require_officer`**; public stats are separate, rate-limited, **k≥3**.
- Charts: **shadcn `chart` + recharts** (registry dep 3.8.0; npm 3.9.2) — legitimacy SUS on latest publish only; human-verify checkpoint.
- Views must compute **one SLA close per report**; empty warehouse must not fake zero series.

### File Created
`.planning/phases/05-analytics-pipeline/05-RESEARCH.md`

### Ready for Planning
Research complete. Planner can create `05-01` (Track A), `05-02` (Track B), `05-03` (Track C) PLAN.md files.
