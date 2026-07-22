# Phase 8: Async Triage Platform Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 8-Async Triage Platform Refactor
**Areas discussed:** Background runner, Intake API migration, Retry & recovery, Citizen status UX, Officer queue UX, Semantic validation

---

## Folded Todos

| Todo | Action |
|------|--------|
| Spike Cloud Tasks triage handler on Cloud Run | Folded — re-scoped to self-hosted Node worker + Postgres polling |

---

## Background runner

| Option | Description | Selected |
|--------|-------------|----------|
| Separate Node worker process | `triage-worker.mjs` polls Postgres; Task Scheduler alongside `next start` | ✓ |
| Postgres job queue (pg-boss) | Durable queue in Supabase Postgres | |
| Loopback HTTP + scheduled sweep | Task Scheduler POSTs internal handler | |
| You decide | Simplest durable laptop pattern | |

**Follow-up choices:**
- Trigger: Poll job table with `SKIP LOCKED` ✓
- Auth: DB claim only (no required HTTP handler) ✓
- Dev: `npm run dev` + `npm run triage:worker` in second terminal ✓

---

## Intake API migration

| Option | Description | Selected |
|--------|-------------|----------|
| New POST /api/public/reports | Primary intake; ReportSubmissionResponse only | ✓ |
| Dual endpoints | Keep /analyze as deprecated shim | |
| Evolve /analyze in place | Same URL, optional analysis fields | |

**Follow-up choices:**
- Response: Minimal `{ report_id, access_token, intake_status, triage_status }` ✓
- Legacy /analyze: Remove — 410 Gone ✓
- Success page: Token + reference ID only ✓

---

## Retry & recovery

| Option | Description | Selected |
|--------|-------------|----------|
| 3 attempts | 1 initial + 2 retries | ✓ |
| 2 attempts | Faster to manual_review | |
| 5 attempts | More outage tolerance | |

**Follow-up choices:**
- Terminal state: `manual_review` default ✓
- Stuck processing reclaim: 15 minutes ✓
- Backoff: Exponential ✓

---

## Citizen status UX

| Option | Description | Selected |
|--------|-------------|----------|
| 4-step service labels | received → AI review pending → under officer review → resolved/rejected | ✓ |
| 3-step simplified | Submitted → In review → Resolved/Rejected | |
| Status badge only | Officer status primary | |

**Follow-up choices:**
- Pending/processing: Hide all AI fields ✓
- Failed/manual_review: Calm saved message (EN/VI) ✓
- Reveal AI fields: Only when `triage_status=completed` ✓

---

## Officer queue UX

| Option | Description | Selected |
|--------|-------------|----------|
| AI pending badge | Distinct badges; elevated for manual_review/failed | ✓ |
| Triage column | Dedicated column | |
| Minimal dot | Icon only on list | |

**Follow-up choices:**
- Default sort: Elevated triage states first ✓
- Default filter: All statuses visible; optional triage filter chip ✓
- Detail layout: Architecture doc order (description → badge → evidence → uncertainty → severity/priority → controls) ✓

---

## Semantic validation

| Option | Description | Selected |
|--------|-------------|----------|
| Full MVP policy set | critical↔severity 5, evidence rules, confidence cap, unsupported → manual_review | ✓ |
| Schema only | Defer semantic policy | |
| Minimal | Enum/range checks only | |

**Follow-up choices:**
- Validation retry: One AI retry with errors, then manual_review ✓
- Confidence display: "model confidence — uncalibrated"; no percentage ✓
**Follow-up:** Audit depth — full `triage_runs` + `triage_attempts` per attempt ✓

---

## Claude's Discretion

- Job table schema vs direct `reports` claim columns
- Poll interval and backoff constants
- Optional debug-only internal HTTP replay route

## Deferred Ideas

- TRIAGE-08 eval suite — Phase 10
- Self-help vs government routing — Phase 9
- Cloud Tasks / Cloud Run patterns — superseded by Phase 7
