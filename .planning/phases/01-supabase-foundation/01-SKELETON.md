# Walking Skeleton — CityMind AI

**Phase:** 1
**Generated:** 2026-07-20

## Capability Proven End-to-End

> A citizen can submit a real report through the public UI into Supabase, and a seeded officer can sign in, open the protected dashboard, and read/update that report through RLS-scoped FastAPI calls.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.10 App Router UI/BFF plus FastAPI 0.115.14 AI/API service | Preserves the shipped two-service boundary and Cloud Run path while giving browser sessions a server-side bridge. |
| Data layer | Supabase Cloud Postgres via `supabase==2.31.0`; BigQuery is migration input and later analytics only | Implements the hard operational cutover and keeps RLS at the datastore boundary. |
| Auth | Supabase Auth with `@supabase/ssr@0.12.3` cookies, verified JWTs, and `app_metadata.role` values `officer`/`admin` | Replaces shared secrets without introducing a second role system; Next and FastAPI independently enforce identity. |
| Authorization | Postgres RLS with a fresh caller-JWT client for officer CRUD; isolated service-role client for public ingest | Ensures officer access is database-enforced while retaining unauthenticated citizen submission. |
| Evidence | Private Supabase Storage bucket with storage path on the report row | Replaces GCS for new operational uploads and prevents public bucket reads. |
| UI system | shadcn new-york/Radix/zinc, CSS variables, Source Sans 3, Civic Teal `#0F766E` | Establishes the approved accessible civic shell shared by public and officer routes. |
| Localization | `next-intl@4.13.2`, EN/VI messages, no-prefix locale selection | Creates the Phase 1 bilingual scaffold without pulling Phase 2 marketing scope forward. |
| Deployment target | Existing two-container Cloud Run path connected to Supabase Cloud | Maintains project compatibility; Phase 1 can be exercised locally with the same environment contract. |
| Directory layout | `frontend/src/app` routes and BFF, `backend/app/api` controllers, `backend/app/services` integrations, `supabase/migrations` schema | Matches the existing codebase seams and keeps DB changes versioned. |

## Stack Touched in Phase 1

- [x] Project scaffold — existing Next.js/FastAPI build, lint, and test runners retained; audited dependencies exact-pinned
- [x] Routing — public `/`, `/report`, `/login`, protected `/dashboard`, and `/dashboard/reports/[reportId]`
- [x] Database — public report write plus officer report read/status-event write through Supabase
- [x] UI — report submission and locale/login/logout interactions wired through Next.js to FastAPI/Supabase
- [x] Deployment — documented local full-stack run path plus retained Cloud Run containers

## Smallest Real Read/Write Path

1. Citizen opens `/report` and submits the existing form to `/api/public/reports/analyze`.
2. The Next.js BFF forwards multipart input to FastAPI `POST /api/v1/reports/analyze`.
3. FastAPI analyzes the report, uploads optional evidence to the private Supabase bucket, and writes `public.reports` with the isolated service-role client.
4. A seeded officer signs in at `/login`; Supabase Auth stores SSR cookies and redirects to `/dashboard`.
5. Next.js forwards the current bearer token to a protected FastAPI endpoint; FastAPI validates it and creates a fresh caller-scoped Supabase client.
6. The officer reads the report and appends a status event; RLS permits the officer/admin role and blocks anonymous/wrong-role access.

## Local/Development Full-Stack Run Path

1. Configure backend `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SECRET_KEY`, JWT issuer/audience/JWKS values, and private evidence bucket; configure frontend public Supabase URL/publishable key plus `BACKEND_API_URL`.
2. Apply the versioned Cloud schema non-interactively with `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD` using `supabase link` followed by `supabase db push --linked`.
3. Run `cd backend && uvicorn app.main:app --reload`.
4. In a second terminal run `cd frontend && npm run dev`.
5. Open `http://localhost:3000/report`, submit a report, sign in through `http://localhost:3000/login` with a manually seeded officer, and verify it is available under `http://localhost:3000/dashboard`.

## Out of Scope (Deferred to Later Slices)

- Full Home marketing content and React Hook Form/Zod report polish — Phase 2
- Citizen status page and access-token issuance UX — Phases 2/4; Phase 1 creates the hashed-token table only
- Dashboard data table, filters, export, resolve notes, and polished report workflow — Phase 3
- BigQuery analytics ETL and analytics UI — Phase 5
- PostGIS, geo APIs, and MapLibre maps — Phase 6
- Expanded `user_roles`/custom access-token hook RBAC, local Supabase CLI stack, and dual-write cutover

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Citizens use a complete bilingual landing/report flow and receive report credentials.
- Phase 3: Officers triage reports through the polished data table, filters, export, and resolution workflow.
- Phase 4: Citizens privately track one report using its token-scoped status link.
- Phase 5: Analytics data flows from Supabase into BigQuery and appears as trends/SLA metrics.
- Phase 6: Officers inspect and filter incidents geospatially with PostGIS and MapLibre.
