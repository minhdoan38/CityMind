# Phase 4: Citizen Status - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Citizens track a submitted report without an account: bilingual `/status` accepts `report_id` + access token (form and/or deep link), returns only current status, citizen-safe summary, and status history; invalid/expired tokens yield a uniform 401 that does not reveal whether the report exists; the lookup API is rate-limited; officers can copy a shareable status URL from the dashboard detail page.

**In scope:** CIT-01, CIT-02, CIT-03, CIT-04, DASH-08.

**Out of scope this phase:** Email/SMS on status change (NOTF-01); token rotation / multi-device advanced policies; maps (Phase 6); self-help vs government triage UX (Phase 7); changing Phase 2 success flash issuance (already ships token + status-link prep).

</domain>

<decisions>
## Implementation Decisions

### Status page entry
- **D-01:** Support **both** entry modes: (1) manual form fields for `report_id` + token, and (2) **auto-fill from query params** `reportId` + `token` matching the success-page prep URL (`/status?reportId=…&token=…`).
- **D-02:** When query params are present and valid-shaped, **prefill the form and auto-submit once** (or fetch immediately) so the shareable link “just works”; user can still edit fields and re-submit.
- **D-03:** Route lives under locale prefixes (`/en/status`, `/vi/status`) consistent with Phase 2 `localePrefix: 'always'`; keep unprefixed redirects aligned with next-intl routing.
- **D-04:** Visual tone matches **public civic/light** surfaces (not officer dashboard chrome). Prefer simple form + result panel — no marketing hero clutter on `/status`.

### Citizen-visible payload
- **D-05:** Successful lookup returns **only**: current status, short summary (citizen-facing), and **status history** entries with timestamp + status (+ citizen-safe note text if present). **Do not** return AI recommendation, evidence arrays, urban context, confidence, severity internals, officer `actor_id`, or raw analysis JSON (CIT-02).
- **D-06:** Officer resolve/reject **notes** may appear in history **as plain text** when present — they are part of the citizen-facing outcome trail. Do **not** expose internal actor identifiers or officer emails.
- **D-07:** History order on the public page: **newest-first** (aligned with Phase 3 officer timeline direction).
- **D-08:** Empty history is allowed (show current status + “No updates yet” empty copy). Loading/error/empty states required on the page.

### Shareable link security
- **D-09:** Keep the **query-string token** format already used on success (`reportId` + `token` query params). Do **not** switch to hash-fragment-only in Phase 4 (would break copy-paste from success and officer share links). Document that URLs are secrets; advise citizens not to post publicly.
- **D-10:** Continue **SHA-256 hash-at-rest** validation against `access_tokens`; never log plaintext tokens; never echo token back in API error bodies.
- **D-11:** Honor existing token **expiry** (`expires_at` from issuance, default ~365 days). Expired tokens use the **same uniform failure** as invalid tokens (CIT-03) — no “expired” vs “not found” distinction to clients.
- **D-12:** Server is authoritative: client must not infer existence from timing alone beyond best-effort constant messaging; prefer single generic failure message.

### Officer copy-link UX (DASH-08)
- **D-13:** On `/dashboard/reports/[reportId]`, add a **“Copy status link”** control in the header/meta area (near report id / status), not buried only in resolve actions.
- **D-14:** Plaintext tokens are **not stored** (hash-at-rest only), so officers **cannot** reconstruct the citizen’s full tokenized URL. Phase 4 behavior:
  - **D-14a:** Officer control copies `/{locale}/status?reportId={reportId}` (**no token**) and toast explains the citizen still needs their access token from the success page.
  - **D-14b:** Show a short officer-facing **hint** that the full tokenized link was shown once at submission and cannot be recovered from the dashboard.
  - **D-14c:** Do **not** implement token re-issue/rotation in Phase 4. The success-page **full** `reportId`+`token` link remains the primary secret share URL for citizens.
- **D-15:** Copy feedback: clipboard + brief toast/live region (“Link copied”) EN/VI; same pattern as success-page copy buttons.

### Failure & rate-limit UX
- **D-16:** Invalid, missing, malformed, or expired token → **one generic client message** (e.g. “We couldn’t verify that report and token.”) with HTTP **401** from API; **no** different copy for “wrong id” vs “wrong token” vs “expired” (CIT-03).
- **D-17:** Rate limit (CIT-04): reuse public analyze pattern — **IP via `X-Forwarded-For`** behind Cloud Run; return **429** with Retry-After when applicable; UI shows a calm “Too many attempts — try again shortly” message (EN/VI), still without existence leakage.
- **D-18:** Public status API is **unauthenticated** except for token proof; do not require citizen accounts.

### Agent Discretion
- Exact rate-limit window/burst numbers (align with analyze limiter unless research finds a safer public-lookup default)
- Whether auto-submit on query-param deep link uses client fetch or RSC
- Exact EN/VI string IDs in message catalogs
- Whether officer copy button uses absolute URL (`window.location.origin`) vs path-only
- BFF vs direct FastAPI for public status lookup (prefer Next public BFF consistent with analyze)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Privacy: token-scoped lookup; no cross-report leakage; AI advisory
- `.planning/REQUIREMENTS.md` — CIT-01..04, DASH-08, DATA-03 (hash at rest)
- `.planning/ROADMAP.md` — Phase 4 goal and success criteria
- `.planning/STATE.md` — Current milestone position

### Prior phase decisions
- `.planning/phases/01-supabase-foundation/01-CONTEXT.md` — `access_tokens` table early (D-07); public analyze unauthenticated
- `.planning/phases/02-public-experience/02-CONTEXT.md` — Success page token once (D-11, D-18); status-link prep; locale prefixes
- `.planning/phases/03-dashboard-polish/03-CONTEXT.md` — Detail page ownership; DASH-08 deferred here; timeline newest-first

### Code touchpoints
- `frontend/src/app/[locale]/report/success/page.tsx` — Status URL prep with `reportId` + `token` query params
- `backend/app/services/tokens.py` — `issue_access_token` (urlsafe 32, SHA-256, TTL days)
- `backend/app/api/reports.py` — Analyze issues token; officer status endpoints pattern
- `backend/tests/test_access_tokens.py` / `test_analyze.py` — Hash-at-rest expectations
- `frontend/src/app/api/public/reports/analyze/route.ts` — Public BFF pattern to mirror for status lookup

### Design
- `PRODUCT.md` / `DESIGN.md` — Civic public tone; Clinic Blue product accent; bilingual EN/VI
- `.planning/phases/02-public-experience/02-UI-SPEC.md` — Public surface patterns if present

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Success flash + copy buttons pattern for clipboard UX
- Public analyze BFF + rate limit + generic errors
- Token issue/hash helpers and `access_tokens` persistence
- Officer detail page for DASH-08 copy control placement
- next-intl catalogs for EN/VI

### Established Patterns
- Secrets never in analytics/logs; generic API errors to clients
- Locale-prefixed public routes
- Hash-at-rest for access tokens; plaintext only at issue time

### Integration Points
- New public status GET (or POST) API + Next BFF
- New `/[locale]/status` page
- Detail page copy control (reportId-only share URL per D-14a)
- Align success-page prep URL with locale prefix if not already

</code_context>

<specifics>
## Specific Ideas

- User selected **all** gray areas and delegated: **“you decide all.”** Decisions above are agent-locked.
- **Important product honesty:** Because plaintext tokens are not stored, officers cannot copy the citizen’s full tokenized link — Phase 4 copies a reportId-prefilled status URL and tells officers the citizen keeps the token from submission.

</specifics>

<deferred>
## Deferred Ideas

- Token re-issue / rotation / officer-generated replacement links — future phase if product requires recovery
- Email/SMS notify citizen on status change (NOTF-01)
- Hash-fragment-only tokens or short-lived signed status JWTs — not Phase 4
- Maps / Phase 7 triage surfacing on status page
- Multi-token per report / family sharing

</deferred>

---

*Phase: 4-Citizen Status*
*Context gathered: 2026-07-20*
