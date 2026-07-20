# Summary: Phase 1 Plan 01 — Supabase Foundation (Track A)

Established the database schema, row-level security (RLS), FastAPI services (Sink and Storage), authenticated middleware verification via JWT JWKS, and seeding/migration utilities.

## What Was Built

1. **Database Schema & RLS Policies** (`supabase/migrations/20260720_000001_foundation.sql`):
   - Created `reports`, `status_events`, and `access_tokens` tables.
   - Enabled Row Level Security (RLS) on all tables.
   - Enforced role check policies where `officer`/`admin` has select/update access, public has insert only (via FastAPI), and delete is disallowed.
   - Created the private `evidence` storage bucket with matching RLS policies.

2. **Supabase Report Sink** (`backend/app/services/supabase.py`):
   - Implemented `SupabaseReportSink` matching the `BigQueryReportSink` method surface.
   - Enforced client-scoped client instantiation where officer requests use caller-scoped JWT clients to enforce RLS.
   - Integrated append-only status changes via inserting events into `status_events`.

3. **Supabase Storage Service** (`backend/app/services/storage.py`):
   - Configured `EvidenceStorage` to use Supabase Storage with custom mime-types and unique report folder structures.
   - Retained backward compatibility with GCS image lookup.

4. **FastAPI Security Middleware** (`backend/app/security.py`):
   - Replaced old shared officer API key with JWT verification using Supabase JWKS signature, issuer, audience, and role claims.
   - Enforced proper error-forwarding of HTTP exceptions.

5. **Seed & Migration Utilities** (`scripts/seed_reports.py`, `scripts/migrate_bigquery_to_supabase.py`):
   - Overwrote deterministic seed tool for Supabase.
   - Built a BigQuery-to-Supabase migration script featuring dry-run mode and target counts reconciliation checks.

## Verification & Testing

- Developed and passed **70 tests** across mock security, mock storage, mock supabase sink, and mock migration suites.
- Verified that seeding the database successfully inserts 10 reports and 4 status events and is 100% idempotent.
