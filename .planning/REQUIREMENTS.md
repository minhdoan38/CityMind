# Requirements: CityMind AI — Milestone v2

**Defined:** 2026-07-20
**Core Value:** Citizens report issues; officers review AI-structured, prioritized, auditable reports to decide faster — AI advisory only.

## v1 Requirements (Milestone v2)

### Data & Backend (DATA)

- [ ] **DATA-01**: Reports and status events persist in Supabase Postgres (not BigQuery for ops CRUD)
- [ ] **DATA-02**: Existing BigQuery demo data migrates to Supabase without loss
- [x] **DATA-03**: Access tokens stored hashed; plaintext token shown once on submit only
- [ ] **DATA-04**: Cursor pagination on report list API (`cursor` + `limit`)
- [ ] **DATA-05**: Summary metrics respect active filters (not global-only)
- [ ] **DATA-06**: Excel/CSV export endpoint streams filtered report data
- [ ] **DATA-07**: Status updates record actor_id from authenticated officer JWT
- [x] **DATA-08**: Rate limiting uses client IP behind proxy (`X-Forwarded-For`)
- [x] **DATA-09**: Image upload validates magic bytes, not only Content-Type
- [x] **DATA-10**: API errors return generic messages; exceptions logged server-side

### Authentication (AUTH)

- [ ] **AUTH-01**: Officers authenticate via Supabase Auth (replace shared-password MVP)
- [ ] **AUTH-02**: RLS policies enforce officer/admin read and update on reports
- [ ] **AUTH-03**: Public analyze endpoint remains unauthenticated; officer endpoints require auth
- [x] **AUTH-04**: Next.js `proxy.ts` protects dashboard routes (`/dashboard` and `/dashboard/reports/*`); unauthenticated users redirect to `/login` with `returnUrl` (public `/` is not gated)

### Public / Landing (PUB)

- [x] **PUB-01**: Home page with hero, how-it-works, about/contact/instructions sections, footer
- [x] **PUB-02**: Bilingual EN/VI via next-intl with locale switcher
- [x] **PUB-03**: Report form uses React Hook Form + Zod validation
- [x] **PUB-04**: Submit success shows report_id + access token + copyable status link
- [ ] **PUB-05**: shadcn/ui component library installed and themed consistently
- [x] **PUB-06**: Public pages are mobile-responsive and accessible (focus states, aria)

### Citizen Status (CIT)

- [x] **CIT-01**: Public `/status` page accepts report_id + access token
- [x] **CIT-02**: Token-validated API returns status, summary, and status history only
- [x] **CIT-03**: Invalid token returns 401 without leaking report existence
- [x] **CIT-04**: Status lookup endpoint is rate-limited

### Dashboard (DASH)

- [ ] **DASH-01**: App shell with sidebar navigation (Reports, Export, Settings, Logout)
- [x] **DASH-02**: Reports data table with sort, pagination, column visibility
- [x] **DASH-03**: Advanced filters: status, category, priority, severity range, date range
- [x] **DASH-04**: Report detail page shows evidence, AI analysis, urban context, history
- [x] **DASH-05**: Resolve workflow: reviewing → resolved/rejected with required note
- [x] **DASH-06**: Excel export button applies current filters
- [x] **DASH-07**: Loading, empty, and error states on all dashboard views
- [x] **DASH-08**: Officer can copy citizen status link from detail page

### Analytics (ANLY)

- [x] **ANLY-01**: Supabase → BigQuery ETL job syncs report/status data
- [x] **ANLY-02**: BigQuery views for category trends, SLA/time-to-resolution, hotspots
- [x] **ANLY-03**: Dashboard analytics tab with date range selector

### Maps (MAP) — Phase 6

- [ ] **MAP-01**: PostGIS enabled; geo indexes on report coordinates
- [ ] **MAP-02**: MapLibre GL incident map on dashboard with clustering
- [ ] **MAP-03**: Radius/bbox geo filter API and map-integrated filter UI

### Self-Hosted Platform (SELFHOST) — Phase 7

- [ ] **SELFHOST-01**: All FastAPI routes and Python backend services are ported to Next.js/Node.js/TypeScript, with existing API behavior and security boundaries preserved
- [ ] **SELFHOST-02**: AI analysis uses a configurable OpenAI-compatible endpoint, model, and third-party API key; Gemini, Vertex AI, Google credentials, and Google AI SDKs are removed
- [ ] **SELFHOST-03**: Operational and analytics workloads use the existing self-hosted Supabase Postgres instance; retained BigQuery data is migrated and BigQuery ETL/views/jobs are removed
- [ ] **SELFHOST-04**: Evidence uses Supabase Storage only; retained `gs://` objects are migrated and verified before GCS support is removed
- [ ] **SELFHOST-05**: CityMind runs directly on the laptop as a Node.js application with documented local configuration, startup/restart, health checks, and backups; Docker is removed
- [ ] **SELFHOST-06**: Cloud Run, Cloud Build, Artifact Registry, Secret Manager, IAM, Cloud Scheduler, Cloud Run Jobs, Google packages/configuration/credentials/scripts/tests/docs are removed; Google Fonts are the sole exception

### Async Triage (TRIAGE) — Phases 8 & 10

- [x] **TRIAGE-01**: `POST /reports` persists report before triage; returns `report_id` + `access_token` immediately (`ReportSubmissionResponse`)
- [x] **TRIAGE-02**: `triage_status` lifecycle (`pending` → `processing` → `completed` \| `failed` \| `manual_review`); AI failure never blocks intake
- [x] **TRIAGE-03**: Citizen status shows service-progress wording; hides AI fields until `completed`; calm message on `failed` (no provider errors)
- [x] **TRIAGE-04**: Officers see all reports in default queue immediately; `failed`/`manual_review` elevated; filter by `triage_status`; NULL AI fields never backfilled
- [x] **TRIAGE-05**: The Next.js/Node.js runtime uses a self-hosted background worker with durable retries and an authenticated internal triage handler; intake never depends on an in-request background task
- [x] **TRIAGE-06**: `triage_runs` and `triage_attempts` audit tables (model, prompt/config version, raw output, latency, validation, disposition)
- [x] **TRIAGE-07**: Semantic policy validation (severity/priority/evidence rules); invalid output → `manual_review`
- [x] **TRIAGE-08**: Eval suite + shadow rollout gate before production model/config swap (under-triage, grounding, EN/VI parity, failure rate)

### Triage Spec Conformance (TRIAGE) — Phase 11

- [ ] **TRIAGE-09**: Runtime triage persists **11-key evaluator schema** from `prompt/citymind_ai_triage_structured_output_evaluator.json` (not legacy `summary`/`recommendation`/`estimated_impact`/`evidence`/`uncertainty` at persistence boundary)
- [ ] **TRIAGE-10**: System prompt and Zod enums match evaluator **10 categories**; no prompt/schema drift (e.g. `graffiti`, `traffic_signal`, `utility_hazard`, `structural_damage`)
- [ ] **TRIAGE-11**: Policy validation enforces evaluator assertions including **`critical` requires `severity == 5`** and reason-field traceability to `observed_facts`
- [ ] **TRIAGE-12**: Push triage dispatch via authenticated **`POST /internal/triage/{report_id}`** on intake (self-hosted equivalent of Cloud Tasks + OIDC); poll worker not the default production path
- [ ] **TRIAGE-13**: Verified UX contracts — citizen `failed` calm copy (no provider leakage); officer default queue elevates `failed`/`manual_review`; `triage_bucket` sort covered by automated tests
- [ ] **TRIAGE-14**: Eval suite and shadow compare operate on **11-key** snapshots; `/analyze` compatibility documented (410 permanent) or behind feature-flag shim with sunset

### Guided Self-Help Coach (SHELP) — Phase 11

- [ ] **SHELP-01**: Success page branches after triage — **self_help** opens coach AI chat; **government** shows queue messaging (no coach-first for hard cases)
- [ ] **SHELP-02**: Token-scoped **coach chat API** (`report_id` + access token); messages grounded in report + category playbook; advisory only
- [ ] **SHELP-03**: Coach AI uses distinct conversational prompt/role from triage classifier; optional `AI_COACH_MODEL` / `AI_COACH_BASE_URL`
- [ ] **SHELP-04**: Escalate-to-government CTA always available in coach and status flows; escalated reports leave self-help path
- [ ] **SHELP-05**: Bilingual EN/VI coach UI, loading/error states, and triage-progress polling on success page

### Operations (OPS) — Phase 11

- [ ] **OPS-01**: `GET /api/health/ai` probes configured triage model readiness; returns status + latency + model id; consumed by dashboard and citizen UI

### Dashboard (DASH) — Phase 11

- [ ] **DASH-09**: Officer dashboard **AI status chip** from health ping; per-row **Run triage now** quick action for pending/failed/retry reports

### Dashboard (DASH) — Phase 12

- [x] **DASH-10**: Officer dashboard **advisory assistant widget** — conversational chat in insights rail; authenticated officer session; advisory-only disclaimer; bilingual EN/VI; disabled when `/api/health/ai` is `down`; server-persisted thread; optional report attach; automated tests + SQL contract
  - **DASH-10a**: `POST /api/officer/assistant/messages` — Zod validation, `requireOfficerContext`, per-officer rate limit, generic errors, 503 when AI down
  - **DASH-10b**: Distinct officer system prompt — workflow/triage field guidance; must not claim to resolve/reject or invent report facts
  - **DASH-10c**: Persist officer assistant thread in Postgres (`officer_assistant_messages`); server loads history; survives refresh
  - **DASH-10d**: Optional report context attach — when `report_id` provided, ground reply in officer-visible triage fields via `getOfficerReport` + evaluator projection
  - **DASH-10e**: Automated tests — service auth/health/validation/rate limit; prompt context unit test; SQL contract for officer message table RLS

### Routing (ROUT) — Phase 9

- [x] **ROUT-01**: Post-triage deterministic routing — evaluate destination only on terminal triage dispositions; policy rules on triage output; no separate AI routing call
- [x] **ROUT-02**: Government vs self-help policy criteria — severity/priority/confidence/category gates with semver `routing_policy_version` persisted on every decision
- [x] **ROUT-03**: Officer default queue includes unrouted reports — `routing_destination IS NULL` (pending/processing) treated as government-visible
- [x] **ROUT-04**: Static bilingual self-help playbooks — in-repo catalog; hide all AI triage fields on self-help citizen path
- [x] **ROUT-05**: Citizen status page self-help journey — adapted workflow steps; escalate CTA on status page; same access token after escalate
- [x] **ROUT-06**: Officer default government queue filter — optional self-help chip; preserve Phase 8 `triage_bucket` sort
- [x] **ROUT-07**: Officer destination badge and override — Self-help/Government badge; escalate to government and mark resolved on self-help reports
- [x] **ROUT-08**: Auditable re-routing — citizen escalate and officer override flip `routing_destination` with `routing_reason` audit trail

## v2 Requirements

Deferred beyond Milestone v2.

### Notifications

- **NOTF-01**: Email notification to citizen on status change
- **NOTF-02**: Officer alert on critical-priority new reports

### Localization

- **LOC-01**: Dedicated About, Contact, Instructions pages (separate routes)
- **LOC-02**: Localized category/status labels in database

### Advanced

- **ADV-01**: Duplicate incident detection
- **ADV-02**: Image redaction for privacy
- **ADV-03**: Citizen Supabase account linking (optional login)
- **ADV-04**: Prediction models (time-to-resolution, escalation risk)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Prediction / forecasting | Not validated; contradicts MVP positioning |
| Firebase Auth | Supabase Auth chosen for unified Postgres + RLS |
| Citizen accounts | Anonymous + token model for this milestone |
| Real-time WebSocket updates | Polling/refresh sufficient for MVP v2 |
| Mobile native app | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| PUB-05 | Phase 1 | Pending |
| DASH-01 | Phase 1 | Pending |
| DATA-03 | Phase 2 | Complete |
| DATA-08 | Phase 2 | Complete |
| DATA-09 | Phase 2 | Complete |
| DATA-10 | Phase 2 | Complete |
| PUB-01 | Phase 2 | Complete |
| PUB-02 | Phase 2 | Complete |
| PUB-03 | Phase 2 | Complete |
| PUB-04 | Phase 2 | Complete |
| PUB-06 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| DATA-04 | Phase 3 | Pending |
| DATA-05 | Phase 3 | Pending |
| DATA-06 | Phase 3 | Pending |
| DATA-07 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Complete |
| DASH-03 | Phase 3 | Complete |
| DASH-04 | Phase 3 | Complete |
| DASH-05 | Phase 3 | Complete |
| DASH-06 | Phase 3 | Complete |
| DASH-07 | Phase 3 | Complete |
| CIT-01 | Phase 4 | Complete |
| CIT-02 | Phase 4 | Complete |
| CIT-03 | Phase 4 | Complete |
| CIT-04 | Phase 4 | Complete |
| DASH-08 | Phase 4 | Complete |
| ANLY-01 | Phase 5 | Complete |
| ANLY-02 | Phase 5 | Complete |
| ANLY-03 | Phase 5 | Complete |
| MAP-01 | Phase 6 | Pending |
| MAP-02 | Phase 6 | Pending |
| MAP-03 | Phase 6 | Pending |
| SELFHOST-01 | Phase 7 | Pending |
| SELFHOST-02 | Phase 7 | Pending |
| SELFHOST-03 | Phase 7 | Pending |
| SELFHOST-04 | Phase 7 | Pending |
| SELFHOST-05 | Phase 7 | Pending |
| SELFHOST-06 | Phase 7 | Pending |
| TRIAGE-01 | Phase 8 | Complete |
| TRIAGE-02 | Phase 8 | Complete |
| TRIAGE-03 | Phase 8 | Complete |
| TRIAGE-04 | Phase 8 | Complete |
| TRIAGE-05 | Phase 8 | Complete |
| TRIAGE-06 | Phase 8 | Complete |
| TRIAGE-07 | Phase 8 | Complete |
| TRIAGE-08 | Phase 10 | Complete |
| TRIAGE-09 | Phase 11 | Pending |
| TRIAGE-10 | Phase 11 | Pending |
| TRIAGE-11 | Phase 11 | Pending |
| TRIAGE-12 | Phase 11 | Pending |
| TRIAGE-13 | Phase 11 | Pending |
| TRIAGE-14 | Phase 11 | Pending |
| SHELP-01 | Phase 11 | Pending |
| SHELP-02 | Phase 11 | Pending |
| SHELP-03 | Phase 11 | Pending |
| SHELP-04 | Phase 11 | Pending |
| SHELP-05 | Phase 11 | Pending |
| OPS-01 | Phase 11 | Pending |
| DASH-09 | Phase 11 | Pending |
| DASH-10 | Phase 12 | Complete |
| ROUT-01 | Phase 9 | Complete |
| ROUT-02 | Phase 9 | Complete |
| ROUT-03 | Phase 9 | Complete |
| ROUT-04 | Phase 9 | Complete |
| ROUT-05 | Phase 9 | Complete |
| ROUT-06 | Phase 9 | Complete |
| ROUT-07 | Phase 9 | Complete |
| ROUT-08 | Phase 9 | Complete |

**Coverage:**

- v1 requirements: 55 total
- Mapped to phases: 55
- SELFHOST requirements: 6 (Phase 7)
- TRIAGE requirements: 14 (Phases 8–11)
- SHELP requirements: 5 (Phase 11)
- OPS requirements: 1 (Phase 11)
- ROUT requirements: 8 (Phase 9)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-20*
*Last updated: 2026-07-21 — SELFHOST-01..06 added; TRIAGE requirements shifted to Phases 8 and 10*
