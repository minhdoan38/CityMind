# Phase 8: Async Triage Platform Refactor - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Split citizen intake from AI triage so reports persist and return `report_id` + `access_token` before analysis completes. AI/provider failure must never block intake or citizen access. Officers see every report in the default queue immediately with `triage_status` visibility; citizens see service-progress wording without provider errors. Triage runs through a self-hosted Node.js background worker with durable retries, idempotent claims, semantic policy validation, and full `triage_runs` / `triage_attempts` audit tables.

This phase implements TRIAGE-01 through TRIAGE-07. Eval suite and shadow rollout gate (TRIAGE-08) remain Phase 10. Self-help vs government routing remains Phase 9.

Reconcile `.planning/notes/async-triage-architecture.md` with the Phase 7 Next.js-only laptop runtime — FastAPI, Cloud Run, Cloud Tasks, and in-request `BackgroundTasks` are not valid production paths.

</domain>

<decisions>
## Implementation Decisions

### Background runner
- **D-01:** Use a **separate Node worker process** (e.g. `scripts/triage-worker.mjs` or `src/server/triage/worker.ts`) that runs alongside `next start`, registered via Windows Task Scheduler for production laptop ops.
- **D-02:** Worker discovers work by **polling** a Postgres job/claim table on an interval using `SELECT … FOR UPDATE SKIP LOCKED` (or equivalent idempotent claim on `reports.triage_status`).
- **D-03:** Worker authenticates via **DB claim only** — direct Supabase admin / service-role Postgres access. No required loopback HTTP internal handler for normal operation.
- **D-04:** Local dev runs **`npm run dev` + `npm run triage:worker`** in a second terminal. No sync-in-request shortcut.

### Intake API migration
- **D-05:** Primary citizen intake is **`POST /api/public/reports`** (and officer/v1 mirror if needed). Returns immediately after persist + enqueue/claim row.
- **D-06:** Response shape is minimal **`ReportSubmissionResponse`**: `{ report_id, access_token, intake_status, triage_status }` only — no analysis fields on intake.
- **D-07:** **Remove legacy `/analyze` routes** — return **410 Gone** (or equivalent documented removal). Update `ReportForm`, success flash, and contract tests in the same phase.
- **D-08:** Success page shows **token + reference ID only** — no category/severity until citizen checks status after triage completes.

### Retry and recovery
- **D-09:** **3 triage attempts** per report (1 initial + 2 retries) before terminal disposition.
- **D-10:** After retries exhaust, default terminal state is **`manual_review`** (officer queue), not citizen-facing failure. Reserve `failed` for unrecoverable system/data errors only.
- **D-11:** **Reconciliation reclaim** resets `processing` stuck longer than **15 minutes** back to claimable pending/work state.
- **D-12:** Use **exponential backoff** between attempts (e.g. ~30s → 2m → 10m); exact constants are planner discretion.

### Citizen status UX
- **D-13:** Use **four-step service labels**: received → AI review pending → under officer review → resolved/rejected.
- **D-14:** While `triage_status` is `pending` or `processing`, **hide all AI fields** — show reference ID, timestamps, and workflow step only.
- **D-15:** On `failed` / `manual_review`, show calm copy: *"Automated review is unavailable. Your report is saved and will be reviewed by an officer."* (EN/VI catalogs). Never expose provider errors, retries, or stack traces.
- **D-16:** Reveal category, severity, priority, and analysis narrative fields **only when `triage_status=completed`**.

### Officer queue UX
- **D-17:** Reports table shows **AI pending badge** for `pending`/`processing` and an **elevated badge** for `manual_review`/`failed`.
- **D-18:** Default sort: **`manual_review`/`failed` first** (oldest received within bucket), then `pending`/`processing`, then `completed`.
- **D-19:** **All triage statuses visible by default**; optional `triage_status` filter chip — no separate tab model in MVP.
- **D-20:** Detail page order: citizen description/image → AI status badge → observed facts (`evidence`) → unknowns (`uncertainty`) → severity/priority → officer decision controls. NULL AI fields stay NULL — never invent fallbacks.

### Semantic validation and audit
- **D-21:** Ship **full MVP policy set**: `critical` ↔ severity 5 alignment, immediate-danger claims require evidence, conflicting signals cap confidence ≤ 0.64, unsupported claims → `manual_review`.
- **D-22:** On semantic validation failure, perform **one AI retry** with validation errors in context; then `manual_review`.
- **D-23:** Officer-facing confidence: **no percentage**; if shown, label **"model confidence — uncalibrated"**.
- **D-24:** Persist **full audit**: `triage_runs` + `triage_attempts` with model, prompt/config version, raw output, latency, validation errors, retry output, and final disposition per attempt.

### Folded Todos
- **Spike: Cloud Tasks triage handler on Cloud Run** — Re-scoped for Phase 8. Original spike goal (idempotent claim, retry, terminal disposition) remains; delivery mechanism becomes **self-hosted Node worker + Postgres polling** per D-01–D-04. Cloud Tasks / Cloud Run / OIDC ingress are explicitly out of scope after Phase 7.

### Claude's Discretion
- Exact job table schema vs claiming directly on `reports.triage_status`.
- Worker poll interval, backoff constants, and npm script names.
- Internal module layout under `src/server/triage/`.
- Whether optional loopback `/api/internal/triage/{id}` exists for manual replay only (not required for production).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` — Phase 8 goal, success criteria, wave outline (08-01 through 08-05).
- `.planning/REQUIREMENTS.md` — TRIAGE-01 through TRIAGE-07 (Phase 8); TRIAGE-08 deferred to Phase 10.
- `.planning/PROJECT.md` — AI advisory-only principle and officer authority.

### Architecture decisions (reconcile for Next.js-only)
- `.planning/notes/async-triage-architecture.md` — Locked exploration for persist-first intake, status lifecycle, audit tables, and UX contracts. **Ignore FastAPI/Cloud Tasks/BackgroundTasks deployment sections** — superseded by Phase 7 runtime and D-01–D-04 here.
- `.planning/codebase/ai-logic.md` — Current synchronous analyze pipeline to split.
- `.planning/phases/07-google-free-self-hosted-platform/07-CONTEXT.md` — Next.js-only runtime; async triage explicitly deferred to Phase 8.
- `.planning/phases/04-citizen-status/04-CONTEXT.md` — Token privacy and anti-enumeration boundaries that must survive intake/status changes.

### Live code integration points
- `src/server/services/report-service.ts` — Current synchronous `analyzeReport` flow to refactor.
- `src/app/api/public/reports/analyze/route.ts` — Legacy route to remove (410).
- `src/server/ai/openai-compatible.ts` — Provider-neutral analysis adapter for triage module.
- `src/app/[locale]/status/page.tsx` — Citizen status UX surface.
- `src/app/dashboard/reports/` — Officer queue and detail surfaces.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/services/report-service.ts` — Validation, evidence upload, access-token issuance, and AI orchestration to split into intake vs triage paths.
- `src/server/ai/openai-compatible.ts` + `src/server/ai/provider.ts` — Provider-neutral structured analysis for triage worker reuse.
- `src/server/repositories/reports.ts` — Report persistence and list queries to extend with `triage_status` filters/sort.
- `src/server/security/access-tokens.ts` — Token issuance on persist (unchanged contract: hash at rest, plaintext once).
- `src/components/ReportForm.tsx` — Citizen submit flow to retarget from `/analyze` to `/reports`.

### Established Patterns
- Next.js App Router API routes call `src/server/` services directly (no FastAPI proxy).
- AI output is advisory; officers retain final authority on status transitions.
- Citizen status uses uniform 401 anti-enumeration; provider errors never leak to public surfaces.
- Supabase Postgres is the sole operational store; service-role client used only server-side for privileged writes.

### Integration Points
- New `POST /api/public/reports` intake route + v1 mirror if required for contract parity.
- New triage worker entry script registered beside existing Task Scheduler / smoke tooling.
- Supabase migrations: `triage_status`, `triage_error`, `triaged_at`, `triage_runs`, `triage_attempts`, optional job/claim columns.
- Citizen success flash, `/[locale]/status` page, and EN/VI message catalogs.
- Officer dashboard table badges, default sort, filter chips, and detail section order.

</code_context>

<specifics>
## Specific Ideas

- User chose the simplest durable laptop pattern: separate Node worker + Postgres polling, not Cloud Tasks or in-request background work.
- Legacy `/analyze` should be removed cleanly (410), not shimmed — citizen form updates happen in the same phase.
- Officers should see problematic triage states elevated in default sort without hiding completed reports.

</specifics>

<deferred>
## Deferred Ideas

- TRIAGE-08 eval suite and shadow rollout production gate — Phase 10.
- Self-help vs government routing policy — Phase 9.
- Cloud Tasks, Cloud Run, FastAPI `BackgroundTasks`, and OIDC internal ingress — removed by Phase 7; not revived.

</deferred>

---

*Phase: 08-Async Triage Platform Refactor*
*Context gathered: 2026-07-22*
