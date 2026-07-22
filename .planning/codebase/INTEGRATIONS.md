# External Integrations

**Analysis Date:** 2026-07-22 (Phase 7 — Next.js-only platform)

## APIs & External Services

**Third-party AI (structured analysis):**

- Provider-neutral HTTP API — JSON-schema shaped incident triage
- Implementation: `frontend/src/server/ai/` (`provider.ts`, analyzers)
- Auth: `THIRD_PARTY_API_KEY` (server-only)
- Config: `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS`

**OpenWeather / Nominatim (optional urban context):**

- Deferred/disabled in current self-hosted path; enrichment hooks remain in server modules for future enablement

## Data Storage

**Supabase Postgres:**

- Operational store for reports, access tokens, status events, analytics RPCs
- Migrations: `supabase/migrations/`
- Live contracts: `supabase/tests/07_*.sql`

**Supabase Storage:**

- Private `evidence` bucket
- Object paths stored in `reports.evidence_path`
- Upload/download: `frontend/src/server/services/evidence-service.ts`

## Authentication & Identity

**Supabase Auth (officers):**

- Email/password login via `/login`
- Authorization: `supabase.auth.getClaims()` + `app_metadata.role` (`officer` | `admin`)
- SSR clients: `frontend/src/lib/supabase/server.ts`, `proxy.ts` dashboard gate

**Citizen access tokens:**

- Anonymous submit; SHA-256 hashed token at rest
- Status lookup scoped to presented token only

## Google Services

**Allowed:**

- Google Fonts via `next/font/google` in `frontend/src/lib/fonts.ts` only

**Removed from active runtime:**

- Vertex AI / Gemini SDKs
- BigQuery
- Google Cloud Storage (`gs://`)
- Cloud Run deployment

Remote Google resources may still exist as inventory-only; local deletion is out of scope unless separately authorized.

## Monitoring & Health

- `/api/health` — process liveness
- `/api/ready` — Supabase dependency check (allowlisted response fields only)
- `npm run smoke:production` — loopback build/start contract test
