# Phase 7: Next.js-Only Google-Free Platform - Research

**Researched:** 2026-07-21
**Domain:** Next.js backend convergence, provider-neutral multimodal AI, Supabase data/storage migration, Windows laptop operations, and Google Cloud exit
**Confidence:** MEDIUM-HIGH — target architecture and current application boundaries are well verified; retained BigQuery/GCS state and the selected third-party endpoint cannot yet be inspected.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- Durable asynchronous triage execution, retries, and worker lifecycle — Phase 8.
- Self-help versus government routing — Phase 9.
- Shadow rollout and production evaluation — Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SELFHOST-01 | All FastAPI routes and Python backend services are ported to Next.js/Node.js/TypeScript, with existing API behavior and security boundaries preserved | Compatibility-handler plus server-module architecture, endpoint inventory, golden contract fixtures, and user-scoped Supabase access. [VERIFIED: codebase grep] |
| SELFHOST-02 | AI analysis uses a configurable OpenAI-compatible endpoint, model, and third-party API key; Gemini, Vertex AI, Google credentials, and Google AI SDKs are removed | Narrow provider port, Zod-to-JSON-Schema contract, multimodal request, response validation, actual model/request lineage, and a capability smoke gate. [CITED: https://platform.openai.com/docs/api-reference/chat/create] |
| SELFHOST-03 | Operational and analytics workloads use the existing self-hosted Supabase Postgres instance; retained BigQuery data is migrated and BigQuery ETL/views/jobs are removed | Postgres RPC/view design, source/target inventory, reconciliation manifest, rollback snapshot, and deletion gate. [VERIFIED: codebase grep] |
| SELFHOST-04 | Evidence uses Supabase Storage only; retained `gs://` objects are migrated and verified before GCS support is removed | Additive `evidence_path` migration, object checksum/size/MIME reconciliation, private-bucket serving, and legacy URI deletion gate. [CITED: https://supabase.com/docs/guides/storage/security/access-control] |
| SELFHOST-05 | CityMind runs directly on the laptop as a Node.js application with documented local configuration, startup/restart, health checks, and backups; Docker is removed | `next build`/`next start`, Windows Task Scheduler, loopback-by-default exposure, health checks, graceful stop, DB/object backup and restore drill. [CITED: https://nextjs.org/docs/app/guides/self-hosting] |
| SELFHOST-06 | Cloud Run, Cloud Build, Artifact Registry, Secret Manager, IAM, Cloud Scheduler, Cloud Run Jobs, Google packages/configuration/credentials/scripts/tests/docs are removed; Google Fonts are the sole exception | Manifest-aware source/build/runtime scanner with an explicit Google Fonts allowlist and separately justified immutable-history exclusions. [VERIFIED: codebase grep] |
</phase_requirements>

## Summary

Phase 7 should be planned as a staged strangler-and-delete migration inside the existing `frontend/` application, not as a second rewrite beside it. Keep the browser-facing routes and response shapes stable, put all domain work in `server-only` TypeScript modules, expose thin `/api/v1/**` compatibility Route Handlers for the former FastAPI surface, and let Server Components call the domain/repository modules directly. Next.js explicitly recommends direct data-source access from Server Components because self-fetching Route Handlers adds an HTTP round trip and can fail during prerendered builds. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]

The irreversible sequence is: capture parity fixtures and migration inventories; add TypeScript schemas/repositories/services; port routes; cut AI to a configurable OpenAI-compatible adapter; add Postgres analytics and Storage-only evidence; run live reconciliation and restore drills; prove the laptop production process; then remove Python, Docker, Google code/config/credentials/tests/docs. Retained Google sources must remain read-only until signed reconciliation passes. Current live Supabase has 10 reports, 4 status events, zero access-token rows, one evidence object, and report URI schemes `{null: 9, supabase://: 1, gs://: 0}`; BigQuery could not be inventoried because neither Google ADC nor the Google CLI is available. [VERIFIED: live Supabase probe, 2026-07-21] [VERIFIED: environment probe]

The AI seam should be intentionally narrow: a server-only adapter accepts text plus an optional validated image and returns a Zod-validated `ReportAnalysis` together with configured provider label, actual response model, request ID, and latency. Use native Node `fetch`, a configurable base URL/model, a server-only `THIRD_PARTY_API_KEY`, strict JSON-schema response format, a timeout, bounded response reads, and generic client errors. An “OpenAI-compatible” label does not guarantee that a selected endpoint supports strict JSON Schema and image content parts, so a real capability smoke test is a cutover gate, not an optional test. [CITED: https://platform.openai.com/docs/api-reference/chat/create] [ASSUMED: compatibility varies by endpoint]

**Primary recommendation:** Plan five ordered tracks matching the roadmap: (A) contract tests plus Next.js server convergence, then (B) provider cutover and (C) Postgres/Storage migration in parallel, then (D) direct laptop operations, and finally (E) reconciliation-gated deletion and Google-exit audit. [VERIFIED: `.planning/ROADMAP.md`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Citizen/officer HTTP compatibility | Frontend Server (Next.js Route Handlers) | Browser / Client | Route Handlers preserve request/response/status behavior; browser code remains thin. [CITED: https://nextjs.org/docs/app/getting-started/route-handlers] |
| Report orchestration and validation | Frontend Server (`src/server`) | API compatibility handlers | One server-only domain layer prevents logic duplication across UI loaders and HTTP routes. [VERIFIED: codebase route inventory] |
| Officer authentication/authorization | Frontend Server + Supabase Auth | Database / RLS | `getClaims()` verifies role; user-scoped Supabase clients preserve RLS on officer operations. [VERIFIED: `frontend/src/lib/auth.ts`] |
| Public token verification | Frontend Server | Database / Storage | Only a trusted server module may use the service role to look up token hashes; citizen responses remain token-scoped and uniform. [VERIFIED: `backend/app/api/reports.py`] |
| AI analysis | External third-party API | Frontend Server adapter | The endpoint performs inference; CityMind owns validation, policy, lineage, timeout, and advisory presentation. [CITED: https://platform.openai.com/docs/api-reference/chat/create] |
| Operational persistence | Supabase Postgres | Frontend Server repository | Tables, transactional RPCs, indexes, and RLS own durable state; TypeScript maps domain objects to DB rows. [VERIFIED: Supabase migrations] |
| Analytics | Supabase Postgres views/RPCs | Frontend Server mapper | Aggregation belongs near the data; Node should map returned rows rather than pull entire tables. [VERIFIED: current BigQuery query inventory] |
| Evidence | Supabase Storage private bucket | Frontend Server route | Storage owns object bytes; authenticated Route Handler streams bytes without exposing service credentials or public URLs. [CITED: https://supabase.com/docs/guides/storage/serving/downloads] |
| Startup/restart | Windows Task Scheduler | Next.js Node process | Native scheduled tasks support startup/logon triggers and restart settings without adding a daemon package. [CITED: https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset?view=windowsserver2025-ps] |
| Google-exit verification | Build/tooling | OS/runtime inventory | Static scanning alone cannot detect scheduled tasks, images, credentials, or remote service configuration. [VERIFIED: runtime-state audit]

## Project Constraints (from AGENTS.md)

- Preserve advisory-only AI and human officer decision authority; access tokens remain hashed at rest; citizen status access remains report-token scoped with no cross-report leakage. [VERIFIED: `AGENTS.md`]
- Preserve bilingual EN/VI citizen behavior, the existing self-hosted Supabase operational/auth boundary, and the already-established dashboard behavior. [VERIFIED: `AGENTS.md` and Phase 7 CONTEXT]
- Follow existing TypeScript conventions: descriptive PascalCase components, camelCase functions and variables, explicit local types, named utility exports, default route/page exports, direct imports, and ESLint/TypeScript checks. [VERIFIED: `AGENTS.md`]
- Keep guard-clause validation, generic public error messages, `res.ok` checks, and short delegating functions. [VERIFIED: `AGENTS.md`]
- The older generated statements “keep FastAPI,” “BigQuery analytics-only,” and “maintain Cloud Run” conflict with and are explicitly superseded by Phase 7 D-01, D-02, D-09, and D-15. The planner must follow the newer phase-specific locked decisions and refresh active generated documentation during the Google-exit track. [VERIFIED: `07-CONTEXT.md` canonical-reference note]
- Repository edits must occur through a GSD workflow; this forced research run satisfies that gate for the research artifact only. [VERIFIED: `AGENTS.md`]
- No project-local skill directories were reported by the generated project skill inventory. [VERIFIED: `AGENTS.md`]

## Current Contract and Removal Inventory

### FastAPI surface that must exist before Python deletion

| Method/path | Required behavior to port |
|-------------|---------------------------|
| `GET /health` | Liveness response. [VERIFIED: `backend/app/main.py`] |
| `POST /api/v1/reports/analyze` | Multipart text/image, separate report rate limit, 3,000-char description, JPEG/PNG/WebP magic-byte validation, configured byte limit, synchronous analysis, evidence upload, persistence, and issue-once access token. [VERIFIED: `backend/app/api/reports.py`] |
| `POST /api/v1/reports/status` | Separate status limiter, SHA-256 token lookup, report binding/expiry check, uniform 401, citizen-safe history without actor ID. [VERIFIED: codebase tests and `reports.py`] |
| `GET /api/v1/reports/recent` | Officer auth, filters, keyset cursor, sort/order validation, page limit 1–100. [VERIFIED: `reports.py` and `supabase.py`] |
| `GET /api/v1/reports/summary` | Officer auth and same filters as list. [VERIFIED: `reports.py`] |
| `GET /api/v1/reports/geo/pins` | Officer auth, viewport/bbox validation, report filters, PostGIS RPC. [VERIFIED: `reports.py` and Phase 6 migrations] |
| `GET /api/v1/reports/export` | Officer auth, CSV/XLSX, identical filters, 10k soft cap, attachment headers. [VERIFIED: `reports.py`] |
| `PATCH /api/v1/reports/:id/status` | Officer auth; status enum; note required for resolved/rejected; actor ID recorded. [VERIFIED: `reports.py`] |
| `GET /api/v1/reports/:id/image` | Officer auth, private evidence fetch, 404 for missing image. [VERIFIED: `reports.py`] |
| `GET /api/v1/reports/:id/status-history` | Officer auth, existence check, status/note/actor/timestamp history. [VERIFIED: `reports.py`] |
| `GET /api/v1/reports/:id` | Officer auth and 404 for missing report. [VERIFIED: `reports.py`] |
| `GET /api/v1/analytics` | Officer auth, `from`/`to`, maximum 366-day span, volume/category/SLA/hotspots, explicit empty flag. [VERIFIED: `backend/app/api/analytics.py` and `services/analytics.py`] |
| `GET /api/v1/public/stats` | Separate limiter, last-30-day totals/top categories, k≥3 category disclosure threshold, hide-on-failure UI behavior. [VERIFIED: Phase 5 code and STATE decisions] |

Current UI callers use both browser-facing BFF routes under `app/api/public|officer/**` and direct server-side `officerFetch`/`backendEndpoint` calls from dashboard pages and `PublicStatsStrip`. The port must replace server-side self-fetches with direct modules and keep HTTP handlers only where a browser/external client needs HTTP compatibility. [VERIFIED: codebase grep] [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]

### Structured analysis contract

`ReportAnalysis` currently contains category, severity 1–5, confidence 0–1, summary, recommendation, priority, estimated impact, up to eight evidence strings, and up to eight uncertainty strings. The response contains `report_id`, `analysis`, `persisted`, and an optional issue-once `access_token`. [VERIFIED: `backend/app/schemas.py`]

The legacy implementation has JSON/Pydantic structural validation and advisory/evidence instructions but no separate deterministic semantic validator or audit-run table. Do not silently claim semantic parity: Phase 7 should create a pure `validateAnalysisPolicy()` seam and apply only locked invariants; Phase 8 owns durable `manual_review`, retries, and full triage audit semantics. [VERIFIED: `backend/app/services/gemini.py` and `.planning/notes/async-triage-architecture.md`] [ASSUMED: exact Phase 7 semantic rules require plan-level specification]

## Standard Stack

### Core

| Library/runtime | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| Next.js | 16.2.10 | UI, Server Components, Route Handlers, production Node server | Already locked and installed; official BFF and self-hosting support cover the target. [VERIFIED: codebase package-lock + https://nextjs.org/docs/app/guides/self-hosting] |
| Node.js | 22.x target | Direct laptop runtime, native `fetch`, Web `Request`/`Response`, crypto, streams | Matches project runtime constraint and `file-type` minimum; pin an LTS release rather than relying on the machine's current Node 25.2.1. [VERIFIED: `AGENTS.md`; environment probe] |
| TypeScript | 5.x | Shared domain, config, route, repository, and test types | Already installed and required by D-01. [VERIFIED: `frontend/package.json`] |
| `@supabase/supabase-js` | 2.110.7 | Postgres REST/RPC and Storage operations | Already installed; current registry version matched on 2026-07-21. [VERIFIED: codebase package-lock + npm registry] |
| `@supabase/ssr` | 0.12.3 | Cookie-aware officer Auth client | Already installed and used by the verified `getClaims()` boundary. [VERIFIED: codebase package-lock] |
| Zod | 4.4.3 | Environment, request, AI response, DB-row, and API response validation; JSON Schema generation | Already installed; Zod 4 officially exposes `z.toJSONSchema()`. [VERIFIED: codebase package-lock + https://zod.dev/json-schema] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `file-type` [VERIFIED: npm registry] | 22.0.1 | Magic-byte detection from `Uint8Array`/`ArrayBuffer` | Public evidence uploads before any Storage or AI call; do not trust filename or `Content-Type`. [CITED: https://github.com/sindresorhus/file-type#readme] |
| `exceljs` [VERIFIED: npm registry] | 4.4.0 | Preserve XLSX export | Officer export only; escape formula-leading values and retain the 10k row cap. [CITED: https://github.com/exceljs/exceljs#readme] |
| `vitest` [WARNING: slopcheck flagged as suspicious — verify before using.] | 4.1.10 | Fast TypeScript unit/contract tests for server modules | Add after a human checkpoint; Next.js documents Vitest, while slopcheck emitted a likely false-positive “close to vite” warning. [CITED: https://nextjs.org/docs/app/guides/testing/vitest] |
| Native Node `fetch`, `AbortSignal.timeout`, `crypto`, Web Streams | Node 22.x | Provider HTTP, timeouts, tokens/hashes, streaming CSV/evidence | Avoid a provider SDK so endpoint/model remain configuration and no provider-specific runtime package enters the graph. [CITED: https://nodejs.org/api/globals.html#class-abortsignal] |
| Windows Scheduled Tasks | OS built-in | Startup/logon trigger and restart-on-failure | Preferred over PM2 because it is available without another package and supports restart settings. [CITED: https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset?view=windowsserver2025-ps] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTTP provider adapter | A provider SDK | SDK convenience would couple the application to provider-specific types/features and can weaken D-05/D-07. Use native `fetch`. [ASSUMED] |
| Postgres SQL views/RPCs | Aggregate full report sets in Node | Node aggregation is easier initially but transfers more data and duplicates database semantics. Use SQL/RPCs. [VERIFIED: current analytics query shapes] |
| Windows Task Scheduler | PM2/global daemon | PM2 is absent and Windows startup integration would add another operational dependency. Use native scheduled tasks. [VERIFIED: environment probe] |
| ExcelJS | Drop XLSX or hand-write OOXML | Dropping XLSX breaks current API behavior; OOXML is complex and unsafe to hand-roll. Use ExcelJS. [VERIFIED: current export contract] |
| Vitest | Keep only source-string `.mjs` tests | Existing static assertions are useful regression checks but do not execute the ported services, validation, auth, or migration logic. Add behavioral tests. [VERIFIED: frontend test inventory] |

**Installation:**

```bash
cd frontend
npm install file-type@22.0.1 exceljs@4.4.0
# Only after the slopcheck SUS human-verification checkpoint:
npm install --save-dev vitest@4.1.10
```

Registry versions and publish metadata were checked on 2026-07-21; none of the three packages declares a `postinstall` script in registry metadata. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `file-type` | npm | since 2014-04-24 | 52,038,288/week (2026-07-13..19) | `github.com/sindresorhus/file-type` | OK | Approved; official README and registry agree. [VERIFIED: npm registry] |
| `exceljs` | npm | since 2014-12-09 | 11,121,522/week (2026-07-13..19) | `github.com/exceljs/exceljs` | OK | Approved; official repository and registry agree. [VERIFIED: npm registry] |
| `vitest` | npm | since 2021-12-03 | 79,904,357/week (2026-07-13..19) | `github.com/vitest-dev/vitest` | SUS (`TYPOSQUAT_RISK`, close to `vite`) | Flagged — planner must add `checkpoint:human-verify`; official Next.js docs independently name it. [CITED: https://nextjs.org/docs/app/guides/testing/vitest] |

**Packages removed due to slopcheck [SLOP] verdict:** none. [VERIFIED: slopcheck]

**Packages flagged as suspicious [SUS]:** `vitest` — planner inserts a human-verification checkpoint before install. [VERIFIED: slopcheck]

## Architecture Patterns

### System Architecture Diagram

```text
Citizen browser                      Officer browser / Server Component
      | multipart/status                       | cookie/JWT
      v                                         v
Next.js public Route Handlers          Next.js officer Route Handlers / pages
      | validate + rate limit                   | getClaims() + role guard
      +--------------------+--------------------+
                           v
                 server-only application services
       input -> analysis schema -> AI adapter -> policy validation
         |              |              | fail -> generic 502 (Phase 7 sync)
         |              |              +------> lineage
         |              v
         |       evidence service -----------------> third-party AI endpoint
         |              |
         v              v
     report repository / analytics repository
         |              |
         +--------------+--------------------------> existing self-hosted Supabase
                                                        | Postgres + RLS/RPC
                                                        | Auth
                                                        | private Storage

Migration-only boundary (removed after signed reconciliation):
BigQuery + GCS -- read-only export/copy --> manifests/checksums --> Supabase
```

The main branch points are authorization (public trusted-server path versus officer user-scoped path), AI success/failure, Storage presence/absence, and migration reconciliation pass/fail. [VERIFIED: current architecture and locked decisions]

### Recommended Project Structure

```text
frontend/
├── src/app/api/v1/                  # exact former FastAPI compatibility handlers
├── src/app/api/public|officer/      # existing browser BFF routes; delegate, never self-fetch
├── src/server/
│   ├── config/env.ts                # Zod-validated server-only configuration
│   ├── domain/report-analysis.ts    # Zod schemas, JSON Schema, types
│   ├── ai/provider.ts               # stable interface + lineage types for Phase 8
│   ├── ai/openai-compatible.ts      # configurable HTTP adapter only
│   ├── validation/analysis-policy.ts
│   ├── repositories/reports.ts      # user/admin client injection
│   ├── repositories/analytics.ts    # Postgres RPC result mapping
│   ├── services/report-service.ts   # synchronous Phase 7 orchestration
│   ├── services/evidence-service.ts
│   ├── security/access-tokens.ts
│   ├── security/rate-limit.ts
│   └── exports/reports.ts
├── scripts/
│   ├── migrate-google-data.ts|ps1   # temporary; deleted after signed manifest
│   ├── reconcile-migration.ts
│   ├── google-exit-audit.mjs
│   ├── register-citymind-task.ps1
│   ├── backup-citymind.ps1
│   └── restore-citymind.ps1
├── tests/contracts/                 # captured API and AI fixtures
├── tests/migration/                 # reconciliation/audit tests
├── vitest.config.mts
└── package.json

supabase/migrations/
├── ...existing immutable migrations
├── *_next_backend_contract.sql      # constraints + transactional RPCs
├── *_postgres_analytics.sql         # views/functions/indexes
└── *_evidence_path_cutover.sql      # additive backfill then legacy drop gate
```

This layout keeps provider, repository, policy, and orchestration independent so Phase 8 can call the same provider from a durable runner without preserving a synchronous HTTP dependency. [VERIFIED: downstream TRIAGE-05 requirement]

### Pattern 1: Domain Modules, Thin Route Adapters

**What:** Put validation and business work in ordinary server-only functions. Route Handlers translate Web requests/responses; Server Components import repositories/services directly. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]

**When to use:** Every former FastAPI endpoint and every current `officerFetch()` from a Server Component. [VERIFIED: codebase grep]

```typescript
// Source: https://nextjs.org/docs/app/getting-started/route-handlers
import { analyzeReport } from "@/server/services/report-service";
import { toPublicError } from "@/server/http/errors";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const result = await analyzeReport({ form, request });
    return Response.json(result, { status: 200 });
  } catch (error) {
    return toPublicError(error); // stable status/shape; no provider or stack details
  }
}
```

### Pattern 2: Two Explicit Supabase Server Clients

**What:** Inject either an officer JWT-scoped client or a service-role client. Never choose implicitly inside a repository method. Officer reads/writes must use the JWT client so RLS remains part of authorization; service role is limited to trusted public ingest, token verification, migration, and health probes. [VERIFIED: existing `frontend/src/lib/auth.ts` and Supabase repository behavior]

```typescript
// Source: https://supabase.com/docs/reference/javascript/initializing
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(serverEnv.SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Existing cookie-aware createClient() remains the officer/RLS client.
```

### Pattern 3: Provider Port with Structural Validation and Lineage

**What:** Build one provider port that accepts domain input and returns `{analysis, lineage}`. Generate the outbound JSON Schema from the same Zod schema used to parse the inbound model response. [CITED: https://zod.dev/json-schema]

```typescript
// Sources: https://zod.dev/json-schema and
// https://platform.openai.com/docs/api-reference/chat/create
import { z } from "zod";

export const ReportAnalysisSchema = z.object({
  category: z.enum(["pothole", "flooding", "waste", "streetlight", "obstruction", "other"]),
  severity: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(5).max(500),
  recommendation: z.string().min(5).max(1000),
  priority: z.enum(["low", "medium", "high", "critical"]),
  estimated_impact: z.string().min(3).max(500),
  evidence: z.array(z.string()).max(8),
  uncertainty: z.array(z.string()).max(8),
}).strict();

export const reportAnalysisJsonSchema = z.toJSONSchema(ReportAnalysisSchema);
```

The example copies the exact current Python category and priority enum values. [VERIFIED: `backend/app/schemas.py`]

```typescript
// Source protocol: https://platform.openai.com/docs/api-reference/chat/create
const response = await fetch(new URL("chat/completions", normalizedBaseUrl), {
  method: "POST",
  redirect: "error",
  signal: AbortSignal.timeout(serverEnv.AI_TIMEOUT_MS),
  headers: {
    Authorization: `Bearer ${serverEnv.THIRD_PARTY_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: serverEnv.AI_MODEL,
    temperature: 0.1,
    messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, userMessage],
    response_format: {
      type: "json_schema",
      json_schema: { name: "report_analysis", strict: true, schema: reportAnalysisJsonSchema },
    },
  }),
});
```

Normalize the configured base URL exactly once and append a fixed relative path; never accept an endpoint from request data. Require HTTPS except for an explicit loopback-development exception, reject redirects, cap response bytes, redact authorization headers and upstream bodies from logs/errors, and store the actual response `model`/request ID rather than only the configured values. [ASSUMED: provider security hardening] [CITED: https://platform.openai.com/docs/api-reference/chat/create]

### Pattern 4: Additive Migration and Reconciliation Gate

**What:** Add new Postgres columns/functions first, backfill/copy, dual-read only during a bounded verification window, switch all writers, reconcile, then drop legacy names/readers in the final cleanup. [VERIFIED: D-10/D-11]

**Required evidence:** source and target row counts; primary-key set differences; min/max timestamps; null distributions; deterministic canonical row hashes; analytics totals by day/category/status; object source/target byte counts, MIME types, and SHA-256; every conflict and resolution; tool/version/timestamp; and signed pass/fail. [ASSUMED: reconciliation design]

**Rollback:** preserve a pre-cutover database dump, the read-only Google sources, the migration manifest, and the last Python-capable git revision until restore and application rollback are both rehearsed. Never use “migration script exited 0” as the deletion gate. [ASSUMED: rollback design]

### Pattern 5: Transactional Database RPCs

**What:** Replace multi-call state changes with `SECURITY INVOKER` Postgres functions that atomically update the report and insert its status event, while RLS/role checks remain effective. Public report/token creation should likewise avoid a durable report without its corresponding token record. [VERIFIED: current two-call inconsistency in `SupabaseReportSink.update_status()`]

**When to use:** status transitions and any write requiring two or more tables. Keep Storage outside the DB transaction and compensate by deleting an uploaded object if the DB write fails. [ASSUMED: compensation pattern]

### Anti-Patterns to Avoid

- **Server Component calls its own Route Handler:** creates an avoidable network hop and can fail at build time; import the server module directly. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]
- **One all-powerful Supabase client:** service-role use on officer paths bypasses RLS; inject a user-scoped client. [VERIFIED: existing RLS intent]
- **“OpenAI-compatible” means feature-compatible:** strict schema and image support must pass a real endpoint smoke fixture before cutover. [ASSUMED]
- **Delete then migrate:** Google code/credentials are temporary migration dependencies and may only be removed after signed reconciliation. [VERIFIED: D-10/D-11]
- **Rename `image_gcs_uri` in code only:** stored rows and immutable applied migrations survive source edits; use an additive DB migration and explicit runtime-state audit. [VERIFIED: live DB schema]
- **Bring Phase 8 forward:** do not create a worker, retries, durable triage states, or `manual_review` queue here; provide an adapter seam only. [VERIFIED: deferred decisions]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime/request/AI schema validation | Ad hoc `typeof` chains | Existing Zod 4 schema and `safeParse` | One schema can validate and generate JSON Schema; hand checks drift. [CITED: https://zod.dev/json-schema] |
| Image type detection | Extension or MIME-header trust | `file-type` magic-byte detection | The official API detects from buffer magic numbers. [CITED: https://github.com/sindresorhus/file-type#readme] |
| XLSX serialization | ZIP/XML templates | ExcelJS | XLSX is a compound format and current API behavior includes it. [VERIFIED: current export route] |
| Auth tokens and sessions | Custom officer cookies/JWT parsing | Existing Supabase SSR/Auth `getClaims()` flow | The current project already has the correct role seam. [VERIFIED: `frontend/src/lib/auth.ts`] |
| Access-token crypto | Home-grown cipher or plaintext | Node `randomBytes`, SHA-256, expiry, uniform lookup response | Tokens are high-entropy bearer secrets and current behavior hashes at rest. [VERIFIED: Phase 2 decisions]
| Complex analytics in Node | Fetch-all/group-by loops | Postgres views and RPC functions | Keeps filtering/aggregation close to indexed data. [VERIFIED: current analytics SQL semantics]
| Database backup format | JSON dumps through PostgREST | Supported Postgres/Supabase logical backup plus restore drill | Database dumps preserve schema/functions/policies; Storage bytes are a separate backup. [CITED: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore]
| Public reverse-proxy protections | Custom slow-client/TLS parser in Next.js | A host-installed reverse proxy if exposed beyond loopback | Next.js recommends a reverse proxy for malformed requests, slow attacks, payload limits, and rate limiting. [CITED: https://nextjs.org/docs/app/guides/self-hosting]

**Key insight:** The difficult work is preserving boundaries and proving state, not translating Python syntax into TypeScript. Libraries should cover parsing/format details; PostgreSQL should own atomicity and analytics; CityMind code should own domain policy and orchestration. [ASSUMED]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Live self-hosted Supabase: 10 reports, 4 status events, 0 access-token rows; evidence URI values: 9 null, 1 `supabase://`, 0 `gs://`; private bucket list returned 1 object. BigQuery retained state is unknown because ADC is unavailable. The DB still names the column `image_gcs_uri`. [VERIFIED: live Supabase probe and schema] | Add `evidence_path` (or equivalent), backfill the one Supabase URI, inventory BigQuery with temporary read-only credentials, migrate unique retained rows, reconcile, switch writers/readers, then drop the legacy column/compatibility in a later migration. Data migration and code edit are separate tasks. |
| Live service config | Backend local env still declares Google project/location/model/dataset/table/bucket settings, though `ENABLE_BIGQUERY=False`. Google CLI/ADC is unavailable, so Cloud Run/Build/Scheduler/IAM/Secret Manager remote config could not be inspected. [VERIFIED: environment probe] | Obtain temporary read-only Google inventory access or operator-exported inventories; record remote services and retained data; delete/disable remote resources only after data sign-off and only if separately authorized. Remove active local Google settings after migration. |
| OS-registered state | No scheduled task with CityMind in name/description; PM2 absent. Docker Desktop is running, no CityMind container exists, but local images `citymind-backend:latest` and `citymind-frontend:latest` exist. [VERIFIED: Windows and Docker probes] | Register a new CityMind Node scheduled task only after production smoke passes. Remove the two CityMind images after rollback sign-off; do not remove Docker itself because existing Supabase infrastructure is out of CityMind scope. |
| Secrets/env vars | `backend/.env` contains Google-related keys plus Supabase service credentials; `frontend/.env.local` contains public Supabase values and `BACKEND_API_URL`. No third-party AI key/model/base URL is configured. [VERIFIED: key-name-only env audit] | Move required server secrets into `frontend/.env.local` under generic names, keep only publishable values `NEXT_PUBLIC_*`, delete `BACKEND_API_URL` and Google keys after cutover, never copy values into docs/logs, and validate all required keys at startup. Rotate only if exposure is suspected. |
| Build artifacts / installed packages | Python `__pycache__`/pytest caches, Next build/dependency directories, Dockerfiles/compose, two CityMind Docker images, and Python dependency manifests exist. [VERIFIED: filesystem/Docker probe] | After parity and migration gates, delete backend/caches/manifests/Dockerfiles/compose, run clean `npm ci && npm run build`, rescan `.next/server`, and remove CityMind images. Global Python/Google packages outside the project are not CityMind runtime dependencies and need not be uninstalled. [ASSUMED] |

**Canonical answer:** Updating every tracked source file would still leave the legacy DB column/data, unknown BigQuery/remote Google state, backend secrets in an ignored local env file, Python/build caches, Docker images, and eventually a Windows scheduled task. These must be explicit plan tasks. [VERIFIED: runtime-state audit]

## Migration and Cutover Sequence

1. **Freeze and measure:** capture endpoint golden fixtures/status/header behavior, DB schema/version, live Supabase counts, Storage manifest, and Google-source inventory. If BigQuery/GCS cannot be inventoried, stop before any destructive cleanup. [VERIFIED: D-10/D-11]
2. **Create rollback assets:** produce a tested database logical backup plus separate Storage object backup; hash manifests; record current git revision and environment-key inventory without values. [CITED: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore]
3. **Build the TypeScript domain/repository seam:** schemas, client injection, tokens, rate limits, report queries, transactional RPCs, export, analytics mapping, and compatibility tests. Keep FastAPI runnable. [ASSUMED]
4. **Port HTTP contracts:** add `/api/v1/**` Route Handlers and convert existing BFF/server callers to direct service imports where appropriate. Run old/new contract fixtures side-by-side. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]
5. **Cut the AI provider:** smoke strict schema plus text-only and image fixtures; persist actual lineage; verify generic failure behavior; leave orchestration synchronous. [VERIFIED: D-05/D-06 and Phase 8 deferment]
6. **Migrate BigQuery data/analytics:** merge unique retained source records, flag key conflicts, implement Postgres views/RPCs, and compare aggregates across agreed date ranges. Derived analytics tables should be rebuilt from canonical Supabase operational rows rather than copied as a second operational truth. [ASSUMED]
7. **Migrate evidence:** for each retained `gs://` reference, download with the temporary compatibility tool, validate bytes/MIME, upload to a deterministic non-overwriting Storage key, compare SHA-256/size, update `evidence_path`, then verify officer serving. [CITED: https://supabase.com/docs/guides/storage/uploads/standard-uploads]
8. **Productionize laptop runtime:** clean install/build, server-only env validation, health/readiness checks, Task Scheduler registration, restart/graceful-stop test, and backup/restore drill. Bind loopback unless a reverse proxy/TLS exposure decision is made. [CITED: https://nextjs.org/docs/app/guides/self-hosting]
9. **Final deletion gate:** require all contract tests, reconciliation manifests, migration sign-off, build, smoke, restore drill, source/build/dependency/runtime audit, and Google Fonts-only allowlist to pass; then delete Python/Google/Docker compatibility and active docs. [VERIFIED: D-02/D-15/D-16]

## Common Pitfalls

### Pitfall 1: Deleting the only migration reader too early
**What goes wrong:** Python Google SDKs/credentials disappear before BigQuery/GCS can be inventoried or copied. [VERIFIED: current environment]
**Why it happens:** The cleanup track is easier to see than the retained-data gate. [ASSUMED]
**How to avoid:** Treat legacy readers as migration-only dependencies, mark sources read-only, and delete them only after signed reconciliation. [VERIFIED: D-10/D-11]
**Warning signs:** BigQuery count is “unknown,” a migration test is skipped, or zero `gs://` rows is treated as proof of zero GCS objects. [ASSUMED]

### Pitfall 2: Bypassing RLS with the service role
**What goes wrong:** Officer queries succeed even without a valid officer JWT, defeating defense in depth. [VERIFIED: Supabase service-role behavior implied by current repository]
**Why it happens:** A single admin client is convenient during convergence. [ASSUMED]
**How to avoid:** Explicit client injection; officer paths require `getClaims()` and a user-scoped client; admin client imports are lint/test restricted. [VERIFIED: existing auth pattern]
**Warning signs:** `SUPABASE_SERVICE_ROLE_KEY` imported by a page/component or officer Route Handler. [ASSUMED]

### Pitfall 3: Feature assumptions about the configured endpoint
**What goes wrong:** Text works but images, strict JSON Schema, refusal/error shapes, or response model lineage do not. [ASSUMED]
**Why it happens:** “Compatible” often covers only a subset of a protocol. [ASSUMED]
**How to avoid:** A live preflight fixture must prove text, image, strict schema, timeout/error mapping, and response `model`/ID before enabling the endpoint. [CITED: https://platform.openai.com/docs/api-reference/chat/create]
**Warning signs:** fallback regex extraction, markdown-fence stripping as the primary parser, or storing only configured model. [ASSUMED]

### Pitfall 4: Internal self-fetch after removing FastAPI
**What goes wrong:** builds fail or server rendering pays an unnecessary network round trip. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]
**Why it happens:** Existing pages already call `backendEndpoint()`/`officerFetch()`. [VERIFIED: codebase grep]
**How to avoid:** Route Handlers and Server Components share domain/repository functions; only browser/external clients call HTTP handlers. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]
**Warning signs:** absolute localhost/public-origin URLs in Server Components. [ASSUMED]

### Pitfall 5: Count-only reconciliation
**What goes wrong:** the same number of rows/objects exists but keys, content, timestamps, statuses, or bytes differ. [ASSUMED]
**Why it happens:** row counts are easy and cheap. [ASSUMED]
**How to avoid:** compare key sets, canonical hashes, timestamp bounds/nulls, aggregates, and object SHA-256/size/MIME; record conflicts. [ASSUMED]
**Warning signs:** a report says only “10 rows copied.” [ASSUMED]

### Pitfall 6: Non-atomic status updates
**What goes wrong:** `reports.current_status` changes without a matching event or vice versa. [VERIFIED: current two-call implementation]
**Why it happens:** PostgREST calls are individually atomic, not jointly transactional. [ASSUMED]
**How to avoid:** one Postgres RPC transaction with role/note validation. [ASSUMED]
**Warning signs:** two `.execute()` calls for one domain transition. [VERIFIED: `backend/app/services/supabase.py`]

### Pitfall 7: Upload validation after buffering and storage
**What goes wrong:** a malicious/oversized body consumes memory or untrusted bytes reach Storage/AI before validation. [ASSUMED]
**Why it happens:** `request.formData()` buffers the multipart body and can only be consumed once. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]
**How to avoid:** precheck `Content-Length` when present, enforce reverse-proxy body limits for exposed deployments, validate `File.size`, magic bytes, MIME allowlist, and dimensions if later required before upload/AI. [ASSUMED]
**Warning signs:** trusting filename extension or request `Content-Type`. [CITED: https://github.com/sindresorhus/file-type#readme]

### Pitfall 8: Spreadsheet formula injection
**What goes wrong:** officer-opened CSV/XLSX cells beginning with `=`, `+`, `-`, or `@` may be interpreted as formulas. [ASSUMED]
**Why it happens:** citizen-controlled descriptions/notes are exported verbatim. [VERIFIED: current export fields]
**How to avoid:** neutralize formula-leading text consistently in CSV and XLSX, then test fixtures. [ASSUMED]
**Warning signs:** raw citizen strings assigned directly to cells. [ASSUMED]

### Pitfall 9: Task starts in the wrong directory or without secrets
**What goes wrong:** `next start` cannot find `.next`, or the scheduled process lacks its environment. [ASSUMED]
**Why it happens:** Task Scheduler defaults and interactive shells differ. [ASSUMED]
**How to avoid:** register an absolute Node/npm path, explicit working directory, dedicated start script, restart policy, non-secret log path, and health probe. [CITED: https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset?view=windowsserver2025-ps]
**Warning signs:** task history says success but `/api/health` is unavailable. [ASSUMED]

### Pitfall 10: Naive Google keyword scan
**What goes wrong:** false positives from `next/font/google`, immutable migrations, lockfile license strings, and transitive `is-docker`; false negatives from package imports or remote resources with no obvious keyword. [VERIFIED: repository scan]
**Why it happens:** text grep lacks semantic scope. [ASSUMED]
**How to avoid:** combine exact forbidden imports/envs/URLs/files, manifest dependency checks, built-output scans, remote/runtime inventory, and a narrow documented allowlist. [ASSUMED]
**Warning signs:** scanner excludes all docs/SQL or allows arbitrary lines containing “font.” [ASSUMED]

## Google Exit Audit Method

The audit should be executable and committed as `frontend/scripts/google-exit-audit.mjs`; a prose checklist alone will regress. [ASSUMED]

1. Scan active tracked source/config/docs outside `.planning/phases/**` for exact forbidden package/import prefixes (`google-genai`, `google.cloud`, `@google-cloud/`), service names, env names, URI schemes, deployment commands, Dockerfiles/compose, `BACKEND_API_URL`, Python/FastAPI/uvicorn entrypoints, and legacy storage column readers. [VERIFIED: current reference inventory]
2. Parse `frontend/package.json` and `npm ls --all --json`; fail on Google runtime SDKs and direct CityMind Docker tooling. Do not fail merely because a transitive package detects Docker or has a `Python-2.0` license. [VERIFIED: current lockfile false positives]
3. Permit `next/font/google` and CityMind font declarations only in an exact allowlist (`frontend/src/lib/fonts.ts` plus design documentation); fail all other Google runtime calls. [VERIFIED: D-17]
4. Treat applied old SQL migrations as immutable provenance, but require a later migration proving the active schema no longer has `image_gcs_uri`; do not rewrite migration history. [VERIFIED: current migration layout] [ASSUMED: immutable migration policy]
5. Run a clean `npm ci && npm run build`, then scan `.next/server` and standalone/server manifests for forbidden imports, hosts, and environment names. [ASSUMED]
6. Probe runtime: `/api/health`, representative public/officer flows, process command line, scheduled task definition, open port/bind address, and logs. [ASSUMED]
7. Verify local ignored env files contain none of the removed Google/backend keys; report names only, never values. [VERIFIED: current env audit practice]
8. Attach the signed BigQuery/GCS reconciliation result; an unavailable source is a failed audit, not a skip. [VERIFIED: D-10/D-11]
9. Refresh `README.md`, `AGENTS.md` generated active sections, and `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS}.md`; historical phase artifacts may remain. [VERIFIED: D-18 and current active-doc scan]

## Code Examples

### Server-only environment validation

```typescript
// Source pattern: https://nextjs.org/docs/app/guides/environment-variables
import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
  AI_BASE_URL: z.string().url(),
  AI_MODEL: z.string().min(1),
  AI_PROVIDER_LABEL: z.string().min(1),
  THIRD_PARTY_API_KEY: z.string().min(16),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(45_000),
});

export const serverEnv = EnvSchema.parse(process.env);
```

No secret may use a `NEXT_PUBLIC_` prefix because Next.js inlines those values into browser bundles at build time. [CITED: https://nextjs.org/docs/app/guides/environment-variables]

### Validated private evidence upload

```typescript
// Sources: https://github.com/sindresorhus/file-type#readme and
// https://supabase.com/docs/guides/storage/uploads/standard-uploads
import { fileTypeFromBuffer } from "file-type";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const bytes = new Uint8Array(await file.arrayBuffer());
const detected = await fileTypeFromBuffer(bytes);
if (!detected || !allowed.has(detected.mime)) throw new InvalidUploadError();
if (bytes.byteLength > MAX_IMAGE_BYTES) throw new PayloadTooLargeError();

const objectPath = `${reportId}/evidence.${detected.ext}`;
const { error } = await admin.storage.from("evidence").upload(objectPath, bytes, {
  contentType: detected.mime,
  upsert: false,
});
if (error) throw new EvidenceStorageError();
```

Supabase recommends standard uploads for files no larger than 6 MB, while the current bucket/config allows up to 10 MB. Keep the established maximum for compatibility but document that >6 MB is a reliability tradeoff; do not introduce direct public TUS uploads in this phase without a new security design. [CITED: https://supabase.com/docs/guides/storage/uploads/standard-uploads] [VERIFIED: current migration]

### Uniform citizen token lookup

```typescript
// Source behavior: backend/app/api/reports.py and Phase 4 locked decisions
const tokenHash = createHash("sha256").update(input.token, "utf8").digest("hex");
const row = await tokens.findByHash(tokenHash);

if (!row || row.report_id !== input.reportId || Date.parse(row.expires_at) <= Date.now()) {
  throw new UniformCitizenUnauthorizedError();
}

return citizenSafeProjection(await reports.getCitizenStatus(input.reportId));
```

The public response must never include actor IDs, provider failures, stack traces, or different errors for nonexistent report versus wrong/expired token. [VERIFIED: Phase 4 decisions]

### Readiness health response

```typescript
// Source pattern: https://nextjs.org/docs/app/getting-started/route-handlers
export async function GET() {
  const checks = await readiness.check({ timeoutMs: 2_000 });
  return Response.json(
    { status: checks.ready ? "ok" : "degraded", checks: checks.publicSummary },
    { status: checks.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
```

Expose only dependency names/status/latency, not URLs, keys, SQL errors, or provider response bodies. Use a shallow provider-configuration check in normal readiness and a separate authenticated/manual live inference smoke to avoid cost and citizen-data leakage. [ASSUMED]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server Components fetch an internal backend/Route Handler | Server Components call the data source/module directly | Current Next.js 16.2 docs | Remove `backendEndpoint()` from server-rendered pages and avoid build/runtime self-fetch. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend] |
| Separate response schema and runtime parser | Zod 4 schema plus `z.toJSONSchema()` | Zod 4 stable | One definition drives outbound structured-output schema and inbound validation. [CITED: https://zod.dev/json-schema] |
| JSON mode only | Strict `response_format: json_schema` where supported | Current Chat Completions protocol | Capability must be probed; strict mode uses only a supported JSON Schema subset. [CITED: https://platform.openai.com/docs/api-reference/chat/create] |
| Expose self-hosted Next directly | Put a reverse proxy in front when internet-exposed | Current Next.js self-hosting guide | For laptop-only/local access bind loopback; for external access add TLS/request protections before exposure. [CITED: https://nextjs.org/docs/app/guides/self-hosting] |
| ASVS 4.0.3 | ASVS 5.0.0 stable | Released 2025-05-30 | Use current Level 1 controls while retaining project-specific privacy/security gates. [CITED: https://owasp.org/www-project-application-security-verification-standard/] |

**Deprecated/outdated:**

- `backendEndpoint()`/`officerFetch()` as the data path for Server Components: replace with direct server modules; retain HTTP only for browser/external compatibility. [CITED: https://nextjs.org/docs/app/guides/backend-for-frontend]
- `image_gcs_uri`: migrate to a provider-neutral Storage path/reference, then remove compatibility readers. [VERIFIED: D-11]
- BigQuery ETL/views/jobs and `google-genai`/Google Cloud SDKs: migration-only until reconciliation, then remove. [VERIFIED: D-07/D-09/D-15]
- Docker `output: standalone` is not required for direct `next start`; retain it only if a measured non-container packaging need exists, otherwise remove stale container-oriented configuration. [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The selected third-party endpoint supports Chat Completions image parts and strict JSON Schema. | Summary / AI pattern | AI cutover fails; live capability smoke must gate enablement. |
| A2 | A configurable, user-defined provider label is sufficient lineage without persisting the endpoint URL. | AI pattern | Audit lineage may be insufficient; Phase 8 schema would need a stronger non-secret provider identifier. |
| A3 | Windows Task Scheduler is acceptable as the laptop process mechanism. | Standard Stack / Operations | Startup/restart may not meet the operator's uptime expectations; choose another non-Docker mechanism before execution. |
| A4 | Rebuilding derived BigQuery analytics from canonical Supabase operational rows satisfies “migrate retained BigQuery data,” while unique legacy records are merged. | Migration sequence | Stakeholders may require preserving historical warehouse snapshots verbatim. |
| A5 | A logical database dump plus separate Storage object backup is the required backup scope for this phase. | Runtime / Operations | Existing self-hosted Supabase may use a different supported physical/PITR process; runbook must align with its operator. |
| A6 | `image_gcs_uri` should become `evidence_path`; exact final column name is discretionary. | Runtime inventory | Downstream Phase 8 or external consumers may depend on another name. |
| A7 | Formula-leading export values should be neutralized even though this slightly changes exported text representation. | Pitfalls | Consumers expecting byte-for-byte raw CSV may need a documented opt-out; security favors neutralization. |
| A8 | Phase 7 semantic validation should be a pure seam with conservative locked invariants, while durable `manual_review` behavior remains Phase 8. | Current contract | D-06 may be interpreted as requiring a larger semantic policy now; planner must reconcile without importing Phase 8 workflow. |

## Open Questions

1. **What retained BigQuery tables/rows and remote Google resources actually exist?**
   - What we know: local BigQuery configuration exists but is disabled; Google ADC/CLI is unavailable; Supabase has 10 reports. [VERIFIED: environment/live probes]
   - What's unclear: BigQuery table counts/conflicts, GCS orphan objects, and Cloud Run/Build/Scheduler/IAM/Secret Manager resources. [VERIFIED: audit limitation]
   - Recommendation: first migration checkpoint obtains temporary read-only credentials or operator-generated inventories. No Google deletion task may pass with “unavailable/skipped.” [VERIFIED: D-10/D-11]

2. **Will the laptop service be loopback/LAN-only or internet-facing?**
   - What we know: Next.js recommends a reverse proxy rather than direct internet exposure. [CITED: https://nextjs.org/docs/app/guides/self-hosting]
   - What's unclear: hostname, TLS termination, inbound firewall, proxy ownership, and public availability expectations. [ASSUMED]
   - Recommendation: plan loopback binding as the safe default; if citizen traffic reaches the laptop directly, add an explicit non-Docker reverse-proxy/TLS decision and test before go-live. [ASSUMED]

3. **Does the chosen endpoint pass the required capability and data-handling gate?**
   - What we know: no endpoint/model/key is currently configured. [VERIFIED: env-key audit]
   - What's unclear: strict schema support, image limits, response lineage fields, privacy/retention terms, and error/refusal shapes. [ASSUMED]
   - Recommendation: use synthetic EN/VI text and a non-sensitive image for capability smoke; require HTTPS, accepted data handling, and all contract assertions before cutover. Do not record a provider name in the plan. [VERIFIED: D-04]

4. **Which backup mechanism does the existing self-hosted Supabase operator support?**
   - What we know: `pg_dump`, `psql`, and Supabase CLI are absent on this laptop; self-hosted operators are responsible for backups/disaster recovery, and Storage objects need separate handling. [VERIFIED: environment probe] [CITED: https://supabase.com/docs/guides/self-hosting]
   - What's unclear: direct DB connectivity, existing physical/PITR backups, Postgres version, and Storage backend/S3 availability. [ASSUMED]
   - Recommendation: make backup tooling discovery a blocking operations task; install a compatible PostgreSQL client or integrate with the operator's supported backup, then perform a restore drill. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version/state | Fallback |
|------------|-------------|-----------|---------------|----------|
| Node.js | App runtime/build | ✓, version drift | 25.2.1 installed; project target 22.x | Pin/install Node 22.x LTS for production. [VERIFIED: environment + project constraints] |
| npm | Dependency/build/test | ✓ | 11.6.2 | — [VERIFIED: environment probe] |
| Existing self-hosted Supabase | DB/Auth/Storage | ✓ | REST and Storage probes returned 200 | No alternative permitted. [VERIFIED: live probe] |
| Third-party AI endpoint/key | Analysis | ✗ unconfigured | — | No provider fallback; keep generic 502 behavior until configured. [VERIFIED: env audit] |
| Google source access | One-time migration | ✗ | Google CLI absent; ADC error | Obtain temporary read-only credential or operator export; blocking before cleanup. [VERIFIED: environment probe] |
| PostgreSQL `pg_dump`/`psql` | Backup/restore | ✗ | absent | Use operator-supported compatible tooling; blocking before operations sign-off. [VERIFIED: environment probe] |
| Supabase CLI | Optional migration backup | ✗ | absent | Direct compatible Postgres tools/operator backup; do not use `npx --yes`. [VERIFIED: environment probe] |
| Windows Scheduled Tasks | Startup/restart | ✓ | built into OS; no CityMind task registered | — [VERIFIED: OS probe] |
| PM2 | Process management alternative | ✗ | absent | Windows Scheduled Tasks. [VERIFIED: environment probe] |
| Docker | Legacy CityMind packaging | ✓ but forbidden target | 29.6.1; two CityMind images, no CityMind container | Remove CityMind compose/images after sign-off; do not disturb Supabase-owned infrastructure. [VERIFIED: Docker probe] |
| slopcheck | Package legitimacy | ✓ | 0.6.1 | — [VERIFIED: environment probe] |
| ctx7 | Preferred documentation lookup | ✗ | absent | Official documentation fetched directly. [VERIFIED: environment probe] |

**Missing dependencies with no fallback:** configured third-party endpoint/key for live AI smoke; temporary BigQuery/GCS inventory access before removal; a supported DB backup/restore mechanism before operations sign-off. [VERIFIED: audit]

**Missing dependencies with fallback:** PM2 is unnecessary because Windows Scheduled Tasks are available; Supabase CLI can be replaced only by an operator-approved compatible backup path. [CITED: Microsoft and Supabase official docs]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` 4.1.10 for TypeScript server unit/contract tests, plus existing Node `--test` `.mjs` source-contract suite. [CITED: https://nextjs.org/docs/app/guides/testing/vitest] |
| Config file | `frontend/vitest.config.mts` — missing, Wave 0. [VERIFIED: test inventory] |
| Quick run command | `cd frontend && npm run test:unit -- src/server/<area>.test.ts` [ASSUMED] |
| Full suite command | `cd frontend && npm run lint && npm test && npm run build` [ASSUMED] |

Recommended scripts: `test:unit = vitest run`, `test:legacy = node --test tests/*.test.mjs`, and `test = npm run test:unit && npm run test:legacy`. Existing `.mjs` tests mostly assert source strings and should be retained/updated as architecture guards, not counted as behavioral parity. [VERIFIED: frontend test inventory]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SELFHOST-01 | Every old endpoint matches status, JSON shape, headers, auth, rate limits, filters, pagination, export, and generic errors; pages no longer self-fetch | unit + contract + production smoke | `npm run test:unit -- tests/contracts tests/server && npm run build` | ❌ Wave 0 |
| SELFHOST-02 | Text/image structured analysis, schema/policy rejection, timeout/refusal/error mapping, actual lineage, no provider-specific package/config | unit + mocked contract + gated live smoke | `npm run test:unit -- tests/server/ai` plus authenticated `scripts/smoke-ai.mjs` | ❌ Wave 0 |
| SELFHOST-03 | Postgres analytics parity and retained-data reconciliation | SQL contract + migration integration | `npm run test:unit -- tests/migration/postgres-analytics.test.ts` plus live reconcile command | ❌ Wave 0 |
| SELFHOST-04 | Private Storage upload/download and object checksum reconciliation; no `gs://` active rows/readers | unit + live integration + audit | `npm run test:unit -- tests/server/evidence tests/migration/evidence` | ❌ Wave 0 |
| SELFHOST-05 | clean build/start, 200 liveness/readiness, restart, secret loading, DB/object backup and restore | production smoke + manual restore drill | `npm run build && npm run smoke:production` | ❌ Wave 0 |
| SELFHOST-06 | no forbidden code/dependencies/config/env/build output/runtime state; Google Fonts allowlist only | static + build + runtime audit | `npm run audit:google-exit` | ❌ Wave 0 |

Live migration, live provider, Task Scheduler restart, and restore tests require human/environment checkpoints; automated unit tests cannot prove external state. [VERIFIED: environment limitations]

### Sampling Rate

- **Per task commit:** targeted Vitest file plus relevant existing `.mjs` contract test. [ASSUMED]
- **Per wave merge:** `cd frontend && npm test && npm run lint`. [ASSUMED]
- **Phase gate:** clean `npm ci`, full test suite, production build/start smoke, live reconciliation, restore drill, and Google-exit audit all green before `$gsd-verify-work`. [ASSUMED]

### Wave 0 Gaps

- [ ] `frontend/vitest.config.mts` and flagged `vitest` install checkpoint — executable TypeScript unit tests. [VERIFIED: missing]
- [ ] `frontend/tests/contracts/fastapi-golden/` — sanitized request/response/status/header fixtures captured before backend removal. [VERIFIED: missing]
- [ ] `frontend/src/server/domain/report-analysis.test.ts` — exact Pydantic-to-Zod parity and JSON Schema snapshot. [VERIFIED: missing]
- [ ] `frontend/src/server/ai/openai-compatible.test.ts` — timeout, invalid JSON/schema, refusal/error, image, redaction, lineage. [VERIFIED: missing]
- [ ] `frontend/src/server/repositories/*.test.ts` — RLS client selection, filters/cursors, token privacy, status atomicity. [VERIFIED: missing]
- [ ] `frontend/tests/migration/reconciliation.test.ts` — canonical hashing/conflicts/counts/objects. [VERIFIED: missing]
- [ ] `frontend/scripts/smoke-production.mjs` and `google-exit-audit.mjs`. [VERIFIED: missing]
- [ ] Supabase SQL tests for transactional RPCs, analytics parity, RLS, and legacy-column cutover. [VERIFIED: missing]

## Security Domain

Security enforcement is enabled at ASVS Level 1 and high-severity findings block the phase. ASVS 5.0.0 is the current stable release. [VERIFIED: `.planning/config.json`] [CITED: https://owasp.org/www-project-application-security-verification-standard/]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth `getClaims()` plus officer/admin role guard; never authorize from `getSession()` alone. [VERIFIED: existing auth pattern] |
| V3 Session Management | yes | Existing Supabase SSR cookie refresh and secure cookie configuration; secrets remain server-only. [VERIFIED: current architecture] |
| V4 Access Control | yes | User-scoped Supabase clients + RLS for officer resources; uniform token-scoped citizen projection; service-role import restrictions. [VERIFIED: project privacy constraints] |
| V5 Input Validation | yes | Zod at every boundary, `file-type` magic bytes, query range/cursor validation, fixed endpoint path, output schema plus policy validation. [CITED: Next.js and file-type official docs] |
| V6 Cryptography | yes | TLS to third-party/Supabase, Node CSPRNG access tokens, SHA-256 at rest, no custom encryption, no logged secrets. [VERIFIED: Phase 2 security decisions] |
| Logging/Error Handling | yes | Structured redacted server logs and stable generic public errors; never log tokens, evidence bytes, descriptions, keys, upstream bodies, or service-role credentials. [ASSUMED] |
| Data Protection | yes | Private Storage bucket, server-side evidence serving, data minimization to the third-party endpoint, separate secret backup handling. [CITED: https://supabase.com/docs/guides/storage/security/access-control] |

### Known Threat Patterns for Next.js + Supabase + External AI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role key reaches browser/client bundle | Information Disclosure / Elevation | `server-only`, non-`NEXT_PUBLIC_` key, import-boundary test, built-output secret-name scan. [CITED: https://nextjs.org/docs/app/guides/environment-variables] |
| Configurable endpoint becomes SSRF/open proxy | Spoofing / Information Disclosure | Environment-only base URL, HTTPS/default-port allowlist, fixed relative path, redirect disabled, no request-level override. [ASSUMED] |
| Citizen prompt/image injection controls officer decision | Tampering | System policy, strict schema, conservative semantic checks, observed-facts/uncertainty separation, advisory label, officer final authority. [VERIFIED: project constraints] |
| Cross-report citizen lookup | Information Disclosure | Hash lookup + report binding + expiry + uniform 401 + citizen-safe projection + separate rate limit. [VERIFIED: Phase 4 decisions] |
| Officer auth bypass through admin DB client | Elevation | `getClaims()` and user-scoped client/RLS on every officer path; admin client only in explicitly reviewed modules. [VERIFIED: current auth design] |
| Malicious/oversized image | Denial of Service / Tampering | header precheck, body limit, byte cap, magic-byte allowlist, private deterministic object key, no user filename. [CITED: https://github.com/sindresorhus/file-type#readme] |
| CSV/XLSX formula injection | Tampering | neutralize formula-leading citizen strings and test all export formats. [ASSUMED] |
| Migration truncation/corruption | Tampering / Repudiation | read-only source, canonical manifests/hashes, conflict log, backup, restore drill, signed gate. [ASSUMED] |
| Provider/key/error leakage | Information Disclosure | server-only key, log redaction, bounded/generic upstream errors, never return endpoint/model internals to citizens. [ASSUMED] |
| Direct internet exposure of Next server | Denial of Service | loopback default or reverse proxy with TLS, request/body/time limits and rate limiting. [CITED: https://nextjs.org/docs/app/guides/self-hosting] |

**High-severity blockers:** any service-role or third-party key in client/build output; officer route that works without valid role claims; citizen cross-report disclosure; publicly readable evidence bucket/object; arbitrary request-controlled outbound URL; migration deletion without verified inventory/reconciliation/rollback; or direct public HTTP without an approved TLS/proxy boundary. [ASSUMED: threat severity]

## Sources

### Primary (HIGH confidence)

- https://nextjs.org/docs/app/guides/backend-for-frontend — server module versus Route Handler responsibility and body parsing.
- https://nextjs.org/docs/app/getting-started/route-handlers — Route Handler request/response/method patterns.
- https://nextjs.org/docs/app/guides/self-hosting — Node self-hosting, reverse proxy, and graceful shutdown.
- https://nextjs.org/docs/app/guides/environment-variables — server-only versus browser-inlined configuration.
- https://nextjs.org/docs/app/guides/testing/vitest — official test setup and async Server Component limitation.
- https://supabase.com/docs/reference/javascript/initializing — Supabase JS client initialization.
- https://supabase.com/docs/guides/storage/security/access-control — private Storage/RLS model.
- https://supabase.com/docs/guides/storage/uploads/standard-uploads — upload API, non-overwrite behavior, MIME, and size guidance.
- https://supabase.com/docs/guides/storage/serving/downloads — private object download patterns.
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore — logical DB backup/restore and separate Storage migration.
- https://zod.dev/json-schema — Zod 4 JSON Schema generation and conversion limits.
- https://nodejs.org/api/globals.html#class-abortsignal — native timeout/cancellation primitive.
- https://platform.openai.com/docs/api-reference/chat/create — protocol-level multimodal content, strict JSON Schema, response model/request fields.
- https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset?view=windowsserver2025-ps — Task Scheduler restart settings.
- https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasktrigger?view=windowsserver2025-ps — startup/logon triggers.
- https://owasp.org/www-project-application-security-verification-standard/ — current ASVS stable version and purpose.
- https://github.com/sindresorhus/file-type#readme — magic-byte API.
- https://github.com/exceljs/exceljs#readme — XLSX workbook library provenance.
- Local codebase, migrations, tests, environment-key audit, live Supabase read-only probe, Windows/Docker/runtime probes — current implementation and runtime state.

### Secondary (MEDIUM confidence)

- npm registry metadata and npm downloads API — versions, publication dates, repositories, postinstall absence, and weekly download counts.
- slopcheck 0.6.1 — `file-type` OK, `exceljs` OK, `vitest` SUS false-positive candidate requiring human verification.

### Tertiary (LOW confidence)

- Assumption log A1–A8 — endpoint capability, provider identifier, process choice, migration interpretation, backup ownership, field naming, export neutralization, and Phase 7/8 semantic boundary.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing versions, official docs, registry checks, and slopcheck were used; Vitest is explicitly gated. [VERIFIED]
- Architecture: HIGH — based on locked decisions, exact current route/service inventory, official Next.js guidance, and downstream Phase 8 requirement. [VERIFIED]
- Migration/runtime state: MEDIUM — Supabase/local state is live-verified, but BigQuery/GCS and remote Google resources are inaccessible. [VERIFIED]
- Pitfalls/security: MEDIUM-HIGH — most boundaries are code-verified or official-doc-backed; severity classifications and some hardening choices remain assumptions. [VERIFIED]

**Research date:** 2026-07-21
**Valid until:** 2026-08-20 for stable architecture; re-check package versions, Next.js docs, selected endpoint capability, and live data immediately before execution.
