# Roadmap: CityMind AI — Milestone v2

## Overview

Upgrade the shipped CityMind MVP into a production-ready, self-hosted platform across ten phases. Supabase is the operational store; citizens gain token-based status tracking; officers get a polished shadcn dashboard; and Phase 7 consolidates the application into a laptop-hosted Next.js/Node.js runtime using provider-neutral AI, Postgres analytics, and Supabase Storage without Google Cloud, FastAPI, Python, or Docker.

## Milestones

- ✅ **v1.0 MVP** — Shipped (Cloud Run, Gemini, BigQuery ops, shared-password auth)
- 🚧 **v2.0 Platform** — Phases 1–10 (this roadmap)

## Phases

- [ ] **Phase 1: Supabase Foundation** — Postgres schema, RLS, API migration, UI scaffolds
- [ ] **Phase 2: Public Experience** — Bilingual landing, report form, access tokens, Supabase Auth login (verification human_needed 2026-07-20 — D-03 closed; live UAT pending)
- [x] **Phase 3: Dashboard Polish** — Table, filters, pagination, export, resolve workflow
 (completed 2026-07-20)

- [ ] **Phase 4: Citizen Status** — Token-based public status lookup (plans 3/3 done; verification human_needed 2026-07-20 — live UAT pending)
- [x] **Phase 5: Analytics Pipeline** — Supabase → BigQuery ETL and dashboard analytics
 (completed 2026-07-20)
- [ ] **Phase 6: Maps & Geospatial** — PostGIS, MapLibre incident map, geo filters
- [ ] **Phase 7: Next.js-Only Google-Free Platform** — Consolidate CityMind into Next.js/Node.js using a third-party API key and self-hosted Supabase; remove FastAPI, Python, Docker, and Google Cloud while retaining Google Fonts
- [x] **Phase 8: Async Triage Platform Refactor** — Persist-first intake, self-hosted async triage, audit, officer/citizen contracts (completed 2026-07-22)
- [x] **Phase 9: Self-help vs Government Routing** — Route citizens to self-help or government queue (completed 2026-07-22)
- [ ] **Phase 10: Shadow Rollout & Production Evaluation** — Shadow mode, eval gate, feature-flag production cutover

## Phase Details

### Phase 1: Supabase Foundation

**Goal**: Move operational persistence to Supabase; establish auth, RLS, and parallel UI scaffolds.
**Mode:** mvp
**Depends on**: Nothing (first phase of v2)
**Requirements**: DATA-01, DATA-02, AUTH-01, AUTH-02, AUTH-03, PUB-05, DASH-01
**Parallel tracks**: A (Backend) ∥ B (Landing scaffold) ∥ C (Dashboard scaffold) — sync on schema + API contract Day 1

**Success Criteria** (what must be TRUE):

1. Reports CRUD through FastAPI reads/writes Supabase Postgres (BigQuery not used for ops)
2. Officer can log in via Supabase Auth and RLS blocks unauthorized access
3. shadcn/ui installed; landing and dashboard shells render with placeholder data
4. Demo data migrated from BigQuery to Supabase

**Plans**: 6 plans (three vertical tracks split at executable scope boundaries)

Plans:

- [x] 01-01: **Track A1** — Supabase schema/RLS, FastAPI cutover, JWT boundary, storage, blocking schema push
- [x] 01-02: **Track A2** — BigQuery demo-data migration, Supabase seed adaptation, reconciliation
- [x] 01-03: **Track B1** — Audited shadcn dependency install, generated core primitives, civic theme
- [x] 01-04: **Track B2** — Public Home shell, next-intl EN/VI scaffold, locale interaction
- [x] 01-05: **Track C1** — Supabase SSR auth, login/logout, bearer-token BFF bridge
- [x] 01-06: **Track C2** — Protected responsive dashboard shell, sidebar navigation, detail routing

---

### Phase 2: Public Experience

**Goal**: Polished bilingual public site; citizens submit reports and receive access tokens.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-03, DATA-08, DATA-09, DATA-10, PUB-01, PUB-02, PUB-03, PUB-04, PUB-06, AUTH-04
**Parallel tracks**: A ∥ B ∥ C

**Success Criteria**:

1. Citizen submits report on bilingual Report page and receives report_id + access token
2. Home page shows hero, sections, and footer in EN and VI
3. Officer logs in via Supabase Auth; dashboard routes protected by proxy.ts (`getClaims`, returnUrl)
4. API returns generic errors; rate limit and image validation work behind proxy

**Plans**: 5/5 plans complete

Plans:

- [x] 02-01-PLAN.md — **Track A** — Access tokens (hash-at-rest), XFF rate limit + BFF forward, magic bytes, generic errors
- [x] 02-02-PLAN.md — **Track B i18n** — Always-prefix EN/VI Home, message catalogs, locale proxy seam
- [x] 02-03-PLAN.md — **Track C auth** — Supabase Auth, proxy.ts `/dashboard` gate + returnUrl
- [x] 02-04-PLAN.md — **Track B form** — RHF+Zod ReportForm, success flash (soft A→B access_token)
- [x] 02-05-PLAN.md — **Track C dashboard** — Report cards, Bearer officerFetch, detail under `/dashboard/reports`

---

### Phase 3: Dashboard Polish

**Goal:** As an officer, I want to filter, paginate, export, and resolve reports with audited notes, so that I can operate the queue with evidence and accountability.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DATA-04, DATA-05, DATA-06, DATA-07, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Parallel tracks**: A → B → (C ∥ export); B/C/export consume A API; C and export after B table chrome; export does not block C

**Success Criteria**:

1. Officer filters, sorts, and paginates reports in a data table
2. Officer exports filtered reports to Excel/CSV
3. Officer resolves/rejects reports with required note; actor recorded in status history
4. Detail page shows full AI analysis, evidence, and status timeline

**Plans**: 5 plans

Plans:

- [x] 03-01-PLAN.md — **Track A** — Schema push, cursor list, filtered summary, streaming export, actor_id + note gate
- [x] 03-02-PLAN.md — **Track B** — TanStack table, filters, metrics, URL sync (not Home polish)
- [x] 03-03-PLAN.md — **Track C** — Detail section order, advisory AI, Dialog resolve/reject with required note
- [x] 03-04-PLAN.md — **Track B export** — Export button, BFF stream proxy, sidebar `?focus=export` (depends on 03-01 + 03-02; ∥ 03-03)
- [x] 03-05-PLAN.md — **Gap closure** — List + detail `loading.tsx` Skeleton states (DASH-07 / D-22)

---

### Phase 4: Citizen Status

**Goal**: As a citizen, I want to look up my report with a report ID and access token, so that I can see current status and history without creating an account.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CIT-01, CIT-02, CIT-03, CIT-04, DASH-08
**Parallel tracks**: A → B → C (sequential waves; B depends on A API; C depends on B catalogs)

**Success Criteria**:

1. Citizen enters report_id + token on `/status` and sees current status and history
2. Invalid token does not reveal whether report exists
3. Officer can copy shareable status link from detail page

**Plans**: 3/3 plans complete

Plans:

- [x] 04-01-PLAN.md — **Track A** — POST status API + hash verify + uniform 401 + separate rate limiter + tests
- [x] 04-02-PLAN.md — **Track B** — Next BFF + `/[locale]/status` page (form, auto-fetch, EN/VI) + success locale URL fix
- [x] 04-03-PLAN.md — **Track C** — Officer Copy status link (reportId-only) + recovery hint on detail

---

### Phase 5: Analytics Pipeline

**Goal**: BigQuery as analytics warehouse; dashboard shows trends and SLA metrics.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ANLY-01, ANLY-02, ANLY-03
**Parallel tracks**: A1 → A2 → C → B (warehouse ETL first; officer API seam; C officer UI; B optional public strip after message-file wave)

**Success Criteria**:

1. Scheduled ETL syncs Supabase data to BigQuery
2. Analytics views compute category trends and time-to-resolution
3. Dashboard analytics tab shows charts with date range filter

**Plans**: 4 plans

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — **Track A1** — Wave 0 stubs, analytics DDL/views, daily ETL job (ANLY-01/02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-04-PLAN.md — **Track A2** — Officer GET /api/v1/analytics API seam (ANLY-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-03-PLAN.md — **Track C** — recharts SUS checkpoint, Analytics tab charts + URL date selector

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-02-PLAN.md — **Track B** — Optional public Home stats strip (k≥3, rate-limited)

---

### Phase 6: Maps & Geospatial

**Goal**: Spatial intelligence for officers via incident map.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: MAP-01, MAP-02, MAP-03
**Parallel tracks**: A ∥ B ∥ C

**Success Criteria**:

1. PostGIS queries return clustered incidents for map viewport
2. Dashboard map view toggles with table; click marker opens detail
3. Radius/bbox filter works from map draw or filter panel

**Plans**: 3 plans

Plans:

**Wave 1**

- [ ] 06-01: **Track A** — PostGIS setup, geo API (bbox, radius, cluster)
- [ ] 06-02: **Track B** — Optional pin-drop mini map on report form

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 06-03: **Track C** — MapLibre GL full map view with clustering and filters

---

### Phase 7: Next.js-Only Google-Free Platform

**Goal**: Consolidate CityMind into a Next.js-only Node.js/TypeScript application that connects to the existing self-hosted Supabase instance, uses provider-neutral AI authenticated by a third-party API key, replaces BigQuery and GCS, and removes FastAPI, the Python backend, Docker, and Google Cloud services while retaining Google Fonts.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: SELFHOST-01, SELFHOST-02, SELFHOST-03, SELFHOST-04, SELFHOST-05, SELFHOST-06
**Parallel tracks**: A (Next.js backend convergence) → B (AI provider cutover) ∥ C (data and evidence migration); D (direct laptop operations) → E (Google exit audit)

**Success Criteria**:

1. All application APIs, report analysis, validation, persistence, evidence handling, and officer operations run in Next.js/Node.js/TypeScript; FastAPI and the Python backend are removed
2. Report analysis uses a configurable OpenAI-compatible endpoint, model, and third-party API key while preserving structured multimodal output, provider/model lineage, advisory-only decisions, and human review; Vertex AI and Gemini are absent
3. Operational and analytics queries run entirely on the existing self-hosted Supabase Postgres instance; BigQuery ETL, views, jobs, and dependencies are removed without losing retained report or analytics data
4. Evidence is stored and served only through Supabase Storage; retained `gs://` evidence is migrated and verified before GCS compatibility is deleted
5. CityMind runs directly on the laptop as a Node.js application with local environment configuration, startup, health, and backup procedures; Docker and all Google Cloud runtime/deployment services are absent, with Google Fonts as the sole Google exception

**Plans**: 15 plans

Plans:

- [ ] 07-01-PLAN.md — Approve Windows schema tooling, verify Vitest, and capture sanitized FastAPI golden contracts
- [ ] 07-02-PLAN.md — Provider-neutral structured multimodal AI adapter and live capability gate
- [ ] 07-03-PLAN.md — Next.js-only citizen status slice with token privacy
- [ ] 07-04-PLAN.md — Atomic citizen submission and private Supabase evidence slice
- [ ] 07-05-PLAN.md — Officer queue/detail/geo reads and dashboard direct-module convergence
- [ ] 07-06-PLAN.md — Atomic officer status updates and formula-safe exports
- [ ] 07-07-PLAN.md — Postgres-backed officer analytics and privacy-safe public stats
- [ ] 07-08-PLAN.md — Additive evidence path, read-only Google inventory, migration, and reconciliation
- [ ] 07-09-PLAN.md — Isolated database/Storage restore and preserved-application rollback proof
- [ ] 07-10-PLAN.md — Loopback laptop runtime, health, startup/restart, backup, and restore
- [ ] 07-11-PLAN.md — Fail-closed Google-exit audit, non-destructive manifest, and cleanup approval
- [ ] 07-12-PLAN.md — Approval-gated destructive legacy evidence schema removal
- [ ] 07-13-PLAN.md — Approved Python, Google Cloud, and CityMind deployment cleanup
- [ ] 07-14-PLAN.md — Frontend compatibility cleanup and complete Node runtime regression
- [ ] 07-15-PLAN.md — Active documentation refresh and final live SQL/restore/end-to-end audit

---

### Phase 8: Async Triage Platform Refactor

**Goal**: Persist citizen reports before AI triage; AI failure never blocks intake or citizen access; officers see all reports immediately with triage status.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: TRIAGE-01, TRIAGE-02, TRIAGE-03, TRIAGE-04, TRIAGE-05, TRIAGE-06, TRIAGE-07 (TRIAGE-08 → Phase 10)
**Parallel tracks**: A (intake/API) → B (triage module) → C (self-hosted runner) ∥ D (audit); E (UI) after B+C contract stable

**Success Criteria**:

1. `POST /reports` persists report and returns `report_id` + `access_token` before triage completes
2. Triage runs asynchronously through a self-hosted local worker or background runner with idempotent claim and reconciliation
3. Semantic validation can route invalid AI output to `manual_review`
4. `triage_runs` / `triage_attempts` audit tables capture actual provider/model lineage, model output, and disposition
5. Citizen status page shows service-progress wording; officers see pending/failed rows in the default queue

**Plans**: 5 plans

Plans:

**Wave 1 — Intake split**

- [x] 08-01-PLAN.md — **Track A** — Schema + claim RPCs, `POST /api/public/reports` intake, `ReportSubmissionResponse`, `/analyze` → 410 Gone, blocking schema push + SQL contract

**Wave 2 — Triage core**

- [x] 08-02-PLAN.md — **Track B** — `src/server/triage/` module, schema-only provider path, MVP policy validation (D-21), validation retry → `manual_review`

**Wave 3 — Worker, audit, UX**

- [x] 08-03-PLAN.md — **Track C** — `pg` worker poll loop, claim/reclaim, `npm run triage:worker`, Task Scheduler registration (depends 08-01 + 08-02)
- [x] 08-04-PLAN.md — **Track D** — `triage_runs` / `triage_attempts` migration, `complete_triage_report` RPC, audit writer wired into service
- [x] 08-05-PLAN.md — **Track E** — Citizen 4-step status UX, officer triage badges/sort/filter, detail section reorder (D-13–D-20)

**Context**: `.planning/notes/async-triage-architecture.md` must be reconciled with the Phase 7 self-hosted architecture during discussion/planning.

---

### Phase 9: Self-help vs Government Routing

**Goal**: Route citizen submissions to self-help guidance or the government officer queue based on triage and policy rules.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: ROUT-01, ROUT-02, ROUT-03, ROUT-04, ROUT-05, ROUT-06, ROUT-07, ROUT-08
**Plans**: 4 plans

Plans:

**Wave 1 — Schema + policy**

- [x] 09-01-PLAN.md — **Track A** — Routing columns migration, SQL contract, evaluateRoutingPolicy + unit tests, graffiti category (D-01..D-04, D-17..D-24)

**Wave 2 — Worker + citizen API** *(depends on 09-01)*

- [x] 09-02-PLAN.md — **Track B** — applyRoutingForReport worker hook on terminal triage (D-01, D-02, D-20, D-21..D-24)
- [x] 09-03-PLAN.md — **Track C** — Static playbooks, citizen status projection, POST /escalate API (D-04..D-12)

**Wave 3 — Officer + status UX** *(depends on 09-02 + 09-03)*

- [x] 09-04-PLAN.md — **Track D** — Government-default filter, destination badge, officer override, status page playbook UI (D-03, D-08..D-16)

---

### Phase 10: Shadow Rollout & Production Evaluation

**Goal**: Shadow-deploy the new provider-neutral triage pipeline, evaluate it against the baseline, and gate production cutover on under-triage, grounding, EN/VI parity, failure rate, and model-lineage reproducibility.
**Mode:** mvp
**Depends on**: Phase 9
**Requirements**: TRIAGE-08 (eval gate)
**Plans**: 2 plans

Plans:

**Wave 1 — Eval foundation**

- [x] 10-01-PLAN.md — **Eval suite** — `evals/` expert-labelled EN/VI dataset, metrics runner, mock/live CLI, verify-eval-gate, outage + injection tests

**Wave 2** *(depends on 10-01)*

- [ ] 10-02-PLAN.md — **Shadow rollout** — `TRIAGE_SHADOW_MODE` dual-run, `triage_shadow_comparisons` storage, officer disagreement UX, eval-gated cutover

**Context**: Do not migrate models blindly; every permitted model/provider route must beat the baseline on agreed metrics and remain auditable.

---

## Progress

**Execution Order:** Phases 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 (tracks within each phase run in parallel)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Supabase Foundation | v2.0 | 0/6 | Not started | - |
| 2. Public Experience | v2.0 | 5/5 | Complete   | 2026-07-20 |
| 3. Dashboard Polish | v2.0 | 4/4 | Complete   | 2026-07-20 |
| 4. Citizen Status | v2.0 | 3/3 | UAT pending | - |
| 5. Analytics Pipeline | v2.0 | 4/4 | Complete   | 2026-07-20 |
| 6. Maps & Geospatial | v2.0 | 0/3 | Not started | - |
| 7. Google-Free Self-Hosted Platform | v2.0 | 0/15 | Not started | - |
| 8. Async Triage Platform Refactor | v2.0 | 5/5 | Complete   | 2026-07-22 |
| 9. Self-help vs Government Routing | v2.0 | 4/4 | Complete   | 2026-07-22 |
| 10. Shadow Rollout & Production Evaluation | v2.0 | 1/2 | In Progress|  |

---
*Roadmap created: 2026-07-20*
*Phases 7–9 added: 2026-07-21 (async triage explore)*
*Phase 7 inserted for Google-service removal; former Phases 7–9 shifted to 8–10: 2026-07-21*
