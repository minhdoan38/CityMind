<!-- GSD:project-start source:PROJECT.md -->

## Project

**CityMind AI**

CityMind AI is an AI-assisted Decision Intelligence Platform for smart communities. Citizens submit urban incident reports (text, location, optional evidence); a configurable third-party AI API produces structured, advisory triage output; officers review, filter, and update status on a protected dashboard.

**Milestone v2 (this planning cycle):** Next.js-only laptop runtime with self-hosted Supabase Postgres/Auth/Storage, provider-neutral AI, bilingual EN/VI public landing, and citizen status tracking via access tokens. Phase 7 removed FastAPI, Python, Docker, and Google Cloud services except Google Fonts.

**Core Value:** Citizens can report community issues and officers can review AI-structured, prioritized, auditable reports to make faster evidence-based decisions — with AI as advisory only, never autonomous final authority.

### Constraints

- **Tech stack:** Node.js 22 + Next.js 16 only; Supabase for ops/auth/storage; provider-neutral AI key
- **Security:** AI output is advisory; officers remain decision authority; access tokens must be hashed at rest
- **Privacy:** Citizen status lookup is token-scoped; no cross-report data leakage
- **Compatibility:** Loopback-first laptop operation; historical phase artifacts preserved under `.planning/`
- **Locale:** Bilingual EN/VI from Phase 2 onward
- **Performance:** Synchronous analyze path acceptable; maps shipped in Phase 6

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.x — Next.js app (UI + server/API routes)
- SQL — Supabase migrations and contract tests

## Runtime

- Node.js 22 — Direct laptop process (`next build` / `next start`)
- npm — `frontend/package-lock.json`, `npm ci`

## Frameworks

- Next.js 16.2.10 — App Router UI and API route handlers
- Vitest + node:test — Frontend unit and legacy contract tests
- ESLint 9.x (`eslint-config-next`)

## Key Dependencies

- `@supabase/ssr`, `@supabase/supabase-js` — Auth, Postgres, Storage
- `next-intl` — Bilingual EN/VI routes
- Provider-neutral AI via `THIRD_PARTY_API_KEY` + `AI_BASE_URL` / `AI_MODEL`

## Configuration

- `frontend/.env.example` / `frontend/.env.local` — all runtime secrets and Supabase URLs
- `SUPABASE_DB_URL` — migrations and SQL gates via `frontend/scripts/run-supabase-sql.mjs`

## Platform Requirements

- Node.js 22+
- Self-hosted Supabase + Supabase CLI
- Optional: Windows Task Scheduler (`frontend/scripts/register-citymind-task.ps1`)
- **Exception:** Google Fonts via `frontend/src/lib/fonts.ts` only

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

- Single Next.js process serves public citizen UI and authenticated officer dashboard
- API routes call `frontend/src/server/` repositories and services directly
- Supabase Postgres/Auth/Storage is the operational store; AI output is advisory

## Layers

- **UI:** `frontend/src/app/[locale]/`, `frontend/src/app/dashboard/`
- **API routes:** `frontend/src/app/api/public/**`, `frontend/src/app/api/v1/**`, health/ready
- **Server modules:** `frontend/src/server/repositories/`, `frontend/src/server/services/`
- **Officer guard:** `requireOfficerContext()` via Supabase `getClaims()`

## Data Flow

- Citizen submit → `/api/public/reports/analyze` → AI + Supabase persist + access token
- Officer dashboard → direct Postgres loaders → status/evidence via `/api/officer/**`
- Evidence → private Storage bucket; `evidence_path` on report row

## Key Abstractions

- `report-service.ts` — analyze + persist citizen reports
- `evidence-service.ts` — upload/download private evidence
- `officer-read.ts` / repositories — officer queries and image streaming
- `readiness.ts` — bounded Supabase probe for `/api/ready`

## Entry Points

- `npm run dev` / `npm run start` in `frontend/`
- `GET /api/health`, `GET /api/ready`
- `supabase db push` for schema migrations

## Cross-Cutting Concerns

- Supabase Auth session cookies + `proxy.ts` dashboard gate
- Token-scoped citizen status; hashed access tokens at rest
- Loopback-first production bind; optional Task Scheduler registration

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
