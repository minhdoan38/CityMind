<!-- GSD:project-start source:PROJECT.md -->

## Project

**CityMind AI**

CityMind AI is an AI-assisted Decision Intelligence Platform for smart communities. Citizens submit urban incident reports (text, location, optional evidence); Vertex AI Gemini produces structured, advisory triage output; officers review, filter, and update status on a protected dashboard.

**Milestone v2 (this planning cycle):** Upgrade the shipped MVP into a production-ready platform with Supabase Postgres as the operational store, Supabase Auth for officers, shadcn/ui polish, bilingual EN/VI public landing, citizen status tracking via access tokens, and BigQuery retained for analytics only.

**Core Value:** Citizens can report community issues and officers can review AI-structured, prioritized, auditable reports to make faster evidence-based decisions — with AI as advisory only, never autonomous final authority.

### Constraints

- **Tech stack:** Keep FastAPI for AI pipeline; Supabase for ops/auth; BigQuery analytics-only post-migration
- **Security:** AI output is advisory; officers remain decision authority; access tokens must be hashed at rest
- **Privacy:** Citizen status lookup is token-scoped; no cross-report data leakage
- **Compatibility:** Maintain Cloud Run deployment path; existing demo/seed data must migrate
- **Locale:** Bilingual EN/VI from Phase 2 onward
- **Performance:** Synchronous analyze path acceptable for MVP; maps deferred to avoid blocking core migration

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.x - Frontend Next.js app (UI + Next server/API routes)
- Python 3.12 - Backend FastAPI API, services (Gemini/BigQuery/GCS), and tests

## Runtime

- Node.js 22 (Alpine) - Frontend Docker image uses `node:22-alpine`
- Python 3.12 - Backend Docker image uses `python:3.12-slim`
- npm - Frontend uses `package-lock.json` and `npm ci` in Docker
- Lockfile: `frontend/package-lock.json`

## Frameworks

- Next.js 16.2.10 - App Router UI and Next API proxy endpoints
- FastAPI 0.115.14 - REST API for report ingestion, querying, and officer operations
- pytest 8.4.1 - Backend tests (API/unit tests)
- TypeScript 5.x - Type checking + compilation for Next.js
- ESLint 9.x (via `eslint-config-next`) - Linting

## Key Dependencies

- google-genai 1.23.0 - Vertex AI Gemini content generation (JSON-schema shaped output)
- google-cloud-bigquery 3.34.0 - Report persistence, querying, and status history
- google-cloud-storage 3.12.0 - Evidence image upload/download (GCS URIs)
- fastapi 0.115.14 - Backend web framework (Pydantic request/response models)
- uvicorn 0.34.3 - Backend ASGI server
- pydantic 2.11.7 - Typed schemas/models for request/response and Gemini parsing
- requests 2.34.2 - Urban context enrichment (OpenWeather + Nominatim)

## Configuration

- Frontend (in `frontend/.env.example`):
- Backend (in `backend/.env.example` / loaded from `backend/.env`):
- `frontend/next.config.ts` sets `output: "standalone"` for container-friendly builds

## Platform Requirements

- Node.js 22+
- Python 3.12+
- Run backend with `uvicorn app.main:app --reload`
- Run frontend with `next dev`
- Deploy containers (Cloud Run noted in `scripts/deploy_cloudrun.ps1`)
- Google Cloud access:

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Python: `snake_case.py` (e.g., `backend/app/services/gemini.py`)
- TypeScript/TSX: descriptive PascalCase React components (e.g., `ReportForm.tsx`)
- TypeScript: `camelCase` for functions (e.g., `backendEndpoint`, `officerFetch`)
- Python: `snake_case` for functions/methods (e.g., `analyze_report`, `list_recent`)
- Constants: `UPPER_SNAKE_CASE` in Python (e.g., `VALID_STATUSES`)
- Constants: `SCREAMING_SNAKE_CASE`-style in TS where appropriate (e.g., `SESSION_COOKIE`)
- Local variables: `camelCase` (TS) / `snake_case` (Python)
- TypeScript: inline `type` aliases and explicit prop types in the same file
- Python: `enum.StrEnum` and Pydantic `BaseModel` for request/response payloads

## Code Style

- TypeScript formatting appears consistent with Prettier defaults (no explicit Prettier config detected)
- Python uses conventional 4-space indentation and explicit type annotations
- Frontend: `eslint` via `eslint-config-next` (`frontend/eslint.config.mjs`)
- Lint script: `frontend/package.json` uses `eslint`
- Backend: no dedicated linter/formatter config detected (tests + runtime failures used as guardrails)

## Import Organization

- Blank line between external imports and internal imports is consistently used in the Python code
- Type-only imports are used in a few TS files (e.g., `import type { NextConfig } ...`)

## Error Handling

- Boundary behavior uses `HTTPException`:
- Prefer guard clauses for input validation (e.g., invalid enum filters)
- Rate limiting throws `HTTPException(429, ...)` with `Retry-After`
- Fetch helpers check `res.ok` before parsing JSON
- Components catch connectivity errors and show generic user messages

## Logging

- No structured logging library detected.
- Backend errors are not logged in code (exceptions are wrapped into HTTP responses).
- Frontend shows errors in UI; no centralized telemetry detected.

## Comments

- UI contains short clarifying comments for evidence privacy:
- Comments explain “why” in some places (privacy intent, decision-support disclaimer)

## Function Design

- Many backend functions are kept short and delegate to service objects
- Frontend page modules define small helper functions for filtering, formatting, and fetch wrappers
- Use explicit objects/types for structured props and filters
- Backend services use typed method signatures for clarity

## Module Design

- TypeScript exports mostly use named exports for utilities (`backendEndpoint`, `officerFetch`)
- React pages/components use default exports for route entry components
- No barrel export pattern is prominent in the current code; modules are imported directly by path/alias

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- Frontend serves both public submission UI and an authenticated officer dashboard
- Backend is a thin REST API around services (Gemini, BigQuery, GCS, optional urban context)
- Decision outputs from Gemini are structured and treated as advisory

## Layers

- Purpose: User-facing pages for citizens and officers
- Contains: Server components/pages + client components for form interactions
- Depends on: Next.js routing/rendering
- Used by: End users (public) and officers (authenticated dashboard)
- Key locations: `frontend/src/app/page.tsx`, `frontend/src/app/report/page.tsx`, `frontend/src/app/reports/[reportId]/page.tsx`
- Purpose: Bridge Next app to FastAPI, add officer session handling, and stream evidence images
- Contains: `route.ts` handlers that call `frontend/src/lib/backend.ts`
- Depends on: Backend URL + officer API key header (env-driven)
- Used by: UI pages/components
- Key locations:
- Purpose: HTTP boundary for report ingestion, querying, and status transitions
- Contains: `/api/v1/reports/analyze`, `/recent`, `/summary`, `/{report_id}` and status/image endpoints
- Depends on: service classes (GeminiAnalyzer, BigQueryReportSink, UrbanContextService, EvidenceStorage)
- Used by: Next.js proxy routes
- Key locations: `backend/app/api/reports.py`, `backend/app/main.py`
- Purpose: Encapsulate external calls and persistence logic
- Contains:
- Depends on: external SDKs and environment configuration

## Data Flow

## Key Abstractions

- Purpose: Turn citizen description + optional evidence image into structured `ReportAnalysis`
- Examples: `backend/app/services/gemini.py::GeminiAnalyzer`
- Pattern: Service object wrapping an SDK client; JSON-schema shaped responses
- Purpose: Persist reports and status history; query recent items
- Examples: `backend/app/services/bigquery.py::BigQueryReportSink`
- Pattern: Data-access object; SQL queries with parameterized inputs
- Purpose: Optional enrichment (weather + reverse geocoding)
- Examples: `backend/app/services/context_data.py`
- Pattern: Feature-gated HTTP enrichment with graceful degradation per sub-call
- Purpose: Optional evidence image storage in GCS
- Examples: `backend/app/services/storage.py`
- Pattern: Feature-gated upload/download returning `gs://` URIs

## Entry Points

- FastAPI app instantiation + CORS + router wiring:
- Server runtime:
- Next.js entry routes:
- Next server route handlers:

## Error Handling

- Request-level validation via Pydantic/FastAPI produces 4xx responses.
- External/service calls are wrapped:
- Status transitions and image fetching:
- Fetch wrappers check `res.ok` and show user-friendly error text.
- Some officer actions use optimistic UI refresh (`router.refresh()`) after success.

## Cross-Cutting Concerns

- Configured in FastAPI `backend/app/main.py` using `settings.cors_origin_list`
- Frontend session cookie + server components guard routes
- Backend officer auth enforced per request via `X-CityMind-Officer-Key`
- In-memory sliding window limiter per FastAPI instance:

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
