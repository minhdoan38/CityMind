---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Platform
status: verifying
stopped_at: Phase 8 — operator checkpoints (SUPABASE_DB_URL + schema push + triage smoke)
last_updated: "2026-07-22T07:20:00+07:00"
last_activity: 2026-07-22
progress:
  total_phases: 10
  completed_phases: 8
  total_plans: 46
  completed_plans: 46
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-20)

**Core value:** Citizens report issues; officers review AI-structured, prioritized, auditable reports — AI advisory only.
**Current focus:** Phase 08 — async-triage-platform-refactor

## Current Position

Phase: 08 (async-triage-platform-refactor) — VERIFYING
Plan: 5 of 5 complete (code); 3 checkpoints pending operator SUPABASE_DB_URL
Status: Code complete — schema push and smoke tests blocked
Last activity: 2026-07-22 — Phase 8 execution complete (checkpoints pending)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 8
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 02-public-experience P01 | 3min | 3 tasks | 11 files |
| Phase 02 P02 | 4min | 2 tasks | 15 files |
| Phase 02 P03 | 4min | 2 tasks | 7 files |
| Phase 02-public-experience P03 | 4min | 2 tasks | 7 files |
| Phase 02-public-experience P04 | 8min | 2 tasks | 11 files |
| Phase 02 P05 | 4 min | 2 tasks | 4 files |
| Phase 04 P01 | 3min | 3 tasks | 9 files |
| Phase 04 P02 | 5min | 3 tasks | 7 files |
| Phase 04 P03 | 15 min | 2 tasks | 6 files |
| Phase 03 P02 | 5min | 1 tasks | 15 files |
| Phase 03 P03 | 5min | 2 tasks | 6 files |
| Phase 03 P04 | 10min | 1 tasks | 10 files |
| Phase 05 P01 | 15min | 2 tasks | 14 files |
| Phase 05 P04 | 15min | 2 tasks | 7 files |
| Phase 05 P03 | 25min | 3 tasks | 18 files |
| Phase 05 P02 | 20min | 3 tasks | 14 files |

## Accumulated Context

### Roadmap Evolution

- Phase 10 added: Shadow Rollout & Production Evaluation
- Phase 7 edited: inserted Google-Free Self-Hosted Platform; Google Fonts retained
- Phase 8 edited: shifted Async Triage Platform Refactor from Phase 7 and removed Gemini/Cloud Tasks assumptions
- Phase 9 edited: shifted Self-help vs Government Routing from Phase 8
- Phase 10 edited: shifted Shadow Rollout & Production Evaluation from Phase 9
- Phase 7 edited: regenerated title, goal, requirements, success criteria, and plans for Next.js-only runtime; removed FastAPI, Python, Docker, and Google Cloud except Google Fonts

### Decisions

Recent decisions affecting current work:

- Milestone v2: Supabase Postgres primary; BigQuery analytics-only
- Parallel tracks A/B/C per phase for backend, landing, dashboard
- Citizen access: anonymous submit + access token (no accounts)
- Maps deferred to Phase 6
- Phase 2: `localePrefix: 'always'`; AUTH-04 gates `/dashboard` via `proxy.ts` (not public `/`)
- Phase 2 waves: 02-01 ∥ 02-02 (wave 1); 02-03 ∥ 02-04 (wave 2, both depend on 02-02); 02-05 depends on 02-03 (wave 3)
- Soft A→B: 02-04 success flash soft-consumes 02-01 `access_token` (phase-gate, not hard depends_on)
- RESEARCH Q1–Q3 RESOLVED: rightmost XFF + optional TRUSTED_PROXY_COUNT; /login+/dashboard outside [locale]; Phase 1 FE packages verified
- [Phase 02]: Issue-once access_token: SHA-256 at rest, plaintext once in AnalyzeResponse — DATA-03 / D-18; soft contract for Plan 02-04
- [Phase 02]: Rate limit on rightmost XFF hop; TRUSTED_PROXY_COUNT peels to hops[-N] — DATA-08 / RESEARCH Q1 RESOLVED
- [Phase 02]: Always-prefix Home + locale-only proxy seam shipped (02-02); dashboard getClaims deferred to 02-03 — D-13/D-14/D-17 and PUB-01/02/06
- [Phase 02]: Authorize officers via supabase.auth.getClaims + app_metadata.role; gate /dashboard in proxy.ts with returnUrl (AUTH-04/D-15/D-17) — Supabase SSR docs require getClaims for proxy authorization; D-17 path-corrects AUTH-04 away from public Home
- [Phase 02]: Login EN copy inline outside [locale] during Wave 2 — Avoid message catalog conflicts with parallel Plan 02-04
- [Phase 02]: Authorize via supabase.auth.getClaims + app_metadata.role (officer|admin) — Supabase SSR docs: getClaims validates JWT; getSession alone is not trusted for authz
- [Phase 02]: AUTH-04 protects /dashboard/:path* only — never public Home (D-17) — Path correction vs legacy REQUIREMENTS that mentioned root protection
- [Phase 02]: Login EN copy inline outside [locale] during Wave 2 — Avoid message-file conflicts with parallel Plan 02-04
- [Phase 02]: Exact RHF pins 7.82.0 / zod 4.4.3 / resolvers 5.4.0 after human checkpoint — SUS react-hook-form required blocking approval before install (T-02-SC)
- [Phase 02]: Success flash uses sessionStorage reportId/accessToken mapped from API snake_case — D-11/D-18 PUB-04 — never put token in query string; soft A→B from 02-01
- [Phase 02]: Inline EN dashboard copy outside [locale] — Avoid Wave 2 catalog conflicts with parallel 02-04
- [Phase 02]: Text Priority:/Status: badges on ReportCard — Meets D-16 badge text (not color-only) without depending on parallel badge.tsx
- [Phase 02]: Legacy /reports/[reportId] redirects into /dashboard/reports — Keeps AUTH-04 proxy matcher coverage for old links
- Phase 4 plans: 04-01 Track A (API) → 04-02 Track B (status UI/BFF) → 04-03 Track C (officer copy); D-01..D-18 covered; RESEARCH Q1–Q3 RESOLVED
- [Phase 04]: Uniform 401 detail for citizen status verify failures — CIT-03 anti-enumeration; never 404
- [Phase 04]: Separate status_limiter with status:{ip} keys — CIT-04; must not share analyze report_limiter
- [Phase 04]: Citizen history strips actor_id; notes as plain text — CIT-02 / D-05 / D-06
- Phase 5 context: daily incremental ETL; 3 officer charts + hotspot list; 30d default; thin public Home stats with k≥3; no maps; strict BQ privacy exclusions
- Phase 5 plans: 05-01 (ETL/DDL) → 05-04 (officer API) → 05-03 (Analytics UI) → 05-02 (public stats); dual-watermark ETL; `*_analytics` BQ tables; recharts SUS checkpoint; D-01..D-18 covered
- Phase 5 PLAN CHECK PASSED (2026-07-20) — execute after Phase 4 UAT or explicit bypass
- [Phase 04]: Client-side status lookup with Suspense/useSearchParams for deep-link auto-fetch — Keeps access token out of RSC data fetches (RESEARCH A1 / T-04-09)
- [Phase 04]: Map only 401/429/network to catalog strings; ignore API detail text — CIT-03 / D-16 anti-enumeration on the public UI surface
- [Phase 04]: Share URL locale hard-coded to en while dashboard unlocalized (RESEARCH A5) — Avoid inventing locale-prefixed dashboard routes in Phase 4
- [Phase 04]: Dashboard layout provides NextIntlClientProvider for dashboard.* catalogs — Required for CopyStatusLink EN/VI and existing sidebar translations
- [Phase 04]: No token re-issue UI — recovery hint only (D-14c) — Plaintext tokens are hash-at-rest only; re-issue deferred
- [Phase 03]: Previous pagination clears cursor (next_cursor-only API) — Backend exposes opaque next_cursor only
- [Phase 03]: Column visibility localStorage citymind.dashboard.columnVisibility; severity hidden by default — D-01/D-05 client preference only
- [Phase 03]: No ExportButton in 03-02 — owned by 03-04 — Plan scope boundary
- [Phase 03]: Preserve CopyStatusLink on detail (DASH-08 already shipped) — Phase 4 control present; plan forbids removal
- [Phase 03]: Evidence owns image+signals; AI panel owns summary/recommendation/uncertainty — Aligns D-19 Evidence vs AI advisory split
- [Phase 03]: reviewing immediate; resolved/rejected Dialog-gated with required note — D-11/D-12 UI-SPEC Dialog contract
- [Phase 03]: Export uses fetch+blob for error Alert; BFF streams from FastAPI (no SheetJS)
- [Phase 03]: Sidebar Export active via useSearchParams with Suspense in dashboard layout
- [Phase 03]: Additive EN/VI export keys only — preserved 03-03 detail/resolve catalog
- [Phase 05]: New *_analytics BQ tables (not in-place DROP of legacy reports columns) — Avoid breaking leftover readers of old schema.sql shapes
- [Phase 05]: Dual watermarks because reports has no updated_at — Status changes refresh report rows via events watermark
- [Phase 05]: SLA open = report created_at; close = MIN(resolved/rejected) — One close per report_id (D-05/D-14)
- [Phase 05]: Category/hotspot date filters use reports_analytics; volume/SLA use analytics views — Views lack day columns for category/hotspot
- [Phase 05]: Officer analytics max span 366 days; empty:true when no warehouse points — ANLY-03 range clamp and D-10 empty signal
- [Phase 05]: Human approved recharts via official shadcn chart after SUS checkpoint (05-03)
- [Phase 05]: Officer Analytics UI uses officerFetch GET /api/v1/analytics with URL range presets default 30 days
- [Phase 05]: Public stats k≥3 enforced server-side; stats:{ip} rate limiter separate from status/analyze (05-02)
- [Phase 05]: PublicStatsStrip SSR hides on failure — Home render never blocked (D-12)

### Pending Todos

- Phase 5 planned — next `$gsd-execute-phase 5` (depends on Phase 4 UAT for execute gate)
- Phase 3 schema push still blocking 03-01 SUMMARY if not yet applied
- Phase 2 human UAT (Home visual/locale, citizen submit→flash, login→returnUrl→dashboard) — see `02-VERIFICATION.md` human_verification
- Phase 1 human UAT still open (`human_needed`) — see `01-VERIFICATION.md`

### Blockers/Concerns

- **Phase 8 (2026-07-22):** `SUPABASE_DB_URL` missing from `.env.local` — blocks 08-01/08-04 schema push (`run-supabase-sql.mjs`) and 08-03 two-terminal triage smoke. Operator must add direct Postgres URL; do not invent password.
- Phase 1 verification status **human_needed** (2026-07-20): code must-haves largely present; live Auth/RLS + BQ migrate UAT pending — see `.planning/phases/01-supabase-foundation/01-VERIFICATION.md`. ROADMAP Phase 1 checkbox not marked complete until UAT clears.
- Phase 2 verification status **human_needed** (2026-07-20 re-verify): D-03 code gap closed; live submit/login/visual UAT pending — ROADMAP Phase 2 checkbox not marked complete until UAT clears.
- Track B soft-consumes Track A `access_token`; prefer finishing 02-01 before Report success smoke (02-04)
- 03-01 schema push blocked: Supabase MCP DB connection timeouts; need SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD for project eimiblmctoekrntrqsrx to run supabase db push

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Maps | MapLibre + PostGIS | Phase 6 | v2 init |
| Notifications | Email/SMS | v2 backlog | v2 init |
| Prediction | Forecasting models | Out of scope | v2 init |

## Session Continuity

Last session: 2026-07-22T00:20:59.066Z
Stopped at: Phase 8 context gathered
Resume file: None
Notes: Phase 5 all four plans complete; ready for phase verification / UAT
