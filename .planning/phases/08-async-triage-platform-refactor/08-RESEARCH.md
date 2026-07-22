# Phase 8: Async Triage Platform Refactor - Research

**Researched:** 2026-07-22
**Domain:** Persist-first citizen intake, Postgres-backed async triage worker, semantic validation, audit tables, citizen/officer UX contracts
**Confidence:** HIGH

## Summary

Phase 8 splits the current synchronous `analyzeReport` path in `src/server/services/report-service.ts` into **intake** (persist report + access token immediately) and **triage** (AI analysis in a separate Node worker). The locked architecture is a **self-hosted Node worker** polling Supabase Postgres with `SELECT … FOR UPDATE SKIP LOCKED`, not Cloud Tasks, FastAPI, or in-request background work. [VERIFIED: `08-CONTEXT.md`, live `report-service.ts`]

The current codebase already has the right building blocks for triage execution: provider-neutral AI (`src/server/ai/openai-compatible.ts`), Zod schema validation (`src/server/domain/report-analysis.ts`), partial policy validation (`src/server/validation/analysis-policy.ts`), atomic report+token RPC (`create_report_with_access_token`), evidence upload, and citizen status anti-enumeration. What is missing is the **schema columns**, **claim/retry/reclaim SQL**, **worker process**, **audit tables**, **intake API**, **410 on `/analyze`**, and **UX contracts** for triage-aware citizen/officer surfaces.

**Primary recommendation:** Add triage lifecycle columns directly on `reports` (no separate job table), implement claim/complete/reclaim as **Postgres RPC functions** using a CTE + `FOR UPDATE SKIP LOCKED`, run a `scripts/triage-worker.mjs` process via `pg` + `SUPABASE_DB_URL`, and refactor `report-service.ts` into `submitReport` (intake) and `src/server/triage/*` (worker-owned analysis, policy, audit). Extend `validateAnalysisPolicy` for Phase 8 MVP rules; keep the existing 11-field `ReportAnalysis` schema for this phase — the evaluator JSON in `prompt/citymind_ai_triage_structured_output_evaluator.json` is the Phase 10 eval contract, not a mandatory schema migration for Phase 8.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Citizen intake (`POST /reports`) | API / Backend (`src/app/api/public/reports`) | Database (atomic RPC) | Must persist before triage; returns token immediately |
| Evidence upload on intake | API / Backend (`evidence-service`) | Supabase Storage | Upload happens at intake; triage reads stored evidence |
| Triage claim / retry / reclaim | Database (Postgres RPC + row locks) | Worker process | `SKIP LOCKED` requires transactional SQL; worker is executor only |
| AI provider call | Worker (`src/server/triage/`) | — | Must not block HTTP intake; no in-request background task |
| Schema + semantic validation | Worker (`src/server/triage/`) | — | Validation retry and `manual_review` disposition belong in triage service |
| Audit (`triage_runs`, `triage_attempts`) | Database | Worker writes via service-role | Durable lineage for officers and Phase 10 eval gate |
| Citizen status presentation | Browser + API (`status` page, status API) | — | Service-progress labels; hide AI fields until `completed` |
| Officer queue badges/sort/filter | Frontend Server (dashboard loaders) + Browser | Database indexes | Officers read `reports` immediately; NULL AI fields stay NULL |
| Legacy `/analyze` removal | API route (410 Gone) | Contract tests | Clean break; form retargeted in same phase |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Background runner
- **D-01:** Use a **separate Node worker process** (e.g. `scripts/triage-worker.mjs` or `src/server/triage/worker.ts`) that runs alongside `next start`, registered via Windows Task Scheduler for production laptop ops.
- **D-02:** Worker discovers work by **polling** a Postgres job/claim table on an interval using `SELECT … FOR UPDATE SKIP LOCKED` (or equivalent idempotent claim on `reports.triage_status`).
- **D-03:** Worker authenticates via **DB claim only** — direct Supabase admin / service-role Postgres access. No required loopback HTTP internal handler for normal operation.
- **D-04:** Local dev runs **`npm run dev` + `npm run triage:worker`** in a second terminal. No sync-in-request shortcut.

#### Intake API migration
- **D-05:** Primary citizen intake is **`POST /api/public/reports`** (and officer/v1 mirror if needed). Returns immediately after persist + enqueue/claim row.
- **D-06:** Response shape is minimal **`ReportSubmissionResponse`**: `{ report_id, access_token, intake_status, triage_status }` only — no analysis fields on intake.
- **D-07:** **Remove legacy `/analyze` routes** — return **410 Gone** (or equivalent documented removal). Update `ReportForm`, success flash, and contract tests in the same phase.
- **D-08:** Success page shows **token + reference ID only** — no category/severity until citizen checks status after triage completes.

#### Retry and recovery
- **D-09:** **3 triage attempts** per report (1 initial + 2 retries) before terminal disposition.
- **D-10:** After retries exhaust, default terminal state is **`manual_review`** (officer queue), not citizen-facing failure. Reserve `failed` for unrecoverable system/data errors only.
- **D-11:** **Reconciliation reclaim** resets `processing` stuck longer than **15 minutes** back to claimable pending/work state.
- **D-12:** Use **exponential backoff** between attempts (e.g. ~30s → 2m → 10m); exact constants are planner discretion.

#### Citizen status UX
- **D-13:** Use **four-step service labels**: received → AI review pending → under officer review → resolved/rejected.
- **D-14:** While `triage_status` is `pending` or `processing`, **hide all AI fields** — show reference ID, timestamps, and workflow step only.
- **D-15:** On `failed` / `manual_review`, show calm copy: *"Automated review is unavailable. Your report is saved and will be reviewed by an officer."* (EN/VI catalogs). Never expose provider errors, retries, or stack traces.
- **D-16:** Reveal category, severity, priority, and analysis narrative fields **only when `triage_status=completed`**.

#### Officer queue UX
- **D-17:** Reports table shows **AI pending badge** for `pending`/`processing` and an **elevated badge** for `manual_review`/`failed`.
- **D-18:** Default sort: **`manual_review`/`failed` first** (oldest received within bucket), then `pending`/`processing`, then `completed`.
- **D-19:** **All triage statuses visible by default**; optional `triage_status` filter chip — no separate tab model in MVP.
- **D-20:** Detail page order: citizen description/image → AI status badge → observed facts (`evidence`) → unknowns (`uncertainty`) → severity/priority → officer decision controls. NULL AI fields stay NULL — never invent fallbacks.

#### Semantic validation and audit
- **D-21:** Ship **full MVP policy set**: `critical` ↔ severity 5 alignment, immediate-danger claims require evidence, conflicting signals cap confidence ≤ 0.64, unsupported claims → `manual_review`.
- **D-22:** On semantic validation failure, perform **one AI retry** with validation errors in context; then `manual_review`.
- **D-23:** Officer-facing confidence: **no percentage**; if shown, label **"model confidence — uncalibrated"**.
- **D-24:** Persist **full audit**: `triage_runs` + `triage_attempts` with model, prompt/config version, raw output, latency, validation errors, retry output, and final disposition per attempt.

#### Folded Todos
- **Spike: Cloud Tasks triage handler on Cloud Run** — Re-scoped for Phase 8. Original spike goal (idempotent claim, retry, terminal disposition) remains; delivery mechanism becomes **self-hosted Node worker + Postgres polling** per D-01–D-04. Cloud Tasks / Cloud Run / OIDC ingress are explicitly out of scope after Phase 7.

### Claude's Discretion
- Exact job table schema vs claiming directly on `reports.triage_status`.
- Worker poll interval, backoff constants, and npm script names.
- Internal module layout under `src/server/triage/`.
- Whether optional loopback `/api/internal/triage/{id}` exists for manual replay only (not required for production).

### Deferred Ideas (OUT OF SCOPE)
- TRIAGE-08 eval suite and shadow rollout production gate — Phase 10.
- Self-help vs government routing policy — Phase 9.
- Cloud Tasks, Cloud Run, FastAPI `BackgroundTasks`, and OIDC internal ingress — removed by Phase 7; not revived.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIAGE-01 | `POST /reports` persists report before triage; returns `report_id` + `access_token` immediately | Split `analyzeReport` → `submitReport`; new intake RPC with NULL AI fields; `ReportSubmissionResponse` DTO |
| TRIAGE-02 | `triage_status` lifecycle; AI failure never blocks intake | Columns on `reports`; worker updates status; intake path never calls AI |
| TRIAGE-03 | Citizen status service-progress wording; hide AI until completed; calm message on failed | Extend status API payload + `status/page.tsx`; never return `triage_error` or provider detail |
| TRIAGE-04 | Officers see all reports immediately; elevated failed/manual_review; triage filter; NULL AI fields | Extend `reports` list query sort/filter; badges in `ReportsTable`; detail page triage badge |
| TRIAGE-05 | Self-hosted background worker with durable retries; no in-request background task | `triage-worker.mjs` + Postgres `SKIP LOCKED` claim; Task Scheduler registration |
| TRIAGE-06 | `triage_runs` + `triage_attempts` audit tables | New migrations + audit writer in triage service |
| TRIAGE-07 | Semantic policy validation; invalid output → `manual_review` | Extend `validateAnalysisPolicy`; validation retry in triage service (separate from infra retries) |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | 8.22.0 [VERIFIED: npm registry via `npm view pg version`] | Direct Postgres connection for worker claim/reclaim SQL | Supabase JS client cannot express `FOR UPDATE SKIP LOCKED`; worker needs transactional SQL [CITED: PostgreSQL docs — queue-like table use case] |
| `next` | 16.2.10 (existing) | Intake API routes | Project runtime; no FastAPI |
| `@supabase/supabase-js` | 2.110.7 (existing) | Intake persist, evidence, officer reads | Established Phase 7 pattern |
| `zod` | 4.4.3 (existing) | `ReportAnalysisSchema`, request validation | Already used in report pipeline |
| `vitest` | 4.1.10 (existing) | Unit tests for triage service, policy, intake | Project test runner |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `pg` Pool | — | Worker long-lived connection | Poll loop in `triage-worker.mjs` |
| Postgres RPC functions | — | Atomic claim/complete/reclaim | All multi-step queue mutations |
| `scripts/register-citymind-task.ps1` (extend) | existing | Windows Task Scheduler | Register worker beside `next start` |
| `scripts/run-supabase-sql.mjs` | existing | SQL contract tests | When `psql` unavailable on dev machine |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `reports` claim columns | Separate `triage_jobs` table | Extra join and sync; rejected for MVP laptop simplicity (discussion log) |
| `pg` worker connection | Loopback HTTP internal handler | Rejected as primary path (D-03); optional debug replay only |
| `pg-boss` / Redis queue | Postgres `SKIP LOCKED` | Rejected in discussion; adds dependency and ops surface |
| In-request `setImmediate` / Next.js background | Separate worker process | Violates D-04/D-05; intake must not depend on request lifetime |

**Installation:**
```bash
npm install pg
npm install -D @types/pg
```

**Version verification:**
```bash
npm view pg version          # 8.22.0
npm view @types/pg version   # verify at plan time
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `pg` | npm | ~14 yrs | ~6M/wk [ASSUMED] | github.com/brianc/node-postgres | OK | Approved |
| `@types/pg` | npm | — | — | DefinitelyTyped | not run | Approved — standard types package [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

slopcheck rated `pg` [OK]; install subprocess failed on Windows PATH but package legitimacy check passed.

## Architecture Patterns

### System Architecture Diagram

```text
Citizen                Next.js API              Postgres                 Triage Worker
  |                        |                       |                          |
  |-- POST /reports ------>|                       |                          |
  |                        |-- upload evidence --->| Storage                  |
  |                        |-- intake RPC -------->| reports (pending)        |
  |                        |-- issue token ------->| access_tokens            |
  |<-- report_id + token --|                       |                          |
  |                        |                       |<-- poll + SKIP LOCKED ---|
  |                        |                       |--- claim (processing) -->|
  |                        |                       |                          |-- AI provider
  |                        |                       |                          |-- schema validate
  |                        |                       |                          |-- policy validate
  |                        |                       |<-- audit attempts -------|
  |                        |                       |<-- update report AI -----|
  |                        |                       |    (completed | manual_review | failed)
  |-- POST /status ------->|                       |                          |
  |<-- service labels -----| (no provider errors)  |                          |
Officer dashboard ------->| read reports + triage_status                     |
```

### Recommended Project Structure

```text
src/
├── app/api/public/reports/route.ts          # POST intake (new)
├── app/api/public/reports/analyze/route.ts  # 410 Gone
├── server/
│   ├── services/report-service.ts           # submitReport + legacy analyze removal
│   ├── triage/
│   │   ├── worker.ts                        # poll loop (importable from script)
│   │   ├── claim.ts                         # claim/reclaim SQL wrappers
│   │   ├── service.ts                       # runTriageForReport
│   │   ├── audit.ts                         # triage_runs / triage_attempts writer
│   │   ├── config.ts                        # prompt/config version constants
│   │   └── disposition.ts                   # manual_review vs failed vs completed
│   └── validation/analysis-policy.ts        # extended MVP rules
scripts/
├── triage-worker.mjs                        # production/dev worker entry
└── register-citymind-task.ps1               # extend for worker task (optional second task)
supabase/migrations/
└── 08_*_async_triage.sql                    # columns, audit tables, claim RPCs
supabase/tests/
└── 08_async_triage_contract.sql             # claim idempotency, reclaim, RLS
```

### Pattern 1: Atomic claim with CTE + SKIP LOCKED

**What:** Claim one pending report per worker tick inside a single transaction using a materialized CTE to avoid nested-loop `LIMIT` bugs. [CITED: PostgreSQL docs — "avoid lock contention with multiple consumers accessing a queue-like table"; CITED: Stack Overflow / planner guidance on CTE materialization]

**When to use:** Every worker poll; never claim via Supabase REST `update` without row lock.

**Example:**
```sql
-- Source: PostgreSQL SELECT docs + queue pattern references
WITH next_report AS (
  SELECT report_id
  FROM public.reports
  WHERE triage_status = 'pending'
    AND (triage_next_attempt_at IS NULL OR triage_next_attempt_at <= now())
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE public.reports r
SET triage_status = 'processing',
    triage_claimed_at = now()
FROM next_report
WHERE r.report_id = next_report.report_id
RETURNING r.*;
```

### Pattern 2: Intake without AI

**What:** Persist citizen data and token first; leave AI columns NULL; set `triage_status = 'pending'`.

**When to use:** `POST /api/public/reports` only.

**Example:**
```typescript
// Source: existing report-service.ts patterns
export async function submitReport(formData: FormData, deps: ReportServiceDeps) {
  const reportId = randomUUID();
  // validate + optional evidence upload (same as today)
  const { plaintext, tokenHash, expiresAt } = issueAccessToken();
  await createIntakeReportWithAccessToken(deps.client, {
    reportId,
    tokenHash,
    tokenExpiresAt: expiresAt,
    description,
    latitude,
    longitude,
    evidencePath,
    intakeStatus: "received",
    triageStatus: "pending",
  });
  return {
    report_id: reportId,
    access_token: plaintext,
    intake_status: "received",
    triage_status: "pending",
  };
}
```

### Pattern 3: Two retry dimensions

**What:** Separate **infrastructure retries** (3 attempts for timeout/http/schema parse) from **semantic validation retry** (1 extra AI call with policy violations fed back, then `manual_review`).

**When to use:** Inside `runTriageForReport`; record each provider call as a `triage_attempts` row.

| Failure type | Action | Counts against |
|--------------|--------|----------------|
| Provider timeout / HTTP / empty response | Backoff + requeue | 3 triage attempts (D-09) |
| JSON/schema parse failure | Backoff + requeue | 3 triage attempts |
| Policy violation (first) | One validation retry with errors | Does not consume infra attempt bucket if handled inside same claimed run [ASSUMED — planner should codify] |
| Policy violation (after validation retry) | `manual_review` | Terminal |
| Exhausted infra retries | `manual_review` (D-10) | Terminal |

### Pattern 4: Reclaim stuck `processing`

**What:** Periodic SQL in worker loop resets rows where `triage_status = 'processing'` AND `triage_claimed_at < now() - interval '15 minutes'` back to `pending` with incremented attempt metadata.

**When to use:** Every worker poll (cheap single UPDATE) before claim.

### Anti-Patterns to Avoid

- **Calling AI inside `POST /reports`:** Violates TRIAGE-01/02/05; current `analyzeReport` is the anti-pattern to remove.
- **Claiming via PostgREST without `SKIP LOCKED`:** Race conditions under multiple workers or reclaim overlap.
- **Exposing `triage_error` on citizen status API:** Violates D-15 and CIT-03 spirit.
- **Backfilling NULL AI fields with placeholders:** Violates D-20; officers must see NULL until triage completes.
- **Keeping `/analyze` as shim:** Violates D-07; return 410 and update `ReportForm` (`src/components/ReportForm.tsx` still posts to `/analyze` [VERIFIED: codebase grep]).
- **Policy validation inside `openai-compatible.ts` for triage path:** Prevents validation-retry flow (provider currently throws `policy_invalid` [VERIFIED: `openai-compatible.ts`]); triage service must own policy disposition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue locking | App-level mutex / SELECT then UPDATE | Postgres `FOR UPDATE SKIP LOCKED` in RPC | Race-free, crash-safe release on rollback [CITED: PostgreSQL docs] |
| Worker DB access | Raw string SQL in many files | `pg` Pool + parameterized RPC calls | Connection pooling, typed params, testable contracts |
| Retry scheduling | Custom in-memory timers | `triage_next_attempt_at` column + poll | Survives process restarts; laptop-friendly |
| Access token issuance | New token format | `issueAccessToken()` + hash at rest | DATA-03 unchanged |
| Evidence validation | New image gate | `validateEvidenceBytes` / `uploadEvidence` | DATA-09 already implemented |
| Citizen 401 behavior | New status codes | Uniform 401 via `citizenStatusUnauthorized()` | CIT-03 preserved |

**Key insight:** The queue **is** Postgres row state + locks. A separate broker (Redis, Cloud Tasks) was explicitly rejected; durability comes from transactional claim on `reports`.

## Common Pitfalls

### Pitfall 1: Nested-loop LIMIT bug on claim subquery

**What goes wrong:** `UPDATE … WHERE id = (SELECT … LIMIT 1 FOR UPDATE SKIP LOCKED)` can return multiple rows under some planner plans.

**Why it happens:** Subquery re-evaluated per outer row. [CITED: PostgreSQL community guidance]

**How to avoid:** Use `WITH next_report AS (…) UPDATE … FROM next_report`.

**Warning signs:** Integration test shows two workers completing the same `report_id`.

### Pitfall 2: Policy validation trapped in provider adapter

**What goes wrong:** `createOpenAiCompatibleProvider` throws `policy_invalid` before triage can retry with feedback.

**Why it happens:** Phase 7 placed policy inside provider for sync analyze.

**How to avoid:** Add `analyzeStructured` that stops after schema parse; run `validateAnalysisPolicy` in triage service; keep provider throw only for sync legacy path until removed.

### Pitfall 3: Citizen status leaks AI summary early

**What goes wrong:** `getCitizenStatus` returns `summary` while `triage_status` is `pending`.

**Why it happens:** Current repository selects `summary` unconditionally [VERIFIED: `repositories/reports.ts` `getCitizenStatus`].

**How to avoid:** Join/filter on `triage_status`; project service-step labels separately from officer `current_status`.

### Pitfall 4: Officer priority sort breaks with NULL AI fields

**What goes wrong:** Default sort by `priority` puts NULL rows unpredictably.

**Why it happens:** Existing lexicographic priority sort unchanged.

**How to avoid:** Primary sort key = triage disposition bucket (D-18), then `created_at`; keep NULL AI columns out of sort when pending.

### Pitfall 5: Worker not started in dev

**What goes wrong:** Reports stuck in `pending` forever; officers see AI pending badges indefinitely.

**Why it happens:** D-04 requires second terminal; no sync fallback.

**How to avoid:** Document `npm run triage:worker`; add smoke test that claims a seeded pending report.

### Pitfall 6: Schema mismatch with evaluator JSON

**What goes wrong:** Planner migrates to evaluator's 11-key schema (`observed_facts`, `requires_human_review`, etc.) and breaks dashboard/officer UI expecting `summary`/`recommendation`.

**Why it happens:** `prompt/citymind_ai_triage_structured_output_evaluator.json` describes Phase 10 eval contract with different field names.

**How to avoid:** Phase 8 extends **current** `ReportAnalysis` schema and policy rules mapped to `evidence`/`uncertainty`; defer full schema swap to Phase 10 if needed.

## Code Examples

### Worker poll loop

```typescript
// Source: Phase 8 research pattern (pg official pool usage [ASSUMED: node-postgres docs])
import { Pool } from "pg";
import { runTriageForReport } from "@/server/triage/service";

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });

async function tick() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT public.reclaim_stuck_triage_reports($1)", ["15 minutes"]);
    const { rows } = await client.query("SELECT * FROM public.claim_triage_report()");
    await client.query("COMMIT");
    if (rows[0]) {
      await runTriageForReport(rows[0].report_id);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

### Extended policy check (MVP D-21)

```typescript
// Source: 08-CONTEXT D-21 + evaluator cross_field_rules [ASSUMED mapping to ReportAnalysis]
export function validateAnalysisPolicy(analysis: ReportAnalysis): PolicyResult {
  const violations = [...basePhase7Checks(analysis)];

  if (analysis.priority === "critical" && analysis.severity !== 5) {
    violations.push(violation("critical_requires_severity_5", "..."));
  }
  if (analysis.severity === 5 && !hasImmediateDangerEvidence(analysis)) {
    violations.push(violation("severity_5_requires_immediate_danger_evidence", "..."));
  }
  if (hasConflictingSignals(analysis) && analysis.confidence > 0.64) {
    violations.push(violation("conflict_confidence_cap", "..."));
  }
  // unsupported claims → manual_review handled in disposition layer
  return violations.length ? { ok: false, violations } : { ok: true };
}
```

### Citizen status projection

```typescript
// Source: 08-CONTEXT D-13–D-16
function projectCitizenTriageView(report: ReportRow): CitizenStatusView {
  if (report.triage_status === "pending" || report.triage_status === "processing") {
    return { step: "ai_review_pending", summary: null, category: null };
  }
  if (report.triage_status === "failed" || report.triage_status === "manual_review") {
    return { step: "automated_review_unavailable", summary: null };
  }
  if (report.triage_status === "completed") {
    return { step: mapOfficerStatus(report.current_status), summary: report.summary, ... };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync `POST /analyze` (AI before persist) | `POST /reports` + async worker | Phase 8 | Citizen never loses submission on AI outage |
| FastAPI BackgroundTasks / Cloud Tasks | Node worker + Postgres polling | Phase 7 removed cloud; Phase 8 implements | Laptop-only durable triage |
| Gemini / Vertex | OpenAI-compatible provider | Phase 7 | Worker reuses `openai-compatible.ts` |
| No `triage_status` | Lifecycle on `reports` | Phase 8 migration | Officer queue visibility before AI completes |
| Policy in provider only | Triage-owned validation + audit | Phase 8 | Enables validation retry + `manual_review` |

**Deprecated/outdated:**
- `POST /api/public/reports/analyze` and v1 mirror — return **410 Gone** (D-07)
- `.planning/notes/async-triage-architecture.md` FastAPI/Cloud Tasks sections — superseded by D-01–D-04

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 8 keeps existing `ReportAnalysis` fields; evaluator JSON is Phase 10 eval input | Pitfall 6 | Large unplanned UI/schema migration |
| A2 | Validation retry does not consume an infrastructure attempt slot | Pattern 3 | Over-aggressive `manual_review` or extra provider cost |
| A3 | `intake_status` is a stored column or constant `"received"` in response only | Intake API | Minor API contract drift |
| A4 | `pg` weekly download count ~6M | Package audit | Low — slopcheck OK |
| A5 | `hasImmediateDangerEvidence` / `hasConflictingSignals` helpers derived from evaluator rules applied to `evidence`/`uncertainty` text | Policy | Under- or over-triage until Phase 10 eval calibrates |

## Open Questions (RESOLVED)

1. **Separate `triage_jobs` table vs columns on `reports`?** — **RESOLVED:** Columns on `reports` for claim scheduling (`triage_next_attempt_at`, `triage_attempt_count`, `triage_claimed_at`) plus `triage_runs`/`triage_attempts` for audit — no third queue table.

2. **v1 API mirror for intake?** — **RESOLVED:** Add `POST /api/v1/reports` intake + 410 on v1 analyze in same wave as public routes (08-01).

3. **Urban context on async path?** — **RESOLVED:** Defer urban context to triage worker if re-enabled env flag exists; do not block intake.

4. **Validation retry vs infrastructure attempt budget?** — **RESOLVED:** Validation retry runs inside one claimed worker tick; does not consume a separate infrastructure attempt slot beyond the service-layer retry counter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22+ | Next.js + worker | ✓ | v25.2.1 | — |
| npm | scripts/tests | ✓ | 11.6.2 | — |
| Supabase CLI | migrations/SQL gates | ✓ | 2.109.1 | — |
| `psql` | Plan 07 SQL gates | ✗ | — | `scripts/run-supabase-sql.mjs` / `supabase db query` |
| `SUPABASE_DB_URL` | Worker + SQL tests | ? | — | Required env; worker cannot run without it |
| AI provider (`THIRD_PARTY_API_KEY`, `AI_BASE_URL`) | Triage execution | ? | — | Reports persist; triage stays `pending`/`manual_review` |
| Windows Task Scheduler | Production worker | ✓ [ASSUMED on target laptop] | — | Manual second process in dev |

**Missing dependencies with no fallback:**
- `SUPABASE_DB_URL` for triage worker (blocks TRIAGE-05)

**Missing dependencies with fallback:**
- `psql` → `run-supabase-sql.mjs`

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm run test:unit -- src/server/triage` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIAGE-01 | Intake persists before AI; returns submission DTO | unit | `npm run test:unit -- src/server/services/report-service.test.ts -t submit` | ❌ Wave 0 |
| TRIAGE-01 | `/analyze` returns 410 | unit/legacy | `npm run test:legacy -- tests/report-form.test.mjs` | ❌ update needed |
| TRIAGE-02 | Lifecycle transitions pending→processing→terminal | SQL integration | `node scripts/run-supabase-sql.mjs supabase/tests/08_async_triage_contract.sql` | ❌ Wave 0 |
| TRIAGE-02 | Claim idempotent under concurrency | SQL integration | same | ❌ Wave 0 |
| TRIAGE-03 | Citizen status hides AI when not completed | unit | `npm run test:unit -- src/server/services/citizen-status.test.ts` | ❌ extend |
| TRIAGE-05 | Worker claims only due pending rows | unit | `npm run test:unit -- src/server/triage/claim.test.ts` | ❌ Wave 0 |
| TRIAGE-06 | Audit rows per attempt | unit + SQL | `npm run test:unit -- src/server/triage/audit.test.ts` | ❌ Wave 0 |
| TRIAGE-07 | Policy violations → manual_review disposition | unit | `npm run test:unit -- src/server/validation/analysis-policy.test.ts` | ✅ extend |
| TRIAGE-07 | Validation retry then manual_review | unit | `npm run test:unit -- src/server/triage/service.test.ts` | ❌ Wave 0 |
| TRIAGE-04 | Officer sort bucket order | unit | `npm run test:unit -- src/server/repositories/reports.test.ts` | ❌ extend |

### Sampling Rate

- **Per task commit:** `npm run test:unit -- <touched-module>.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** `node scripts/run-supabase-sql.mjs supabase/tests/08_async_triage_contract.sql` + full `npm run test`

### Wave 0 Gaps

- [ ] `supabase/migrations/08_*_async_triage.sql` — schema + RPCs
- [ ] `supabase/tests/08_async_triage_contract.sql` — claim, reclaim, audit, RLS
- [ ] `src/server/triage/*.test.ts` — worker service, claim, audit, disposition
- [ ] `src/server/services/report-service.test.ts` — `submitReport` + 410 handler tests
- [ ] `tests/report-form.test.mjs` — endpoint retarget to `/api/public/reports`
- [ ] `tests/contracts/golden-contracts.test.ts` — new intake fixture; analyze 410
- [ ] `package.json` scripts: `triage:worker`
- [ ] Framework install: `pg`, `@types/pg`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (worker) | Worker uses DB service role, not citizen auth |
| V3 Session Management | no | — |
| V4 Access Control | yes | Officer routes gated; citizen token scope unchanged; audit tables service-role only |
| V5 Input Validation | yes | Zod on intake; `ReportAnalysisSchema`; evidence magic bytes |
| V6 Cryptography | yes | Access token SHA-256 at rest (unchanged) |

### Known Threat Patterns for Phase 8

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Citizen enumerates triage failures | Information disclosure | Never expose `triage_error`, provider codes, or retry count (D-15) |
| Double triage on same report | Tampering | `FOR UPDATE SKIP LOCKED` + idempotent claim RPC |
| Worker credential exposure | Information disclosure | `SUPABASE_DB_URL` server-side only; never in client bundle |
| AI prompt injection via report text | Spoofing | Existing system instruction + policy checks; validation retry does not widen trust |
| Officer sees fabricated AI defaults | Tampering | NULL AI fields until `completed` (D-20) |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found in the workspace. Follow `AGENTS.md` GSD workflow: execute via `/gsd-execute-phase 8`; advisory-only AI; Supabase Postgres sole ops store; loopback-first laptop runtime.

## Sources

### Primary (HIGH confidence)
- `08-CONTEXT.md` — locked decisions D-01–D-24
- `src/server/services/report-service.ts` — current sync pipeline to split
- `src/server/ai/openai-compatible.ts` — provider adapter
- `src/server/validation/analysis-policy.ts` — existing policy baseline
- `supabase/migrations/20260721130004_evidence_path_additive.sql` — `create_report_with_access_token` shape
- [PostgreSQL SELECT — FOR UPDATE SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) — queue-like table guidance

### Secondary (MEDIUM confidence)
- `.planning/notes/async-triage-architecture.md` — UX and audit intent (deployment sections superseded)
- `prompt/citymind_ai_triage_structured_output_evaluator.json` — policy rule reference for D-21
- `scripts/register-citymind-task.ps1` — Task Scheduler pattern for worker registration
- [Prisma blog — Postgres SKIP LOCKED queue](https://www.prisma.io/blog/you-dont-need-a-job-queue-postgres-already-has-skip-locked) — CTE claim pattern cross-check

### Tertiary (LOW confidence)
- Netdata / MonPG queue articles — pattern reinforcement only; prefer PostgreSQL docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `pg` verified; patterns match locked D-01–D-04 and live codebase
- Architecture: HIGH — clear split from existing `report-service.ts`; officer/citizen touchpoints identified
- Pitfalls: MEDIUM — policy-to-field mapping and validation-retry accounting need plan-level specification (A2, A5)

**Research date:** 2026-07-22
**Valid until:** 2026-08-21 (30 days — stable Postgres/Next patterns)
