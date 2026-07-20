# Coding Conventions

**Analysis Date:** 2026-07-20

## Naming Patterns

**Files:**
- Python: `snake_case.py` (e.g., `backend/app/services/gemini.py`)
- TypeScript/TSX: descriptive PascalCase React components (e.g., `ReportForm.tsx`)

**Functions:**
- TypeScript: `camelCase` for functions (e.g., `backendEndpoint`, `officerFetch`)
- Python: `snake_case` for functions/methods (e.g., `analyze_report`, `list_recent`)

**Variables:**
- Constants: `UPPER_SNAKE_CASE` in Python (e.g., `VALID_STATUSES`)
- Constants: `SCREAMING_SNAKE_CASE`-style in TS where appropriate (e.g., `SESSION_COOKIE`)
- Local variables: `camelCase` (TS) / `snake_case` (Python)

**Types:**
- TypeScript: inline `type` aliases and explicit prop types in the same file
- Python: `enum.StrEnum` and Pydantic `BaseModel` for request/response payloads

## Code Style

**Formatting:**
- TypeScript formatting appears consistent with Prettier defaults (no explicit Prettier config detected)
- Python uses conventional 4-space indentation and explicit type annotations

**Linting:**
- Frontend: `eslint` via `eslint-config-next` (`frontend/eslint.config.mjs`)
- Lint script: `frontend/package.json` uses `eslint`
- Backend: no dedicated linter/formatter config detected (tests + runtime failures used as guardrails)

## Import Organization

**Order (observed patterns):**
1. External packages (`next/link`, `fastapi`, `google-cloud-*`, etc.)
2. Internal modules using absolute aliases:
   - Frontend: `@/lib/...`, `@/components/...` (see `frontend/tsconfig.json` paths)
3. Relative imports only within modules when needed

**Grouping:**
- Blank line between external imports and internal imports is consistently used in the Python code
- Type-only imports are used in a few TS files (e.g., `import type { NextConfig } ...`)

## Error Handling

**Backend (FastAPI):**
- Boundary behavior uses `HTTPException`:
  - validation errors are handled by FastAPI/Pydantic (422/415/413)
  - external failures are mapped to `HTTPException(502, "... failed: {exc}")`
- Prefer guard clauses for input validation (e.g., invalid enum filters)
- Rate limiting throws `HTTPException(429, ...)` with `Retry-After`

**Frontend (Next):**
- Fetch helpers check `res.ok` before parsing JSON
- Components catch connectivity errors and show generic user messages

## Logging

**Framework:**
- No structured logging library detected.
- Backend errors are not logged in code (exceptions are wrapped into HTTP responses).
- Frontend shows errors in UI; no centralized telemetry detected.

## Comments

**When to Comment:**
- UI contains short clarifying comments for evidence privacy:
  - `frontend/src/app/page.tsx` and `frontend/src/app/reports/[reportId]/page.tsx`
- Comments explain “why” in some places (privacy intent, decision-support disclaimer)

## Function Design

**Size:**
- Many backend functions are kept short and delegate to service objects
- Frontend page modules define small helper functions for filtering, formatting, and fetch wrappers

**Parameters:**
- Use explicit objects/types for structured props and filters
- Backend services use typed method signatures for clarity

## Module Design

**Exports:**
- TypeScript exports mostly use named exports for utilities (`backendEndpoint`, `officerFetch`)
- React pages/components use default exports for route entry components

**Barrel Files:**
- No barrel export pattern is prominent in the current code; modules are imported directly by path/alias

---
*Convention analysis: 2026-07-20*
*Update when patterns change*

