# Phase 1: Supabase Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 1-Supabase Foundation
**Areas discussed:** API ↔ Auth bridge, Schema & cutover, Supabase client model, UI scaffold depth

---

## API ↔ Auth bridge

### Q1 — FastAPI officer auth

| Option | Description | Selected |
|--------|-------------|----------|
| JWT end-to-end | Next forwards Supabase JWT; FastAPI validates JWKS; drop OFFICER_API_KEY for browser calls | ✓ |
| Hybrid | Supabase UI login; Next BFF keeps service key to FastAPI | |
| Service-role only | FastAPI always service role; Next verifies session only | |
| You decide | | |

**User's choice:** JWT end-to-end

### Q2 — Role representation

| Option | Description | Selected |
|--------|-------------|----------|
| app_metadata.role | officer \| admin in app_metadata | ✓ |
| user_roles + Auth Hook | Full RBAC tables | |
| Single officer role | No admin in Phase 1 | |
| You decide | | |

**User's choice:** app_metadata.role

### Q3 — Next.js session

| Option | Description | Selected |
|--------|-------------|----------|
| @supabase/ssr cookies | Replace HMAC session | ✓ |
| Keep thin CityMind cookie | Dual session systems | |
| You decide | | |

**User's choice:** @supabase/ssr

### Q4 — Officer provisioning

| Option | Description | Selected |
|--------|-------------|----------|
| Manual seed | Dashboard or seed script; no open signup | ✓ |
| Invite-only email | Supabase invite flow | |
| Open signup + role gate | Riskier | |
| You decide | | |

**User's choice:** Manual seed

---

## Schema & cutover

### Q1 — Schema shape

| Option | Description | Selected |
|--------|-------------|----------|
| Near-mirror + JSONB | Familiar columns; JSONB for arrays/context | ✓ |
| Normalized | Split tables; heavier migration | |
| You decide | | |

**User's choice:** Near-mirror + JSONB

### Q2 — access_tokens table

| Option | Description | Selected |
|--------|-------------|----------|
| Include now | Schema ready for Phase 2 | ✓ |
| Defer to Phase 2 | Leaner Phase 1 | |
| You decide | | |

**User's choice:** Include now

### Q3 — Cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Hard cutover after migration | Replace BigQueryReportSink | ✓ |
| Feature-flag dual-path | Temporary dual sinks | |
| You decide | | |

**User's choice:** Hard cutover

### Q4 — PostGIS

| Option | Description | Selected |
|--------|-------------|----------|
| Enable now, no geo APIs | Prep for Phase 6 | |
| Skip until Phase 6 | Leaner Phase 1 | ✓ |
| You decide | | |

**User's choice:** Skip until Phase 6

---

## Supabase client model

### Q1 — Key usage

| Option | Description | Selected |
|--------|-------------|----------|
| JWT for officers + service role for public ingest | RLS on officer paths | ✓ |
| Service role only | Auth only in FastAPI | |
| User JWT everywhere | Anon insert policies | |
| You decide | | |

**User's choice:** JWT + service role split

### Q2 — Python access

| Option | Description | Selected |
|--------|-------------|----------|
| supabase-py | Official client | ✓ |
| Direct Postgres | asyncpg/SQLAlchemy | |
| You decide | | |

**User's choice:** supabase-py

### Q3 — Dev environment

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Cloud only | Env vars in .env | ✓ |
| Local Supabase CLI | supabase start | |
| Both | CLI + Cloud | |
| You decide | | |

**User's choice:** Cloud only

### Q4 — Migrations location

| Option | Description | Selected |
|--------|-------------|----------|
| supabase/migrations/ | Standard layout | ✓ |
| infra/supabase/ | Mirror bigquery infra style | |
| You decide | | |

**User's choice:** supabase/migrations/

---

## UI scaffold depth

### Q1 — Visual system depth

| Option | Description | Selected |
|--------|-------------|----------|
| Theme tokens + core shadcn | Brand tokens + primitives | ✓ |
| Minimal install only | Style later | |
| Full Home draft now | Scope creep into Phase 2 | |
| You decide | | |

**User's choice:** Theme tokens + core shadcn

### Q2 — Evidence storage

| Option | Description | Selected |
|--------|-------------|----------|
| Keep GCS | Lowest risk | |
| Migrate to Supabase Storage in Phase 1 | Unified vendor | ✓ |
| You decide | | |

**User's choice:** Supabase Storage in Phase 1

### Q3 — i18n scaffold

| Option | Description | Selected |
|--------|-------------|----------|
| next-intl EN/VI scaffold | Locale switcher + placeholder strings | ✓ |
| EN-only scaffold | i18n in Phase 2 | |
| You decide | | |

**User's choice:** next-intl wired

### Q4 — Routes

| Option | Description | Selected |
|--------|-------------|----------|
| Home at /; dashboard at /dashboard | Landing-first | ✓ |
| Keep / as dashboard; Home at /home | Less churn | |
| You decide | | |

**User's choice:** `/` public Home; `/dashboard` officers

---

## Agent Discretion

- JWKS middleware implementation details
- Exact RLS SQL
- Legacy GCS demo image migration vs refresh seed only
- Exact shadcn component list beyond core
- Seed script format

## Deferred Ideas

- PostGIS / maps → Phase 6
- Full landing + RHF/Zod report polish → Phase 2
- Citizen status UX → Phase 2/4
- Dashboard table/export → Phase 3
- Full Auth Hook RBAC → later if needed
