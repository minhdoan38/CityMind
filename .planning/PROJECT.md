# CityMind AI

## What This Is

CityMind AI is an AI-assisted Decision Intelligence Platform for smart communities. Citizens submit urban incident reports (text, location, optional evidence); Vertex AI Gemini produces structured, advisory triage output; officers review, filter, and update status on a protected dashboard.

**Milestone v2 (this planning cycle):** Upgrade the shipped MVP into a production-ready platform with Supabase Postgres as the operational store, Supabase Auth for officers, shadcn/ui polish, bilingual EN/VI public landing, citizen status tracking via access tokens, and BigQuery retained for analytics only.

## Core Value

Citizens can report community issues and officers can review AI-structured, prioritized, auditable reports to make faster evidence-based decisions — with AI as advisory only, never autonomous final authority.

## Requirements

### Validated

- ✓ Citizen report submission (text, geolocation, optional JPEG/PNG/WebP image) — MVP shipped
- ✓ Gemini structured JSON analysis (category, severity, confidence, priority, evidence, uncertainty, recommendation) — MVP shipped
- ✓ BigQuery persistence for reports and append-only status history — MVP shipped
- ✓ Private GCS evidence storage and officer-proxied image serving — MVP shipped
- ✓ Officer dashboard with filters (status, category, priority, severity) — MVP shipped
- ✓ Report detail view with AI analysis, urban context display, status actions — MVP shipped
- ✓ Status updates (new/reviewing/resolved/rejected) with append-only history — MVP shipped
- ✓ FastAPI backend + Next.js frontend on Cloud Run — MVP shipped
- ✓ Backend pytest suite for API and services — MVP shipped

### Active

- [ ] Supabase Postgres replaces BigQuery as operational store (reports, status events, tokens)
- [ ] Supabase Auth + RLS for officer/admin roles (replace shared-password MVP auth)
- [ ] shadcn/ui + Tailwind design system across public and dashboard surfaces
- [ ] React Hook Form + Zod on report form with bilingual EN/VI (next-intl)
- [ ] Polished Home page (hero, how-it-works, about/contact/instructions sections, footer) + dedicated Report page
- [ ] Access token issued on submit; citizen status lookup without account
- [ ] Dashboard: sidebar menu, data table, advanced filters, pagination, Excel export
- [ ] Dashboard detail page polish + resolve workflow with required notes and actor tracking
- [ ] BigQuery analytics pipeline (Supabase → BigQuery ETL) for trends, SLA, hotspots
- [ ] MapLibre GL + PostGIS incident map (deferred to Phase 6)

### Out of Scope

- Prediction / forecasting models — not validated; explicitly excluded from product positioning
- Firebase Auth — using Supabase Auth instead
- Citizen Supabase accounts — anonymous submit + access token only for this milestone
- Separate About/Contact/Instruction pages — sections on Home first
- Email/SMS notifications — future milestone
- Full image redaction pipeline — future milestone
- Vietnamese-only or English-only — bilingual EN/VI required from start

## Context

**Brownfield baseline:** Next.js 16 + FastAPI + Gemini + BigQuery + GCS MVP deployed on Cloud Run (`citymind-ai-500910`). Codebase map at `.planning/codebase/`. Detailed product doc in `idea.md`.

**Target stack (v2):**

| Layer | Tool | Purpose |
|-------|------|---------|
| Web | Next.js 16 | UI, SSR, Server Components, BFF |
| UI | Tailwind + shadcn/ui | Dashboard and landing implementation |
| Forms | React Hook Form + Zod | Validation, multipart report form |
| Operational DB | Supabase Postgres | Reports, users, status, tokens |
| Auth | Supabase Auth + RLS | Officer/admin roles |
| Maps | MapLibre GL + PostGIS | Incident map, radius search, clustering (Phase 6) |
| AI backend | FastAPI + Pydantic | Gemini and structured AI pipeline |
| Analytics | BigQuery | Trends, SLA, hotspots, historical analysis |

**Parallel execution model:** Each phase splits into three tracks that can run simultaneously after Phase 1 schema/API contract sync:
- **Track A — Backend/API:** FastAPI, Supabase, migrations, endpoints
- **Track B — Landing/Public UI:** Home, report form, citizen flows
- **Track C — Dashboard/Officer UI:** App shell, table, detail, officer actions

## Constraints

- **Tech stack:** Keep FastAPI for AI pipeline; Supabase for ops/auth; BigQuery analytics-only post-migration
- **Security:** AI output is advisory; officers remain decision authority; access tokens must be hashed at rest
- **Privacy:** Citizen status lookup is token-scoped; no cross-report data leakage
- **Compatibility:** Maintain Cloud Run deployment path; existing demo/seed data must migrate
- **Locale:** Bilingual EN/VI from Phase 2 onward
- **Performance:** Synchronous analyze path acceptable for MVP; maps deferred to avoid blocking core migration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Postgres as primary operational DB | Better fit than BigQuery for CRUD, RLS, auth integration | — Pending |
| BigQuery retained for analytics only | Historical trends/SLA without ops-store limitations | — Pending |
| Anonymous citizen access via report_id + access token | Lower friction than citizen accounts; matches user preference | — Pending |
| Maps deferred to Phase 6 | Landing + dashboard + Supabase migration take priority | — Pending |
| Home sections for About/Contact/Instructions (not separate pages) | Faster delivery; full pages later if needed | — Pending |
| Bilingual EN/VI from start | Primary audience includes Vietnamese communities | — Pending |
| Parallel A/B/C tracks per phase | User wants dashboard, backend, landing simultaneously | — Pending |
| shadcn/ui + React Hook Form + Zod | User-specified stack for UI and forms | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-20 after milestone v2 initialization*
