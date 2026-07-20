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
- [ ] **DASH-02**: Reports data table with sort, pagination, column visibility
- [ ] **DASH-03**: Advanced filters: status, category, priority, severity range, date range
- [ ] **DASH-04**: Report detail page shows evidence, AI analysis, urban context, history
- [ ] **DASH-05**: Resolve workflow: reviewing → resolved/rejected with required note
- [ ] **DASH-06**: Excel export button applies current filters
- [ ] **DASH-07**: Loading, empty, and error states on all dashboard views
- [x] **DASH-08**: Officer can copy citizen status link from detail page

### Analytics (ANLY)

- [ ] **ANLY-01**: Supabase → BigQuery ETL job syncs report/status data
- [ ] **ANLY-02**: BigQuery views for category trends, SLA/time-to-resolution, hotspots
- [ ] **ANLY-03**: Dashboard analytics tab with date range selector

### Maps (MAP) — Phase 6

- [ ] **MAP-01**: PostGIS enabled; geo indexes on report coordinates
- [ ] **MAP-02**: MapLibre GL incident map on dashboard with clustering
- [ ] **MAP-03**: Radius/bbox geo filter API and map-integrated filter UI

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
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Pending |
| DASH-06 | Phase 3 | Pending |
| DASH-07 | Phase 3 | Pending |
| CIT-01 | Phase 4 | Complete |
| CIT-02 | Phase 4 | Complete |
| CIT-03 | Phase 4 | Complete |
| CIT-04 | Phase 4 | Complete |
| DASH-08 | Phase 4 | Complete |
| ANLY-01 | Phase 5 | Pending |
| ANLY-02 | Phase 5 | Pending |
| ANLY-03 | Phase 5 | Pending |
| MAP-01 | Phase 6 | Pending |
| MAP-02 | Phase 6 | Pending |
| MAP-03 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-20*
*Last updated: 2026-07-20 after milestone v2 roadmap creation*
