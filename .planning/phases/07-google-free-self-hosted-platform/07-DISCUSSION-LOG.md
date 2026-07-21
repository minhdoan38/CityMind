# Phase 7: Next.js-Only Google-Free Platform - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 7-nextjs-only-google-free-platform
**Areas discussed:** AI provider boundary, backend runtime, data and evidence cutover, laptop operations, Google exit boundary

---

## AI provider boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Named gateway | Name and depend on one gateway implementation | |
| Provider-neutral third-party API key | Configure an OpenAI-compatible endpoint, model, and key without naming a gateway | ✓ |

**User's choice:** Use “third-party API key” and do not mention the previously named gateway.
**Notes:** Provider/model switching must not require rewriting the report-processing workflow.

---

## Backend runtime

| Option | Description | Selected |
|--------|-------------|----------|
| Separate Node backend | Next.js UI plus an independent Node API/worker service | |
| Next.js only | Put UI, APIs, and AI orchestration in the Next.js/Node.js/TypeScript application | ✓ |
| Agent decides | Defer runtime topology to planning | |

**User's choice:** Next.js only.
**Notes:** Remove FastAPI and the Python backend rather than maintaining parallel services.

---

## Data and evidence cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Google compatibility | Retain BigQuery/GCS reads during normal operation | |
| Self-hosted Supabase only | Migrate retained data, then use Supabase Postgres and Storage exclusively | ✓ |

**User's choice:** Use the already self-hosted Supabase and remove the Google data services.
**Notes:** Retained data must be migrated and verified before compatibility code is deleted.

---

## Laptop operations

| Option | Description | Selected |
|--------|-------------|----------|
| Docker-hosted | Package CityMind as containers on the laptop | |
| Direct Node.js process | Run the Next.js application directly and remove Docker | ✓ |

**User's choice:** Remove Docker from Phase 7.
**Notes:** The existing self-hosted Supabase is treated as an available dependency; CityMind does not manage its infrastructure in this phase.

---

## Google exit boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime-only removal | Stop calls but retain packages, scripts, and compatibility code | |
| Strict Google exit | Remove runtime/deployment integrations and active repository dependencies, retaining Google Fonts only | ✓ |

**User's choice:** Remove all listed Google services except Google Fonts.
**Notes:** Includes Vertex AI/Gemini, BigQuery, GCS, Cloud Run, Cloud Build, Artifact Registry, Secret Manager, IAM, Cloud Scheduler, and Cloud Run Jobs.

## Agent's Discretion

- Node.js library choices and internal module organization.
- Local process manager, migration tooling, reconciliation format, and backup implementation.

## Deferred Ideas

- Durable asynchronous triage belongs to Phase 8.
- Routing policy belongs to Phase 9.
- Shadow rollout and production evaluation belong to Phase 10.
