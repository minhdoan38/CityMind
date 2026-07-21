# Phase 7: Next.js-Only Google-Free Platform - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate CityMind into one Next.js/Node.js/TypeScript application running directly on the user's laptop and connected to the user's existing self-hosted Supabase instance. Replace the Gemini/Vertex AI integration with a provider-neutral OpenAI-compatible interface authenticated by a third-party API key; replace BigQuery analytics with Supabase Postgres; migrate GCS evidence into Supabase Storage; and remove FastAPI, the Python backend, Docker, and every Google Cloud runtime/deployment integration. Google Fonts are the sole permitted Google dependency.

This phase preserves current citizen and officer behavior. Durable asynchronous triage is Phase 8, routing policy is Phase 9, and shadow rollout/evaluation is Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Application runtime
- **D-01:** CityMind becomes a **Next.js-only Node.js/TypeScript application**. UI, route handlers, AI orchestration, validation, database access, evidence handling, and officer operations live in the Next.js codebase.
- **D-02:** Remove FastAPI and the Python backend after behavior and tests are ported. Do not retain a parallel Python service or create a separate Node backend service.
- **D-03:** Preserve existing API behavior, security boundaries, bilingual citizen flows, officer authority, and privacy rules during the runtime migration.

### AI provider boundary
- **D-04:** Describe and configure AI access only as a **third-party API key**. Do not name or require a particular gateway or provider.
- **D-05:** The AI interface is OpenAI-compatible with configurable endpoint, model, and API key values so the provider/model can change without rewriting report-processing logic.
- **D-06:** Preserve structured multimodal report analysis, schema and semantic validation, failure handling, and provider/model lineage. AI output remains advisory; officers retain final authority.
- **D-07:** Remove Gemini, Vertex AI, Google AI SDKs, Google credentials, and provider-specific assumptions.

### Data and evidence cutover
- **D-08:** The existing self-hosted Supabase instance is the only application platform dependency for Postgres, Auth, and Storage; Phase 7 does not provision a second Supabase deployment.
- **D-09:** Replace BigQuery analytics, ETL, views, scheduled jobs, and dependencies with Supabase Postgres equivalents while preserving required dashboard analytics behavior.
- **D-10:** Migrate and verify retained BigQuery data before deleting its compatibility paths.
- **D-11:** Supabase Storage becomes the only evidence store. Migrate and verify retained `gs://` objects before removing GCS read compatibility.

### Laptop operation
- **D-12:** Run CityMind directly on the laptop as a Node.js application. Docker and container-based CityMind deployment are out of the target architecture.
- **D-13:** Phase 7 must document local environment configuration, secrets, startup/restart, health checks, and backup/restore procedures suitable for the laptop-hosted application.
- **D-14:** The existing self-hosted Supabase instance may have its own infrastructure, but CityMind Phase 7 neither owns nor introduces Docker orchestration for it.

### Google exit boundary
- **D-15:** Remove Cloud Run, Cloud Build, Artifact Registry, Secret Manager, IAM, Cloud Scheduler, Cloud Run Jobs, Vertex AI/Gemini, BigQuery, and GCS integrations.
- **D-16:** Remove associated packages, credentials, environment variables, configuration, deployment scripts, tests, compatibility code, and active documentation.
- **D-17:** Google Fonts are the sole explicit Google exception.
- **D-18:** Historical planning records may describe previously completed Google-based work, but no active runtime, deployment instruction, dependency, or compatibility path may require Google services.

### Agent's Discretion
- Exact Next.js module layout and Node.js libraries used to replace the Python services.
- Exact local Node.js process manager/startup mechanism, provided it does not require Docker.
- Exact migration tooling, reconciliation reports, backup implementation, and environment-variable names.
- Exact internal abstractions for provider switching, provided endpoint, model, and third-party API key remain configurable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` — authoritative Phase 7 goal, success criteria, sequencing, and plan outline.
- `.planning/REQUIREMENTS.md` — SELFHOST-01 through SELFHOST-06 and downstream TRIAGE phase mapping.
- `.planning/PROJECT.md` — product value, privacy, and officer-authority constraints. Its FastAPI, BigQuery, Gemini, and Cloud Run architecture statements are superseded by Phase 7 decisions in this file and the roadmap.

### Existing architecture
- `.planning/codebase/STACK.md` — current TypeScript/Python dependencies and runtime inventory to migrate or remove.
- `.planning/codebase/ARCHITECTURE.md` — current Next.js-to-FastAPI flow and service boundaries that must be converged into Next.js.
- `.planning/codebase/INTEGRATIONS.md` — current Vertex AI, BigQuery, GCS, Cloud Run, credentials, and third-party integration inventory.

### Prior behavior contracts
- `.planning/phases/04-citizen-status/04-CONTEXT.md` — citizen token privacy and status payload boundaries that must survive the runtime rewrite.
- `.planning/phases/05-analytics-pipeline/05-CONTEXT.md` — analytics behavior and privacy decisions to preserve while replacing BigQuery.
- `.planning/phases/06-maps-geospatial/06-CONTEXT.md` — PostGIS and map behavior already tied to Supabase Postgres.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/app/api/**/route.ts`: existing Next.js route-handler/BFF pattern is the destination for backend API behavior.
- `frontend/src/lib/backend.ts`: current frontend-to-backend boundary identifies calls that can become direct server-side module calls.
- `frontend/src/lib/auth.ts`: server-only officer session pattern should remain intact.
- `backend/app/api/reports.py`: source contract for report, analytics, status, and evidence endpoints to port before removal.
- `backend/app/services/gemini.py`: source behavior for structured report analysis; provider-specific code must not be copied into the new boundary.
- `backend/app/services/bigquery.py` and `backend/app/services/storage.py`: legacy behavior and migration inventory for removal.

### Established Patterns
- Next.js App Router already owns the public and officer web boundary and uses server-only route handlers for privileged calls.
- Supabase Postgres/Auth/Storage already serve operational workflows; Phase 7 extends them instead of introducing another platform.
- Pydantic schemas currently define structured report output; equivalent runtime validation must exist in TypeScript before Python removal.
- AI decisions are advisory and auditable; officer actions remain authoritative.

### Integration Points
- Public report submission and evidence upload route handlers.
- Officer report list/detail/status/image route handlers.
- Analytics queries and dashboard data loaders.
- Supabase server client, RLS/JWT boundary, Postgres schema, and Storage buckets.
- Environment examples, startup scripts, deployment documentation, tests, and dependency manifests.

</code_context>

<specifics>
## Specific Ideas

- The user wants one Next.js/Node.js application, not a separate Node backend.
- The application runs on the user's laptop and connects to an already self-hosted Supabase instance.
- AI configuration must say “third-party API key” without naming a particular gateway.
- Docker is explicitly removed from Phase 7.

</specifics>

<deferred>
## Deferred Ideas

- Durable asynchronous triage execution, retries, and worker lifecycle — Phase 8.
- Self-help versus government routing — Phase 9.
- Shadow rollout and production evaluation — Phase 10.

</deferred>

---

*Phase: 07-nextjs-only-google-free-platform*
*Context gathered: 2026-07-21*
