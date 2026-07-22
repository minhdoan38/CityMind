# Phase 7 Multi-Source Coverage Audit

| Source | ID | Feature / constraint | Plan(s) | Status |
|---|---|---|---|---|
| GOAL | — | Exact confirmed operator MVP story: one laptop-hosted Next.js application with self-hosted Supabase, configurable third-party AI key, and no FastAPI/Python/Docker/Google Cloud except Google Fonts | 01–15 | COVERED |
| REQ | SELFHOST-01 | Port all API/services and preserve behavior/security in Next.js/TypeScript | 01, 03–06, 13–15 | COVERED |
| REQ | SELFHOST-02 | Configurable OpenAI-compatible endpoint/model/key; remove Gemini/Vertex/Google AI | 02, 04, 13–15 | COVERED |
| REQ | SELFHOST-03 | Postgres operational/analytics workloads; reconcile retained BigQuery data | 07–09, 13, 15 | COVERED |
| REQ | SELFHOST-04 | Supabase Storage-only evidence after verified GCS migration | 04, 08, 09, 12, 13, 15 | COVERED |
| REQ | SELFHOST-05 | Direct laptop Node runtime, health, startup/restart, backup/restore, no CityMind Docker | 09, 10, 13–15 | COVERED |
| REQ | SELFHOST-06 | Remove Google/runtime/deployment artifacts; Google Fonts only | 11–15 | COVERED |
| CONTEXT | D-01 | Next.js-only Node.js/TypeScript application | 03–05, 14, 15 | COVERED |
| CONTEXT | D-02 | Remove FastAPI/Python only after port and parity | 01, 13–15 | COVERED |
| CONTEXT | D-03 | Preserve API, security, bilingual, authority, privacy behavior | 01, 03–05 | COVERED |
| CONTEXT | D-04 | Generic “third-party API key” naming only | 02 | COVERED |
| CONTEXT | D-05 | Configurable OpenAI-compatible endpoint/model/key | 02 | COVERED |
| CONTEXT | D-06 | Structured multimodal validation, failures, lineage, advisory output | 02, 04 | COVERED |
| CONTEXT | D-07 | Remove Gemini/Vertex/Google AI assumptions | 02, 11, 13–15 | COVERED |
| CONTEXT | D-08 | Existing self-hosted Supabase only | 01, 03, 04, 06–10, 12 | COVERED |
| CONTEXT | D-09 | Replace BigQuery analytics with Postgres equivalents | 07 | COVERED |
| CONTEXT | D-10 | Verify retained BigQuery data before compatibility deletion | 08, 09, 11–13 | COVERED |
| CONTEXT | D-11 | Verify retained GCS objects before compatibility deletion | 04, 08, 09, 11–13 | COVERED |
| CONTEXT | D-12 | Direct laptop Node operation, no CityMind Docker target | 10, 13–15 | COVERED |
| CONTEXT | D-13 | Local configuration, startup/restart, health, backup/restore | 09, 10, 15 | COVERED |
| CONTEXT | D-14 | Do not own/introduce Supabase Docker orchestration | 01, 09, 10, 13–15 | COVERED |
| CONTEXT | D-15 | Remove all named Google Cloud runtime/deployment integrations | 11–15 | COVERED |
| CONTEXT | D-16 | Remove packages, credentials, env, scripts, tests, compatibility, active docs | 11, 13–15 | COVERED |
| CONTEXT | D-17 | Google Fonts is the sole exception | 11, 14, 15 | COVERED |
| CONTEXT | D-18 | Preserve historical provenance but remove active requirements | 11, 13–15 | COVERED |
| RESEARCH | — | Explicit officer user-scoped client + RLS; service role restricted and server-only | 03, 05 | COVERED |
| RESEARCH | — | Request-controlled SSRF prevention and provider error/key redaction | 02 | COVERED |
| RESEARCH | — | Uniform citizen token failure and cross-report privacy projection | 03 | COVERED |
| RESEARCH | — | Malicious/oversized upload defense and private evidence compensation | 04 | COVERED |
| RESEARCH | — | Atomic report/token and status/event RPCs with blocking schema pushes | 04, 06 | COVERED |
| RESEARCH | — | Export formula injection prevention | 06 | COVERED |
| RESEARCH | — | Postgres analytics parity and public k>=3 privacy | 07 | COVERED |
| RESEARCH | — | Read-only source inventory, canonical reconciliation, backup/restore/application rollback before deletion | 08, 09, 11, 12 | COVERED |
| RESEARCH | — | Evidence SQL contracts are lifecycle-specific: additive-stage contract before legacy removal, durable final contract after cutover | 08, 12, 15 | COVERED |
| RESEARCH | — | Loopback default; public exposure only behind approved TLS reverse proxy | 10, 15 | COVERED |
| RESEARCH | — | Manifest-aware source/dependency/build/runtime/schema audit | 11–15 | COVERED |
| RESEARCH | — | Native laptop Supabase CLI and native psql/pg_dump are mandatory through approved non-Docker Windows routes; no equivalent branch | 01, 04, 06–09, 12, 15 | COVERED |
| RESEARCH | — | Preserve Phase 7 synchronous seam; exclude Phase 8 worker/retry/durable triage scope | 02, 04 | COVERED |

## Exclusions

- Durable asynchronous triage/retries/worker lifecycle: explicitly deferred to Phase 8.
- Self-help versus government routing: explicitly deferred to Phase 9.
- Shadow rollout and production evaluation: explicitly deferred to Phase 10.
- Remote Google resource deletion: not authorized; Phase 7 inventories it and removes CityMind dependencies/configuration only.

No source item is missing from the plan set.
