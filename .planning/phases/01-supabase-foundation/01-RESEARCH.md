# Phase 1: Supabase Foundation - Package Research

**Researched:** 2026-07-20
**Domain:** Dependency legitimacy and compatibility gate
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### API ↔ Auth bridge
- **D-01:** FastAPI authenticates officer requests via **Supabase JWT end-to-end**. Next.js forwards the access token; FastAPI validates JWKS. Drop `OFFICER_API_KEY` / `X-CityMind-Officer-Key` for browser-originated officer calls.
- **D-02:** Roles live in **`app_metadata.role`** with values `officer` | `admin`. FastAPI and RLS read this claim. No full `user_roles` Auth Hook system in Phase 1.
- **D-03:** Next.js session uses **`@supabase/ssr`** cookies. Remove custom HMAC `citymind_officer_session` helpers in `frontend/src/lib/auth.ts`.
- **D-04:** Officer/admin accounts are **manually seeded** (dashboard or seed script). No open officer signup in Phase 1.
- **D-05:** Public `POST /analyze` remains unauthenticated (AUTH-03).

### Schema & cutover
- **D-06:** Postgres schema is a **near-mirror of BigQuery** report columns; store `evidence`, `uncertainty`, and `urban_context` as **JSONB**; keep append-only `status_events` table.
- **D-07:** Include **`access_tokens`** table in Phase 1 (hashed token, report_id, timestamps) even though citizen status UX is Phase 2.
- **D-08:** **Hard cutover** after migration script: replace `BigQueryReportSink` with `SupabaseReportSink`; BigQuery not used for ops CRUD after Phase 1.
- **D-09:** **Do not enable PostGIS** in Phase 1 — defer to Phase 6.

### Supabase client model
- **D-10:** FastAPI uses **caller JWT** (RLS applies) for officer read/update paths; uses **service role** for public report ingest (and other privileged server writes that cannot be anon).
- **D-11:** Use official **`supabase-py`** client from FastAPI (not direct asyncpg as primary path).
- **D-12:** Develop against a **Supabase Cloud** project (env vars in `.env` / `.env.local`). Local CLI stack not required for Phase 1.
- **D-13:** Schema lives in **`supabase/migrations/`** (versioned SQL).

### UI scaffold depth
- **D-14:** Install **shadcn/ui** with **theme tokens** (CSS variables) and core primitives (Button, Input, Card, Sidebar/layout). Placeholder Home + Dashboard — not full marketing/table polish.
- **D-15:** **Migrate evidence to Supabase Storage** in Phase 1 (replace GCS for new uploads). Store storage path/URI on the report row. Plan migration or leave legacy GCS URIs for old demo rows as needed.
- **D-16:** Wire **next-intl** with EN/VI namespaces and scaffold strings + locale switcher. Real marketing copy is Phase 2.
- **D-17:** Route layout: **public Home at `/`**; **officer dashboard at `/dashboard`**; keep `/report`, `/login`; move report detail under dashboard paths as needed (e.g. `/dashboard/reports/[id]`).

### the agent's Discretion
- Exact JWKS validation library/middleware shape in FastAPI
- Precise RLS policy SQL wording (must enforce officer/admin; public insert for reports only as designed)
- Whether legacy GCS demo images are migrated into Supabase Storage or left as dead URIs for seed refresh
- Exact shadcn component inventory beyond the core set above
- Seed script format (SQL vs Python) for officers and demo reports

### Deferred Ideas (OUT OF SCOPE)
- PostGIS extension and geo columns/APIs — Phase 6
- Full Home marketing content and Report form RHF+Zod polish — Phase 2
- Citizen status page + token issuance UX — Phase 2/4 (table exists early per D-07)
- Dashboard data table, filters, export, resolve notes — Phase 3
- `user_roles` table + Custom Access Token Auth Hook RBAC — future if roles grow beyond officer/admin
- Local Supabase CLI stack — optional later; Cloud-only for Phase 1
- Dual-write BigQuery + Supabase transition window — rejected in favor of hard cutover
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Reports and status events persist in Supabase Postgres (not BigQuery for ops CRUD) | Official Python client identity, pin, and server-client security boundary. |
| DATA-02 | Existing BigQuery demo data migrates to Supabase without loss | The same pinned Python client is suitable for the migration utility; no second database package is needed. |
| AUTH-01 | Officers authenticate via Supabase Auth (replace shared-password MVP) | Official JS + SSR pair, cookie-client pattern, and exact compatible pins. |
| AUTH-02 | RLS policies enforce officer/admin read and update on reports | Caller-JWT client isolation and secret-key boundary are documented. |
| AUTH-03 | Public analyze endpoint remains unauthenticated; officer endpoints require auth | Separate privileged ingest client and caller-scoped officer client are required. |
| PUB-05 | shadcn/ui component library installed and themed consistently | Official CLI identity, exact component inventory, generated dependency closure, and safe commands. |
| DASH-01 | App shell with sidebar navigation (Reports, Export, Settings, Logout) | Official `sidebar` component and its transitive registry items are included. |
</phase_requirements>

## Summary

All requested package identities are official and compatible with the checked CityMind baseline: Node 22, Next.js 16.2.10, React/React DOM 19.2.4, Python 3.12, and FastAPI 0.115.14. `[VERIFIED: codebase grep]` Official documentation names the installable Python distribution `supabase` (the project is called supabase-py), the browser/server packages `@supabase/supabase-js` and `@supabase/ssr`, the i18n package `next-intl`, and the CLI package `shadcn`. `[CITED: https://supabase.com/docs/reference/python/installing]` `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` `[CITED: https://next-intl.dev/docs/getting-started/app-router]` `[CITED: https://ui.shadcn.com/docs/cli]`

The package-legitimacy seam returned no SLOP verdict for the actual candidate set. It returned SUS for seven packages: six because their latest releases are recent and Python `supabase` because the seam could not obtain download/repository signals. Official docs, official repositories, and registry metadata independently confirm all seven identities, but protocol still requires `checkpoint:human-verify` before installation. `[VERIFIED: package-legitimacy seam]`

**Primary recommendation:** Use the exact pins below, require one human-verification checkpoint covering all SUS packages immediately before installation, commit both lockfiles, and use only the official shadcn registry with the Radix base.

## Package Legitimacy Audit

> Gate run on 2026-07-20 with `gsd-tools query package-legitimacy check`, then cross-checked against official documentation and the correct ecosystem registry. Weekly downloads are the gate's observed values. “Recent” is a caution signal, not evidence of impersonation.

| Package | Registry | Pin | Age / latest publish | Downloads | Source Repo | Verdict | Disposition / Go-No-Go |
|---------|----------|-----|----------------------|-----------|-------------|---------|------------------------|
| `supabase` (official supabase-py distribution) `[WARNING: flagged as suspicious — verify before using.]` | PyPI | `2.31.0` | ~4y 9m / 2026-06-04 | unavailable to gate | `github.com/supabase/supabase-py` | SUS: gate lacked downloads/repo signals | **GO after checkpoint.** Official Supabase docs say `pip install supabase`; PyPI links the official repo and requires Python `>=3.9`. `[CITED: https://supabase.com/docs/reference/python/installing]` `[CITED: https://pypi.org/project/supabase/]` |
| `@supabase/supabase-js` `[WARNING: flagged as suspicious — verify before using.]` | npm | `2.110.7` | ~6y 6m / 2026-07-16 | 21.5M/wk | `github.com/supabase/supabase-js` | SUS: latest release too new | **GO after checkpoint.** Official SSR docs require it; Node engine is `>=22`, matching CityMind Node 22. `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` `[CITED: https://www.npmjs.com/package/@supabase/supabase-js]` |
| `@supabase/ssr` `[WARNING: flagged as suspicious — verify before using.]` | npm | `0.12.3` | ~2y 10m / 2026-07-14 | 5.7M/wk | `github.com/supabase/ssr` | SUS: latest release too new | **GO after checkpoint.** Peer dependency `@supabase/supabase-js ^2.110.5` accepts `2.110.7`. `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` `[CITED: https://www.npmjs.com/package/@supabase/ssr]` |
| `next-intl` `[WARNING: flagged as suspicious — verify before using.]` | npm | `4.13.2` | ~5y 8m / 2026-07-10 | 4.5M/wk | `github.com/amannn/next-intl` | SUS: latest release too new | **GO after checkpoint.** Peers explicitly accept Next `^16.0.0` and React `^19.0.0`. `[CITED: https://next-intl.dev/docs/getting-started/app-router]` `[CITED: https://www.npmjs.com/package/next-intl]` |
| `shadcn` CLI/runtime `[WARNING: flagged as suspicious — verify before using.]` | npm | `4.13.1` | ~2y / 2026-07-17 | 6.7M/wk | `github.com/shadcn-ui/ui` | SUS: latest release too new | **GO after checkpoint.** Official CLI; Node engine `>=20.18.1` accepts Node 22. Keep as dev dependency because current new-york-v4 style imports shadcn Tailwind CSS until deliberately ejected. `[CITED: https://ui.shadcn.com/docs/cli]` `[CITED: https://www.npmjs.com/package/shadcn]` |
| `class-variance-authority` | npm | `0.7.1` | ~4y 6m / 2024-11-26 | 59.4M/wk | `github.com/joe-bell/cva` | OK | **GO.** Official new-york-v4 style dependency. `[VERIFIED: npm registry]` `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/index.json]` |
| `clsx` | npm | `2.1.1` | ~7y 7m / 2024-04-23 | 113.1M/wk | `github.com/lukeed/clsx` | OK | **GO.** Official generated `utils` dependency. `[VERIFIED: npm registry]` `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/utils.json]` |
| `tailwind-merge` | npm | `3.6.0` | ~5y / 2026-05-10 | 76.3M/wk | `github.com/dcastil/tailwind-merge` | OK | **GO.** Official generated `utils` dependency. `[VERIFIED: npm registry]` `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/utils.json]` |
| `lucide-react` `[WARNING: flagged as suspicious — verify before using.]` | npm | `1.25.0` | ~5y 9m / 2026-07-17 | 95.9M/wk | `github.com/lucide-icons/lucide` | SUS: latest release too new | **GO after checkpoint.** Official style/sidebar dependency; peer accepts React 19. `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/index.json]` `[CITED: https://www.npmjs.com/package/lucide-react]` |
| `radix-ui` `[WARNING: flagged as suspicious — verify before using.]` | npm | `1.6.4` | ~3y 11m / 2026-07-20 | 10.3M/wk | `github.com/radix-ui/primitives` | SUS: published today | **GO after checkpoint.** Official new-york style now uses the unified package; peers accept React/React DOM 19. `[CITED: https://ui.shadcn.com/docs/changelog/2026-02-radix-ui]` `[CITED: https://www.npmjs.com/package/radix-ui]` |
| `tw-animate-css` | npm | `1.4.0` | ~1y 4m / 2025-09-24 | 35.2M/wk | `github.com/Wombosvideo/tw-animate-css` | OK | **GO.** Official new-york-v4 style dev dependency. `[VERIFIED: npm registry]` `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/index.json]` |

**Packages removed due to SLOP verdict:** none from the actual candidate set.

**Packages flagged as suspicious [SUS]:** `supabase`, `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, `shadcn`, `lucide-react`, `radix-ui`. The planner must insert `checkpoint:human-verify` before the first install command and record approval for these exact names and versions.

**Postinstall audit:** `npm view <package> scripts.postinstall` returned no postinstall script for every npm package in the table. `[VERIFIED: npm registry]`

### Official shadcn Component Closure

Use exactly `button input label card separator dropdown-menu sidebar alert` for Phase 1. The official new-york-v4 registry makes `sidebar` pull `button`, `separator`, `sheet`, `tooltip`, `input`, `use-mobile`, and `skeleton`; its npm dependencies are `radix-ui`, `class-variance-authority`, and `lucide-react`. `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json]`

Choose `alert`, not `sonner`, for login errors in this phase. The official `alert` item adds no package dependency, while `sonner` adds both `sonner` and `next-themes`; the approved Phase 1 shell is light-only and does not need that extra dependency surface. `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/alert.json]` `[CITED: https://ui.shadcn.com/r/styles/new-york-v4/sonner.json]`

No third-party shadcn registries are allowed. Generated component source is vendored into `frontend/src/components/ui`, so review the generated diff like application code. `[CITED: https://ui.shadcn.com/docs/new]`

## Compatibility Matrix

| Dependency | Declared compatibility | CityMind baseline | Conclusion |
|------------|------------------------|-------------------|------------|
| `supabase==2.31.0` | Python `>=3.9`; `httpx >=0.26,<0.29` | Python 3.12; `httpx==0.28.1`; FastAPI 0.115.14 | Compatible. FastAPI has no package-level peer coupling to supabase-py. `[CITED: https://pypi.org/pypi/supabase/json]` `[VERIFIED: codebase grep]` |
| `@supabase/supabase-js@2.110.7` | Node `>=22.0.0` | Node 22 | Compatible at the declared lower bound. `[CITED: https://registry.npmjs.org/%40supabase%2Fsupabase-js]` `[VERIFIED: codebase grep]` |
| `@supabase/ssr@0.12.3` | Peer `@supabase/supabase-js ^2.110.5` | `2.110.7` pin | Compatible pair. `[CITED: https://registry.npmjs.org/%40supabase%2Fssr]` |
| `next-intl@4.13.2` | Next 12–16; React 16.8–19 | Next 16.2.10; React 19.2.4 | Compatible. `[CITED: https://registry.npmjs.org/next-intl]` `[VERIFIED: codebase grep]` |
| `shadcn@4.13.1` | Node `>=20.18.1`; official Tailwind v4/React 19 components | Node 22; Tailwind 4; React 19.2.4 | Compatible. `[CITED: https://ui.shadcn.com/docs/tailwind-v4]` `[CITED: https://registry.npmjs.org/shadcn]` |
| `lucide-react@1.25.0`, `radix-ui@1.6.4` | Both peers accept React 19; Radix also accepts React DOM 19 | React/React DOM 19.2.4 | Compatible. `[CITED: https://registry.npmjs.org/lucide-react]` `[CITED: https://registry.npmjs.org/radix-ui]` |

## Exact Installation Runbook

After the required human-verification checkpoint, use exact pins. The commands intentionally avoid `@latest` so the plan and lockfile resolve the audited artifacts.

```bash
cd backend
python3 -m pip install supabase==2.31.0
```

Add `supabase==2.31.0` to the existing pinned `backend/requirements.txt` and preserve that file's current encoding when editing. `[VERIFIED: codebase grep]`

```bash
cd frontend
npm install --save-exact @supabase/supabase-js@2.110.7 @supabase/ssr@0.12.3 next-intl@4.13.2
npx --yes shadcn@4.13.1 init --base radix --css-variables
npx --yes shadcn@4.13.1 add --dry-run button input label card separator dropdown-menu sidebar alert
npx --yes shadcn@4.13.1 add button input label card separator dropdown-menu sidebar alert
npm install --save-exact class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.6.0 lucide-react@1.25.0 radix-ui@1.6.4
npm install --save-dev --save-exact shadcn@4.13.1 tw-animate-css@1.4.0
npm ls @supabase/supabase-js @supabase/ssr next-intl shadcn class-variance-authority clsx tailwind-merge lucide-react radix-ui tw-animate-css
npm audit --omit=dev
```

The current v4 CLI no longer exposes the old `--style new-york --base-color zinc` flags; it uses bases and presets. Run `init` from `frontend/`, explicitly keep `--base radix`, select/verify the approved new-york + zinc configuration, and inspect `frontend/components.json` before `add`. `[CITED: https://ui.shadcn.com/docs/cli]` The CLI changed its default base to Base UI in July 2026, so omitting `--base radix` would contradict the approved Phase 1 UI contract. `[CITED: https://ui.shadcn.com/docs/changelog]`

## Integration and Security Constraints

- Create a fresh caller-scoped Python client per officer request with the publishable key and that request's bearer JWT; do not cache caller JWTs. The pinned client accepts custom authorization headers through `ClientOptions`. `[CITED: https://github.com/supabase/supabase-py/blob/v2.31.0/src/supabase/src/supabase/_sync/client.py]`
- Create a separate privileged server client for anonymous ingest/migration/storage using the Supabase secret/service-role key. Secret/service-role keys bypass RLS and must never enter browser bundles, cookies, URLs, logs, or client-visible error messages. `[CITED: https://supabase.com/docs/guides/getting-started/api-keys]`
- In Next.js server code, use `getClaims()` to authorize pages/data. Use `getSession()` only when retrieving the access token to forward to FastAPI; never trust its embedded user object for authorization. `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]`
- Use separate browser and server helpers from `@supabase/ssr`, and implement the Next.js 16 `proxy.ts` refresh boundary. `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]`
- Keep the Supabase evidence bucket private; trusted server operations may use the privileged key, while citizen/officer access remains mediated by authenticated application endpoints and policies. `[CITED: https://supabase.com/docs/guides/storage/security/access-control]`
- Commit `frontend/package-lock.json`, pin Python requirements, review `npm audit` output, and rerun the legitimacy gate if any audited version changes. `[VERIFIED: package-legitimacy protocol]`

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Supabase Auth JWTs; `getClaims()` for server authorization. `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` |
| V3 Session Management | yes | `@supabase/ssr` cookie adapters plus Next.js Proxy refresh. `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` |
| V4 Access Control | yes | RLS with caller JWT; isolated secret-key client only for privileged server operations. `[CITED: https://supabase.com/docs/guides/database/postgres/row-level-security]` |
| V5 Input Validation | yes | Existing FastAPI/Pydantic boundary remains; these package installs do not replace it. `[VERIFIED: codebase grep]` |
| V6 Cryptography | yes | Validate Supabase JWTs against published keys; do not hand-roll token signatures. `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` |

## Wrong or Deprecated Names

| Do not use | Use instead | Reason |
|------------|-------------|--------|
| `pip install supabase-py` | `pip install supabase==2.31.0` | PyPI has no current `supabase-py` distribution; official docs name `supabase`. `[CITED: https://supabase.com/docs/reference/python/installing]` `[VERIFIED: PyPI index]` |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr@0.12.3` | npm marks the auth-helper package unsupported; official SSR docs use `@supabase/ssr`. `[CITED: https://www.npmjs.com/package/@supabase/auth-helpers-nextjs]` `[CITED: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs]` |
| `shadcn-ui` CLI or an unpinned `shadcn@latest` | `shadcn@4.13.1` | Current official CLI package is `shadcn`; exact pin makes generated output reproducible. `[CITED: https://ui.shadcn.com/docs/cli]` |
| individual `@radix-ui/react-*` installs for this new setup | `radix-ui@1.6.4` | Current new-york style uses the unified Radix package. `[CITED: https://ui.shadcn.com/docs/changelog/2026-02-radix-ui]` |
| `tailwindcss-animate` for new shadcn v4 setup | `tw-animate-css@1.4.0` | shadcn deprecated the former in its Tailwind v4 setup. `[CITED: https://ui.shadcn.com/docs/tailwind-v4]` |
| shadcn `toast` component | `alert` for Phase 1; `sonner` only when toast UX is required | shadcn deprecated `toast` in favor of `sonner`; Phase 1 only needs inline auth errors. `[CITED: https://ui.shadcn.com/docs/tailwind-v4]` |

## Open Questions (RESOLVED)

1. **RESOLVED — Which reviewed shadcn preset/config output represents the locked “new-york + zinc” contract in CLI 4.13.1?**
   - Decision: run the exact pinned CLI with `--base radix --css-variables`, then treat the generated `components.json` as acceptable only when review confirms Radix base, new-york style, zinc base color, CSS variables, `@/` aliases, and official registry items only. Base UI output is rejected.
   - Gate: this configuration review is part of the single existing blocking package-verification checkpoint before any install. If the CLI cannot produce that contract, stop and re-research rather than accepting defaults or changing the UI-SPEC.
   - Basis: CLI v4 supports explicit Radix base and CSS variables while Base UI is now the default. `[CITED: https://ui.shadcn.com/docs/cli]` `[CITED: https://ui.shadcn.com/docs/changelog]`

## Assumptions Log

All dependency identity, version, compatibility, and security claims were checked against official sources or live registries. No `[ASSUMED]` claims remain.

## Sources

### Primary (official)
- https://supabase.com/docs/reference/python/installing — Python distribution identity and Python support.
- https://supabase.com/docs/reference/python/initializing — `create_client` API.
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs — SSR packages, cookie clients, Proxy refresh, `getClaims`/`getSession` boundary.
- https://supabase.com/docs/guides/getting-started/api-keys — publishable versus secret/service-role key security.
- https://github.com/supabase/supabase-py/tree/v2.31.0 — pinned official Python client source.
- https://next-intl.dev/docs/getting-started/app-router — App Router installation and cookie-locale setup.
- https://ui.shadcn.com/docs/cli — current CLI name and options.
- https://ui.shadcn.com/docs/tailwind-v4 — React 19/Tailwind 4 support and current animation dependency.
- https://ui.shadcn.com/r/styles/new-york-v4/index.json — official style dependency closure.
- https://ui.shadcn.com/r/styles/new-york-v4/sidebar.json — official sidebar dependency closure.
- npm registry and PyPI JSON metadata — exact versions, dates, engines, peers, repositories, and postinstall fields.

## Metadata

**Confidence breakdown:**
- Package identity: HIGH — official product docs and repositories cross-checked.
- Version/compatibility: HIGH — live correct-ecosystem registry metadata checked on 2026-07-20.
- Legitimacy disposition: MEDIUM — official ownership is clear, but protocol-prescribed SUS checkpoints remain for recent releases and incomplete PyPI gate signals.

**Research date:** 2026-07-20
**Valid until:** 2026-07-27 (fast-moving packages; rerun registry and legitimacy checks after this date)
