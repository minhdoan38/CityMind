# Phase 1: Supabase Foundation - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Move operational persistence from BigQuery to Supabase Postgres; establish Supabase Auth + RLS for officers/admins; replace FastAPI's shared-secret officer auth with JWT validation; migrate evidence uploads to Supabase Storage; and scaffold parallel public + dashboard UI shells (shadcn theme, next-intl, new routes) so Tracks B and C can build against a stable API/schema contract.

**In scope:** DATA-01, DATA-02, AUTH-01, AUTH-02, AUTH-03, PUB-05, DASH-01 (plus Phase 1 scaffolding decisions locked below).

**Out of scope this phase:** Full Home/Report polish and access-token UX (Phase 2); data table/export/resolve workflow (Phase 3); public `/status` page (Phase 4); BigQuery analytics ETL (Phase 5); PostGIS/MapLibre (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### API ↔ Auth bridge
- **D-01:** FastAPI authenticates officer requests via **Supabase JWT end-to-end**. Next.js forwards the access token; FastAPI validates JWKS. Drop `OFFICER_API_KEY` / `X-CityMind-Officer-Key` for browser-originated officer calls.
- **D-02:** Roles live in **`app_metadata.role`** with values `officer` | `admin`. FastAPI and RLS read this claim. No full `user_roles` Auth Hook system in Phase 1.
- **D-03:** Next.js session uses **`@supabase/ssr`** cookies. Remove custom HMAC `citymind_officer_session` helpers in `frontend/src/lib/auth.ts`.
- **D-04:** Officer/admin accounts are **manually seeded** (dashboard or seed script). No open officer signup in Phase 1.
- **D-05:** Public `POST /analyze` remains unauthenticated (AUTH-03).

### Schema & cutover
- **D-06:** Postgres schema is a **near-mirror of BigQuery** report columns; store `evidence`, `uncertainty`, and `urban_context` as **JSONB**; keep append-only `status_events` table.
- **D-07:** Include **`access_tokens`** table in Phase 1 (hashed token, report_id, timestamps) even though citizen status UX is Phase 2.
- **D-08:** **Hard cutover** after migration script: replace `BigQueryReportSink` with `SupabaseReportSink`; BigQuery not used for ops CRUD after Phase 1.
- **D-09:** **Do not enable PostGIS** in Phase 1 — defer to Phase 6.

### Supabase client model
- **D-10:** FastAPI uses **caller JWT** (RLS applies) for officer read/update paths; uses **service role** for public report ingest (and other privileged server writes that cannot be anon).
- **D-11:** Use official **`supabase-py`** client from FastAPI (not direct asyncpg as primary path).
- **D-12:** Develop against a **Supabase Cloud** project (env vars in `.env` / `.env.local`). Local CLI stack not required for Phase 1.
- **D-13:** Schema lives in **`supabase/migrations/`** (versioned SQL).

### UI scaffold depth
- **D-14:** Install **shadcn/ui** with **theme tokens** (CSS variables) and core primitives (Button, Input, Card, Sidebar/layout). Placeholder Home + Dashboard — not full marketing/table polish.
- **D-15:** **Migrate evidence to Supabase Storage** in Phase 1 (replace GCS for new uploads). Store storage path/URI on the report row. Plan migration or leave legacy GCS URIs for old demo rows as needed.
- **D-16:** Wire **next-intl** with EN/VI namespaces and scaffold strings + locale switcher. Real marketing copy is Phase 2.
- **D-17:** Route layout: **public Home at `/`**; **officer dashboard at `/dashboard`**; keep `/report`, `/login`; move report detail under dashboard paths as needed (e.g. `/dashboard/reports/[id]`).

### Agent Discretion
- Exact JWKS validation library/middleware shape in FastAPI
- Precise RLS policy SQL wording (must enforce officer/admin; public insert for reports only as designed)
- Whether legacy GCS demo images are migrated into Supabase Storage or left as dead URIs for seed refresh
- Exact shadcn component inventory beyond the core set above
- Seed script format (SQL vs Python) for officers and demo reports

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Milestone v2 goals, stack table, parallel tracks A/B/C
- `.planning/REQUIREMENTS.md` — DATA-01/02, AUTH-01/02/03, PUB-05, DASH-01 and traceability
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, plans 01-01 / 01-02 / 01-03

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — Current Next ↔ FastAPI ↔ BigQuery/GCS flow
- `.planning/codebase/STACK.md` — Current dependencies and env vars
- `.planning/codebase/INTEGRATIONS.md` — Auth header, BigQuery, GCS patterns
- `.planning/codebase/CONCERNS.md` — Auth fail-open, proxy.ts middleware, error leakage

### Existing schema & services (migration sources)
- `infra/bigquery/schema.sql` — Reports table columns to near-mirror
- `infra/bigquery/create_status_events.sql` — Status events shape
- `backend/app/services/bigquery.py` — `BigQueryReportSink` methods to replace
- `backend/app/services/storage.py` — GCS evidence pattern to replace with Supabase Storage
- `backend/app/security.py` — `require_officer` / rate limiter to refactor for JWT
- `backend/app/api/reports.py` — Endpoint surface to preserve
- `frontend/src/lib/auth.ts` — HMAC session to remove
- `frontend/src/lib/backend.ts` — Officer fetch helper to switch to JWT forwarding
- `frontend/src/proxy.ts` — Miswired middleware; replace with proper `middleware.ts` for `/dashboard`

### Product notes
- `idea.md` — MVP limitations, backlog (citizen tokens, auth, datastore migration)

### External (implementation guidance)
- Supabase Custom Claims / RBAC — `app_metadata` / JWT claims patterns
- Supabase SSR docs for Next.js App Router (`@supabase/ssr`)
- supabase-py client docs for service role vs user-scoped clients

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/schemas.py` (`ReportAnalysis`, enums) — Keep for Gemini + API contracts
- `backend/app/services/gemini.py` — Unchanged AI path; only sink/storage swap
- `frontend/src/components/ReportForm.tsx` — Remains public submit UI; Phase 1 may only restyle shell
- `frontend/src/components/StatusActions.tsx` — Moves under dashboard routes later
- Seed script `scripts/seed_reports.py` — Adapt target from BigQuery to Supabase

### Established Patterns
- Service object + `lru_cache` factories in `backend/app/api/reports.py` — Mirror with `SupabaseReportSink` / `EvidenceStorage`
- Next BFF proxy routes under `frontend/src/app/api/` — Continue; forward `Authorization: Bearer <jwt>` instead of officer API key
- Feature flags via settings/env — Prefer hard cutover (D-08) rather than dual BigQuery flag after migration

### Integration Points
- Replace persistence behind analyze/recent/summary/detail/status/image endpoints
- Replace frontend login (`/api/session/*`) with Supabase Auth flows
- Move officer UI from `/` → `/dashboard`; free `/` for public Home scaffold
- Evidence download path currently proxies GCS; rewire to Supabase Storage signed URL or server download

</code_context>

<specifics>
## Specific Ideas

- Parallel tracks remain: **01-01 Track A (backend)**, **01-02 Track B (landing scaffold)**, **01-03 Track C (dashboard scaffold)** — sync on schema + OpenAPI/contract Day 1
- User explicitly wants dashboard, backend, and landing work in parallel after contract sync
- Evidence storage migration to Supabase Storage is intentional Phase 1 scope (not deferred)

</specifics>

<deferred>
## Deferred Ideas

- PostGIS extension and geo columns/APIs — Phase 6
- Full Home marketing content and Report form RHF+Zod polish — Phase 2
- Citizen status page + token issuance UX — Phase 2/4 (table exists early per D-07)
- Dashboard data table, filters, export, resolve notes — Phase 3
- `user_roles` table + Custom Access Token Auth Hook RBAC — future if roles grow beyond officer/admin
- Local Supabase CLI stack — optional later; Cloud-only for Phase 1
- Dual-write BigQuery + Supabase transition window — rejected in favor of hard cutover

</deferred>

---

*Phase: 1-Supabase Foundation*
*Context gathered: 2026-07-20*
