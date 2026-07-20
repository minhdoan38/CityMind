# Codebase Concerns

**Analysis Date:** 2026-07-20

## Tech Debt

**Auth error details are returned to clients:**
- Issue: Several backend endpoints convert exceptions into `HTTPException(502, "...: {exc}")`, embedding the raw exception string in the response.
- Why: This speeds debugging during MVP, but can leak internal implementation details.
- Impact: Potential disclosure of cloud resource identifiers, request metadata, or other sensitive info if exception messages contain them.
- Fix approach: Log exceptions server-side, and return generic messages to clients (optionally with stable error codes).
- Files:
  - `backend/app/api/reports.py` (e.g., `analyze_report`, `recent_reports`, `update_report_status`, `get_report_image`)

**Rate limiting uses `request.client.host` (proxy blind):**
- Issue: Rate limiting is keyed by `request.client.host`, which may reflect the load balancer/proxy IP rather than the real client.
- Why: In many Cloud Run / reverse-proxy setups, `client.host` does not equal the originating IP.
- Impact: A small number of IPs can throttle (or bypass) rate limits for many users, depending on infrastructure.
- Fix approach: Use `X-Forwarded-For` (or similar) and normalize to the left-most public IP, then document the behavior.
- File: `backend/app/security.py` (`enforce_report_rate_limit`)

## Known Bugs

**Unused/possibly miswired Next middleware:**
- Issue: `frontend/src/proxy.ts` contains a cookie-based guard (`proxy()`), but Next.js middleware is conventionally wired via `middleware.ts` at the project root (or `src/middleware.ts`).
- Why: The file name suggests intent, but it is not the standard Next middleware entrypoint.
- Impact: If the proxy guard was intended to protect routes, it may not run; protection depends entirely on server component checks and API route session checks.
- Fix approach: Verify middleware wiring, rename/move to `frontend/middleware.ts` (or `frontend/src/middleware.ts`) if that was intended, and add a simple integration test/verification.
- File: `frontend/src/proxy.ts`

## Security Considerations

**Officer auth can become permissive if configuration is wrong (non-production):**
- Issue: `require_officer()` returns without auth when `OFFICER_API_KEY` is empty, unless `APP_ENV == "production"` (then it returns 503).
- Why: This supports local development without auth configuration.
- Impact: If `APP_ENV` is accidentally set to non-production in production, officer endpoints could become publicly callable.
- Fix approach: Fail closed by default in production-like environments; require explicit opt-in for permissive behavior (e.g., `ALLOW_OPEN_OFFICER_API=true`).
- File: `backend/app/security.py` (`require_officer`)

**Gemini output is only schema-validated, not fact-validated:**
- Issue: The system instruction requests evidence-based output, but the code trusts the model output as long as it parses into `ReportAnalysis`.
- Why: MVP uses structured schema validation as the main guardrail.
- Impact: The model can still produce plausible but incorrect triage content (especially for severity/priority/uncertainty).
- Fix approach:
  - Add additional heuristics/verification (e.g., confidence calibration, cross-checking evidence fields)
  - Consider a two-stage approach: extract claims from input, then generate structured output referencing only extracted claims
- File: `backend/app/services/gemini.py` (`GeminiAnalyzer.analyze`)

**External enrichment may increase attack surface via network calls:**
- Issue: Urban context enrichment makes outbound calls to OpenWeather and Nominatim for each submission when enabled.
- Why: Feature-gated, but enabling adds dependency and availability risk.
- Impact: Increased latency and potential failure modes; could be abused for cost amplification if rate limiting is bypassed.
- Fix approach: Add caching, request timeouts (timeouts exist), and per-user/service rate limiting for enrichment, plus circuit breakers.
- File: `backend/app/services/context_data.py`

## Performance Bottlenecks

**Synchronous LLM + enrichment on the request path:**
- Issue: `/api/v1/reports/analyze` performs evidence upload, urban context enrichment, and Gemini generation before returning.
- Why: Simplifies UX, but couples latency to multiple external systems.
- Impact: Higher p95 response times; increased user-visible failures when any dependency degrades.
- Fix approach:
  - Consider background jobs for analysis/persistence
  - Add async retry/backoff and progressive UI updates
- File: `backend/app/api/reports.py::analyze_report`

**BigQuery “latest status” query cost:**
- Issue: `list_recent()` uses a `WITH latest_status ... QUALIFY ROW_NUMBER()` pattern and joins against latest status.
- Why: This is correct but can be expensive at scale without clustering/partitioning.
- Impact: Slower dashboard queries as report volume grows.
- Fix approach: Add/validate table partitioning + clustering by `report_id`/`created_at` (see `infra/bigquery/*.sql`), and ensure status table ingestion matches the “latest” query strategy.
- File: `backend/app/services/bigquery.py` (`list_recent`)

## Fragile Areas

**MIME type handling depends on upload `content_type`:**
- Issue: The backend checks `image.content_type` against `ALLOWED_IMAGE_TYPES` and uploads bytes as-is to GCS.
- Why: Browsers usually set content type, but some clients can mislabel.
- Impact: Non-image bytes could be uploaded if content type is incorrect, or valid images rejected if content type is missing.
- Fix approach: Validate bytes with a lightweight image signature check (magic bytes) or use server-side image sniffing.
- File: `backend/app/api/reports.py` (`analyze_report`)

## Missing Critical Features

**Observability is minimal:**
- Issue: No structured logging or tracing integration is detected (no Sentry/Datadog/OpenTelemetry usage found).
- Impact: Harder incident response and slower debugging across LLM/GCP failures.
- Fix approach: Add structured logs and correlation IDs; integrate an error tracker and/or tracing.

## Test Coverage Gaps

**No frontend automated tests:**
- Issue: Frontend uses lint/typecheck/build but no Playwright/Jest tests detected in repo.
- Impact: Regressions in officer/public flows (login/session, proxy routing, evidence rendering) may slip through.
- Fix approach: Add a small Playwright suite for:
  - Public report submission happy path (mock backend)
  - Officer login + dashboard rendering (mock backend)
  - Evidence image proxy authorization

**Gemini behavior is mocked but integration isn’t covered:**
- Issue: Gemini tests validate parsing and schema handling with stubs; there are no tests against real Vertex AI behavior.
- Impact: Real-world formatting deviations could cause production failures despite schema validation.
- Fix approach: Add a staging integration test suite gated behind a flag and using sandbox credentials.

---
*Concerns audit: 2026-07-20*
*Update as issues are fixed or new ones discovered*

