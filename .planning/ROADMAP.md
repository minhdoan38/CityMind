# Roadmap: CityMind AI — Milestone v2

## Overview

Upgrade the shipped CityMind MVP into a production-ready platform across six phases. Each phase splits into three parallel tracks (Backend, Landing, Dashboard) so teams can work simultaneously after Phase 1 schema sync. Supabase becomes the operational store; BigQuery shifts to analytics; citizens gain token-based status tracking; officers get a polished shadcn dashboard.

## Milestones

- ✅ **v1.0 MVP** — Shipped (Cloud Run, Gemini, BigQuery ops, shared-password auth)
- 🚧 **v2.0 Platform** — Phases 1–6 (this roadmap)

## Phases

- [ ] **Phase 1: Supabase Foundation** — Postgres schema, RLS, API migration, UI scaffolds
- [ ] **Phase 2: Public Experience** — Bilingual landing, report form, access tokens, Supabase Auth login (verification human_needed 2026-07-20 — D-03 closed; live UAT pending)
- [x] **Phase 3: Dashboard Polish** — Table, filters, pagination, export, resolve workflow
 (completed 2026-07-20)
- [ ] **Phase 4: Citizen Status** — Token-based public status lookup (plans 3/3 done; verification human_needed 2026-07-20 — live UAT pending)
- [x] **Phase 5: Analytics Pipeline** — Supabase → BigQuery ETL and dashboard analytics (completed 2026-07-20)
- [ ] **Phase 6: Maps & Geospatial** — PostGIS, MapLibre incident map, geo filters

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
- [ ] 03-05-PLAN.md — **Gap closure** — List + detail `loading.tsx` Skeleton states (DASH-07 / D-22)

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

- [ ] 06-01: **Track A** — PostGIS setup, geo API (bbox, radius, cluster)
- [ ] 06-02: **Track B** — Optional pin-drop mini map on report form
- [ ] 06-03: **Track C** — MapLibre GL full map view with clustering and filters

---

## Progress

**Execution Order:** Phases 1 → 2 → 3 → 4 → 5 → 6 → 7 (tracks within each phase run in parallel)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Supabase Foundation | v2.0 | 0/6 | Not started | - |
| 2. Public Experience | v2.0 | 5/5 | Complete   | 2026-07-20 |
| 3. Dashboard Polish | v2.0 | 4/4 | Complete   | 2026-07-20 |
| 4. Citizen Status | v2.0 | 3/3 | UAT pending | - |
| 5. Analytics Pipeline | v2.0 | 4/4 | Complete   | 2026-07-20 |
| 6. Maps & Geospatial | v2.0 | 0/3 | Not started | - |
| 7. Self-help vs government AI triage | v2.0 | 0/0 | Not started | - |

### Phase 7: Self-help vs government AI triage

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 7 to break down)

---
*Roadmap created: 2026-07-20*
