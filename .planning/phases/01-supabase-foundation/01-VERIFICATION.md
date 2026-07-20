---
phase: 01-supabase-foundation
verified: 2026-07-20T12:07:03.022Z
status: human_needed
score: 2/4 must-haves verified
behavior_unverified: 2
overrides_applied: 0
mvp_goal_format: invalid
mvp_note: "ROADMAP Mode is mvp but phase goal is not a User Story; User Flow Coverage derived from plan objectives (Escalation Gate). Run /gsd mvp-phase 1 to reformat the goal if MVP UAT framing is required."
behavior_unverified_items:
  - truth: "Officer can log in via Supabase Auth and RLS blocks unauthorized access"
    test: "Sign in with a seeded officer/admin at /login; open /dashboard; attempt anon/wrong-role reads against reports (direct Supabase or FastAPI without bearer)."
    expected: "Valid officer reaches /dashboard; invalid credentials show inline Alert; anon/wrong-role cannot read/update reports (401/403 or RLS deny)."
    why_human: "Login is a state transition and RLS is enforced by live Postgres policies; presence of JWKS middleware + SQL policies cannot prove runtime deny/allow without credentials and a live project."
  - truth: "Demo data migrated from BigQuery to Supabase"
    test: "Run scripts/migrate_bigquery_to_supabase.py --apply --verify (then a second --apply --verify); reconcile report IDs and status_events counts."
    expected: "Source/target IDs and counts match; second apply writes zero new rows; no lost history fields."
    why_human: "Migration tooling and unit tests exist, but live BigQuery→Supabase apply/reconcile was not re-executed here (Supabase MCP timed out; no runnable backend venv for pytest)."
human_verification:
  - test: "Officer login smoke"
    expected: "Seeded officer/admin signs in via Supabase Auth, lands on /dashboard; bad password returns /login?error=1 with approved Alert; no signup control."
    why_human: "Requires live Auth credentials and browser session cookies."
  - test: "RLS / officer API deny path"
    expected: "Unauthenticated or non-officer JWT cannot list/update reports; officer JWT can read and append status_events only."
    why_human: "RLS and JWKS need a live Supabase project; MCP SQL timed out during verification."
  - test: "BigQuery demo migration reconcile"
    expected: "--apply --verify reconciles; repeat apply is idempotent."
    why_human: "Needs BigQuery source credentials and network to the Cloud project."
  - test: "Public Home + locale + dashboard chrome"
    expected: "Unauthenticated / (or /en) shows CityMind Home and Report CTA; EN/VI switch preserves route; dashboard shows Reports destination + Export + Settings + Logout with empty/error/placeholder states."
    why_human: "Visual/accessibility and locale interaction need a running Next.js app."
---

# Phase 1: Supabase Foundation Verification Report

**Phase Goal:** Move operational persistence to Supabase; establish auth, RLS, and parallel UI scaffolds.
**Verified:** 2026-07-20T12:07:03.022Z
**Status:** human_needed
**Re-verification:** No — initial verification

**MVP mode note:** ROADMAP marks `Mode: mvp`, but `user-story.validate` failed on the phase goal (not `As a…, I want to…, so that…`). Per Escalation Gate, verification proceeded against roadmap Success Criteria and plan-level user stories rather than refusing the run. Reformatting via `/gsd mvp-phase 1` is recommended for formal MVP UAT scripts.

## User Flow Coverage

Derived from plan objectives (phase goal is not User Story–shaped):

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Citizen submit | Public analyze persists without bearer | `backend/app/api/reports.py` `/analyze` has no `require_officer`; `get_sink()` → `SupabaseReportSink` service-role insert | ✓ code |
| Officer sign-in | Seeded officer reaches dashboard | `frontend/src/app/api/session/login/route.ts` `signInWithPassword`; role gate; redirect `/dashboard` | ⚠️ needs live Auth |
| Officer workspace | Protected shell with nav + report read | `dashboard/layout.tsx` `requireOfficerSession`; `DashboardSidebar`; `officerFetch` recent reports | ✓ code / ⚠️ live data |
| Outcome | Ops on Supabase with auth/RLS scaffolds | Schema+RLS SQL; JWT `require_officer`; shadcn Home+Dashboard shells | ✓ code / ⚠️ live RLS+migrate |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Reports CRUD through FastAPI reads/writes Supabase Postgres (BigQuery not used for ops) | ✓ VERIFIED | `reports.py` wires `SupabaseReportSink` only; no `BigQueryReportSink` import in `backend/app` ops path; `storage.py` uploads `supabase://` URIs (GCS retained for legacy download only) |
| 2 | Officer can log in via Supabase Auth and RLS blocks unauthorized access | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Auth SSR + JWT role checks + RLS policies are present and wired (`auth.ts`, `security.py`, migration SQL); live login/RLS not exercised this run |
| 3 | shadcn/ui installed; landing and dashboard shells render with placeholder data | ✓ VERIFIED | `frontend/components.json` (radix/new-york/zinc); `src/components/ui/*`; Home at `[locale]/page.tsx` + root redirect; `/dashboard` shell with empty/error states |
| 4 | Demo data migrated from BigQuery to Supabase | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `scripts/migrate_bigquery_to_supabase.py` + `test_migrate_bigquery_to_supabase.py` + Supabase `seed_reports.py` exist; live BQ apply/reconcile not re-proven |

**Score:** 2/4 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `supabase/migrations/20260720_000001_foundation.sql` | Schema, RLS, evidence bucket | ✓ VERIFIED | reports, status_events, access_tokens; officer/admin policies; private `evidence` bucket |
| `backend/app/services/supabase.py` | SupabaseReportSink | ✓ VERIFIED | Service-role ingest + caller-JWT client |
| `backend/app/security.py` | JWKS officer auth | ✓ VERIFIED | Bearer JWT, audience/issuer, `app_metadata.role` ∈ officer\|admin |
| `backend/app/services/storage.py` | Supabase Storage | ✓ VERIFIED | Upload to private bucket; legacy `gs://` download path retained |
| `scripts/migrate_bigquery_to_supabase.py` | Idempotent migrate | ✓ VERIFIED | dry-run / apply / verify |
| `frontend/components.json` + `globals.css` | shadcn civic theme | ✓ VERIFIED | Official registry contract + tokens |
| `frontend/src/app/page.tsx` + `[locale]/page.tsx` | Public Home | ✓ VERIFIED | Root redirects to `/en`; localized Home shell |
| `frontend/src/components/LocaleSwitcher.tsx` | EN/VI switch | ✓ VERIFIED | Present; catalogs `en.json`/`vi.json` |
| `frontend/src/lib/supabase/server.ts` | SSR client | ✓ VERIFIED | `@supabase/ssr` |
| `frontend/src/app/login/page.tsx` | Officer login UI | ✓ VERIFIED | No signup; posts `/api/session/login` |
| `frontend/src/lib/backend.ts` | Bearer BFF | ✓ VERIFIED | `Authorization: Bearer` from `getSessionToken` |
| `frontend/src/app/dashboard/layout.tsx` | Protected shell | ✓ VERIFIED | `requireOfficerSession` |
| `frontend/src/app/dashboard/page.tsx` | Reports placeholder | ✓ VERIFIED | `officerFetch` recent + empty/error UI |
| `frontend/src/components/DashboardSidebar.tsx` | Nav + logout | ✓ VERIFIED | Export/Settings/Logout present; first item labeled **Dashboard** (routes to reports list) — see Warnings |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `backend/app/api/reports.py` | `supabase.py` | SupabaseReportSink | ✓ WIRED | `gsd_run verify.key-links` passed |
| `backend/app/security.py` | Supabase JWKS / role | Bearer decode | ✓ WIRED | Pattern verified |
| `scripts/migrate_bigquery_to_supabase.py` | reports/status_events | upsert + reconcile | ✓ WIRED | Pattern verified |
| `frontend/components.json` | `components/ui/*` | shadcn generation | ✓ WIRED | Pattern verified |
| `frontend/src/app/layout.tsx` | messages en/vi | NextIntlClientProvider | ✓ WIRED (relocated) | Provider lives in `app/[locale]/layout.tsx` (Phase 2 locale WIP); intent satisfied |
| `api/session/login` | Supabase Auth | signInWithPassword | ✓ WIRED | Verified |
| `lib/backend.ts` | FastAPI | Bearer token | ✓ WIRED | Verified |
| `dashboard/layout.tsx` | `lib/auth.ts` | requireOfficerSession | ✓ WIRED | Verified |
| `dashboard/page.tsx` | reports API | officerFetch | ✓ WIRED | Verified |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `dashboard/page.tsx` | `reports` | `officerFetch(/api/v1/reports/recent)` → FastAPI → `SupabaseReportSink.list_recent` | Yes when session+DB live; empty/error states coded | ✓ FLOWING (code) |
| `[locale]/page.tsx` | `t(...)` | next-intl messages | Catalog strings | ✓ FLOWING |
| Analyze path | persisted report | Gemini → `insert` service-role | Wired to Supabase client | ✓ FLOWING (code) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Officer auth contract tests | `cd frontend && node --test tests/officer-auth.test.mjs` | 4/4 pass (file/contract) | ✓ PASS |
| Dashboard shell contract | `cd frontend && node --test tests/dashboard-shell.test.mjs` | 3/3 pass | ✓ PASS |
| Public shell / catalogs | `cd frontend && node --test tests/public-shell.test.mjs` | 3/3 pass | ✓ PASS |
| Backend JWT/sink/migrate pytest | `python3 -m pytest backend/tests/test_security.py …` | Collection failed: no fastapi/pydantic_settings/dotenv in default interpreter | ? SKIP |
| Live Supabase table probe | MCP `list_tables` / `execute_sql` | Connection timeout | ? SKIP |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `scripts/*/tests/probe-*.sh` declared for this phase | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DATA-01 | 01-01 | Reports/status in Supabase Postgres | ✓ SATISFIED | Sink cutover + migration schema |
| DATA-02 | 01-02 | BQ demo migrates without loss | ? NEEDS HUMAN | Tooling+tests present; live reconcile unverified |
| AUTH-01 | 01-05 | Officers via Supabase Auth | ? NEEDS HUMAN | Login route wired; live sign-in unverified |
| AUTH-02 | 01-01 | RLS officer/admin | ? NEEDS HUMAN | Policies in SQL; live deny unverified |
| AUTH-03 | 01-01, 01-05 | Public analyze open; officer endpoints auth | ✓ SATISFIED | `/analyze` unauthenticated; officer routes `Depends(require_officer)`; BFF `getClaims` on status/image |
| PUB-05 | 01-03, 01-04 | shadcn themed | ✓ SATISFIED | components.json + primitives + civic tokens |
| DASH-01 | 01-06 | Sidebar Reports/Export/Settings/Logout | ✓ SATISFIED* | Shell has four destinations + Logout; first nav label is "Dashboard" not "Reports" (warning) |

\*No orphaned Phase 1 requirements in REQUIREMENTS.md beyond the seven claimed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `DashboardSidebar.tsx` | ~36–40 | Nav label `tNav('dashboard')` → "Dashboard" vs required "Reports" | ⚠️ Warning | DASH-01 wording mismatch; destination is reports list and active on `/dashboard` |
| `frontend/src/proxy.ts` | — | No auth cookie refresh / dashboard fail-closed | ℹ️ Info | Intentional deferral: AUTH-04 / Phase 2 per STATE.md; layout guard closes the gap for Phase 1 |
| `backend/app/services/bigquery.py` | — | Legacy sink file remains | ℹ️ Info | Not imported by ops API; analytics-era leftover OK |
| `backend/app/config.py` | — | `enable_bigquery: bool = True` default | ℹ️ Info | Unused by reports path after cutover |
| Phase sources scanned | — | No TBD/FIXME/XXX debt markers | ✓ | — |

### Human Verification Required

#### 1. Officer login smoke

**Test:** Sign in at `/login` with a seeded officer/admin; retry with bad password.
**Expected:** 303 to `/dashboard` on success; `/login?error=1` + Alert on failure; no signup.
**Why human:** Live Supabase Auth + browser cookies.

#### 2. RLS / officer API deny path

**Test:** Call protected FastAPI routes without bearer and with a non-officer JWT; confirm RLS for anon client.
**Expected:** 401/403; no report leakage.
**Why human:** Needs live JWKS + Postgres RLS (MCP timed out).

#### 3. BigQuery demo migration reconcile

**Test:** `python3 scripts/migrate_bigquery_to_supabase.py --apply --verify` twice.
**Expected:** Counts/IDs reconcile; second run writes zero rows.
**Why human:** Needs BQ + Supabase credentials; not re-run here.

#### 4. Public Home + locale + dashboard chrome

**Test:** Open public Home, switch EN/VI, open `/dashboard` as officer.
**Expected:** Brand/CTA; locale preserves route; sidebar Export/Settings/Logout; empty or seeded list.
**Why human:** Visual/UX and running Next server.

### Gaps Summary

No **BLOCKER** gaps: schema, FastAPI Supabase cutover, JWT boundary, shadcn shells, auth BFF, and dashboard chrome exist and are wired.

Two roadmap Success Criteria remain **behavior-unverified** (live Auth/RLS and live BQ migration). Overall status is **human_needed**, not `passed`. ROADMAP Phase 1 top-level checkbox left unchecked until human UAT clears those items (or an override is accepted). Phase 2 WIP under `frontend/src/app/[locale]/` was not modified.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `proxy.ts` dashboard gate + session refresh (AUTH-04) | Phase 2 | STATE.md decision: AUTH-04 gates `/dashboard` via `proxy.ts` |
| 2 | Full Home/report polish, access-token UX | Phase 2 | ROADMAP Phase 2 goal |
| 3 | Data table / export / resolve | Phase 3 | ROADMAP Phase 3 / DASH-02+ |

---

_Verified: 2026-07-20T12:07:03.022Z_
_Verifier: gsd-verifier (generic-agent workaround)_
