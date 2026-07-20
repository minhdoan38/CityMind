# Phase 5: Analytics Pipeline - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish BigQuery as the analytics warehouse: scheduled ETL syncs operational report/status data from Supabase → BigQuery; BigQuery views expose category trends, SLA/time-to-resolution, and hotspot aggregates; the officer dashboard gains an Analytics tab with date-range filtering and charts. Optional non-sensitive public Home stats may ship as a thin Track B slice.

**In scope:** ANLY-01, ANLY-02, ANLY-03 (and optional Track B public aggregates if they stay non-sensitive).

**Out of scope this phase:** MapLibre / PostGIS hotspot maps (Phase 6); ops CRUD still on Supabase; citizen status (Phase 4); notifications (NOTF-01); predictive ML models; real-time streaming CDC; PII or evidence URLs in analytics exports.

</domain>

<decisions>
## Implementation Decisions

### ETL cadence & freshness
- **D-01:** Run ETL on a **daily** schedule (Cloud Scheduler → Cloud Run Job / script). Target freshness: data through **previous UTC day** available by ~06:00 local (agent may refine window in research).
- **D-02:** Prefer **incremental sync** keyed by `updated_at` / `created_at` watermarks for reports and status_events; support a **manual full reload** flag for recovery (not the default cron path).
- **D-03:** ETL failures must be **observable** (job exit non-zero + structured log); no silent skip. Alert channel is agent discretion (Cloud Logging alert or README ops note) — do not block MVP on PagerDuty.
- **D-04:** Destination remains existing BigQuery dataset/table conventions under `infra/bigquery/` (adapt schema for analytics columns + status history as needed). Supabase remains source of truth for ops.

### Analytics tab charts (officer)
- **D-05:** MVP Analytics tab shows **three chart blocks** (not a chart kitchen-sink):
  1. **Volume over time** — reports created per day in range  
  2. **Category mix** — counts (or %) by category in range  
  3. **SLA / time-to-resolution** — distribution or median days from `new` → `resolved`/`rejected` for closed reports in range  
- **D-06:** Hotspot insight on the tab is a **ranked table/list** (top N categories or coarse area labels by volume), not a map (D-15).
- **D-07:** Analytics UI lives under the **officer dashboard** (new tab/route e.g. `/dashboard/analytics`), officer JWT only — never public.

### Date-range UX
- **D-08:** Provide **presets**: Last 7 / 30 / 90 days + **custom** from→to date inputs.
- **D-09:** **Default = Last 30 days.** Persist selection in URL `searchParams` (same pattern as Phase 3 filters) so refresh/share keeps range.
- **D-10:** Empty range / no data → calm empty state (DASH-07 spirit); loading and error states required. Charts must not invent zeros that imply data exists when the warehouse is empty.

### Public Home stats (Track B)
- **D-11:** **Ship a thin optional public stats strip** on locale Home: **only** non-sensitive aggregates — e.g. total reports in last 30 days + top 1–2 categories by count. No lat/lng, no descriptions, no evidence, no tokens, no officer notes.
- **D-12:** If analytics API/warehouse is unavailable, Home stats **degrade gracefully** (hide section or show “Stats unavailable”) — never block Home render.
- **D-13:** Public stats read path is **read-only aggregate API** (or cached BFF) with rate limit; do not expose raw BigQuery to the browser.

### Hotspots without maps
- **D-14:** Phase 5 “hotspot” = **category concentration** (and optionally reverse-geocode / stored area label if already present on reports). **Do not** require PostGIS or MapLibre.
- **D-15:** Defer map pins, clustering, and bbox APIs to **Phase 6**. Analytics may store lat/lng in BigQuery for later use but UI does not plot them here.

### Privacy boundary
- **D-16:** BigQuery analytics tables **must not** contain: access token plaintext/hashes, evidence storage URLs/paths, citizen contact fields (none today — keep it that way), officer emails. Prefer report_id, timestamps, category, priority, status, lat/lng (optional), area label, SLA intervals.
- **D-17:** Public aggregates (D-11) are **count-only / category-only** — minimum k-anonymity: if a category has **&lt; 3** reports in the window, **omit or bucket as “Other”** (agent may tune threshold in research; default 3).
- **D-18:** Officer analytics may show finer breakdowns than public, still without evidence URIs or token material.

### Agent Discretion
- Exact Cloud Scheduler cron expression and job packaging (Cloud Run Job vs Cloud Functions)
- Chart library choice (recharts / chart.js / shadcn-compatible) — research legitimacy before install
- Whether SLA clock starts at report `created_at` or first status transition
- Exact BigQuery view SQL shape and dataset naming beyond existing `citymind` conventions
- Whether public stats are server-rendered from BFF cache vs client fetch
- Watermark storage location (BQ control table vs GCS vs Supabase meta)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — BigQuery analytics-only; Supabase ops; milestone Active Goals
- `.planning/REQUIREMENTS.md` — ANLY-01, ANLY-02, ANLY-03
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, Tracks A/B/C
- `.planning/STATE.md` — Current milestone position
- `AGENTS.md` — Stack constraints (FastAPI + Supabase + BigQuery analytics-only)

### Prior phase decisions
- `.planning/phases/01-supabase-foundation/01-CONTEXT.md` — Hard cutover ops off BigQuery (D-08); schema near-mirror
- `.planning/phases/02-public-experience/02-CONTEXT.md` — Public Home civic tone; locale prefixes
- `.planning/phases/03-dashboard-polish/03-CONTEXT.md` — Dashboard shell, URL filter patterns, officer auth
- `.planning/phases/04-citizen-status/04-CONTEXT.md` — Privacy: no cross-report leakage; token secrets never in analytics

### Code & infra touchpoints
- `infra/bigquery/schema.sql` — Existing reports BQ schema
- `infra/bigquery/create_status_events.sql` — Status events BQ schema
- `backend/app/services/bigquery.py` — Legacy sink patterns to adapt for analytics write/read (not ops CRUD)
- `backend/app/api/reports.py` — Officer summary patterns; auth gate reuse
- `frontend/src/app/dashboard/` — Dashboard shell / nav for Analytics tab
- `frontend/src/app/[locale]/page.tsx` — Home for optional public stats strip
- `.planning/codebase/INTEGRATIONS.md` — GCP / BigQuery integration notes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BigQueryReportSink` / `infra/bigquery/*` — Schema and client patterns for warehouse tables
- Officer JWT + `officerFetch` / dashboard layout — Analytics tab auth and nav
- Phase 3 URL `searchParams` filter sync — Date-range presets pattern
- Public Home `[locale]/page.tsx` — Optional stats section placement after Instructions / before Contact (preserve D-03 order from Phase 2)

### Established Patterns
- Supabase = operational source of truth; BigQuery must not regain ops CRUD
- Generic API errors + rate limits on public endpoints
- Bilingual EN/VI for any citizen-facing stats copy

### Integration Points
- ETL job reads Supabase (service role) → writes BigQuery
- FastAPI (or Next BFF) read API queries BQ views for officer analytics
- Optional public aggregate endpoint for Home stats with k-anonymity

</code_context>

<specifics>
## Specific Ideas

User selected **all** gray areas and chose **agent decision** for each. Decisions above are MVP defaults biased toward: daily incremental ETL, three officer charts + hotspot list, 30-day default presets, thin public stats with k-anonymity, category hotspots without maps, strict privacy exclusion list.

</specifics>

<deferred>
## Deferred Ideas

- Interactive MapLibre hotspot map / geo clustering — Phase 6
- Real-time CDC / sub-hourly ETL — future ops maturity
- Predictive models / anomaly detection — future
- Email/Slack PagerDuty onboarding for ETL alerts — optional later
- Public “open data” portal beyond Home strip — backlog

</deferred>

<completion>
## Ready for Planning

Phase 5 context is complete. Downstream: `$gsd-plan-phase 5` (research recommended for Scheduler + chart lib + BQ view SQL).

**Note:** ROADMAP lists Phase 5 **Depends on: Phase 4**. Prefer Phase 4 planned/executed before Phase 5 execute; discuss/plan can proceed now.

</completion>
