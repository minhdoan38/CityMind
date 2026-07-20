# Roadmap: CityMind AI — Milestone v2

## Overview

Upgrade the shipped CityMind MVP into a production-ready platform across six phases. Each phase splits into three parallel tracks (Backend, Landing, Dashboard) so teams can work simultaneously after Phase 1 schema sync. Supabase becomes the operational store; BigQuery shifts to analytics; citizens gain token-based status tracking; officers get a polished shadcn dashboard.

## Milestones

- ✅ **v1.0 MVP** — Shipped (Cloud Run, Gemini, BigQuery ops, shared-password auth)
- 🚧 **v2.0 Platform** — Phases 1–6 (this roadmap)

## Phases

- [ ] **Phase 1: Supabase Foundation** — Postgres schema, RLS, API migration, UI scaffolds
- [ ] **Phase 2: Public Experience** — Bilingual landing, report form, access tokens, Supabase Auth login
- [ ] **Phase 3: Dashboard Polish** — Table, filters, pagination, export, resolve workflow
- [ ] **Phase 4: Citizen Status** — Token-based public status lookup
- [ ] **Phase 5: Analytics Pipeline** — Supabase → BigQuery ETL and dashboard analytics
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

**Plans**: 3/5 plans executed

Plans:

- [x] 02-01-PLAN.md — **Track A** — Access tokens (hash-at-rest), XFF rate limit + BFF forward, magic bytes, generic errors
- [x] 02-02-PLAN.md — **Track B i18n** — Always-prefix EN/VI Home, message catalogs, locale proxy seam
- [x] 02-03-PLAN.md — **Track C auth** — Supabase Auth, proxy.ts `/dashboard` gate + returnUrl
- [ ] 02-04-PLAN.md — **Track B form** — RHF+Zod ReportForm, success flash (soft A→B access_token)
- [ ] 02-05-PLAN.md — **Track C dashboard** — Report cards, Bearer officerFetch, detail under `/dashboard/reports`

---

### Phase 3: Dashboard Polish

**Goal**: Production-grade officer dashboard with table, filters, export, and resolve workflow.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DATA-04, DATA-05, DATA-06, DATA-07, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Parallel tracks**: A ∥ B ∥ C

**Success Criteria**:

1. Officer filters, sorts, and paginates reports in a data table
2. Officer exports filtered reports to Excel/CSV
3. Officer resolves/rejects reports with required note; actor recorded in status history
4. Detail page shows full AI analysis, evidence, and status timeline

**Plans**: 3 plans

Plans:

- [ ] 03-01: **Track A** — Cursor pagination, filtered summary, export endpoint, actor_id on status events
- [ ] 03-02: **Track B** — Home polish (SEO, a11y, trust badges), link to status lookup prep
- [ ] 03-03: **Track C** — Data table, advanced filters, detail page, resolve workflow, export button

---

### Phase 4: Citizen Status

**Goal**: Citizens track report status without an account.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: CIT-01, CIT-02, CIT-03, CIT-04, DASH-08
**Parallel tracks**: A ∥ B ∥ C

**Success Criteria**:

1. Citizen enters report_id + token on `/status` and sees current status and history
2. Invalid token does not reveal whether report exists
3. Officer can copy shareable status link from detail page

**Plans**: 3 plans

Plans:

- [ ] 04-01: **Track A** — Public status API with token validation and rate limiting
- [ ] 04-02: **Track B** — `/status` page (bilingual), shareable URL format
- [ ] 04-03: **Track C** — Copy status link action, audit log display on detail

---

### Phase 5: Analytics Pipeline

**Goal**: BigQuery as analytics warehouse; dashboard shows trends and SLA metrics.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ANLY-01, ANLY-02, ANLY-03
**Parallel tracks**: A ∥ B ∥ C

**Success Criteria**:

1. Scheduled ETL syncs Supabase data to BigQuery
2. Analytics views compute category trends and time-to-resolution
3. Dashboard analytics tab shows charts with date range filter

**Plans**: 3 plans

Plans:

- [ ] 05-01: **Track A** — ETL job, BigQuery views, analytics read API
- [ ] 05-02: **Track B** — Optional public stats section on Home (non-sensitive aggregates)
- [ ] 05-03: **Track C** — Analytics tab with trend charts and date selector

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
| 2. Public Experience | v2.0 | 3/5 | In Progress|  |
| 3. Dashboard Polish | v2.0 | 0/3 | Not started | - |
| 4. Citizen Status | v2.0 | 0/3 | Not started | - |
| 5. Analytics Pipeline | v2.0 | 0/3 | Not started | - |
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
