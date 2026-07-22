# Phase 14: Officer agent console — per-case triage run and attempt log viewer - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Productionize the **officer triage audit console**: a read-only dashboard surface where officers inspect `triage_runs` and `triage_attempts` per report case (model output, retries, validation failures, disposition lineage). Phase 14 is **hardening and sign-off** on code that already exists — not a greenfield build.

Officers use this for accountability and debugging advisory AI output. It does **not** change triage behavior, re-run agents, or expose audit data to citizens.

</domain>

<decisions>
## Implementation Decisions

### Phase scope
- **D-14-01:** **Hardening only** — no new officer actions (no re-run triage, export/download, shadow diff panel, or embedded log on report detail).
- **D-14-02:** **Full phase gate** — mirror Phase 12/13: vitest + legacy contract tests + SQL contract via `phase14:gate` in `package.json`.
- **D-14-03:** **Standalone console** at `/dashboard/agent-console`; report detail keeps deep-link `?report_id=…` only.
- **D-14-04:** **Desktop-first** — officer laptop workflow; mobile layout best-effort, not a gate.

### Log presentation
- **D-14-05:** **Raw output primary** — `raw_output` monospace is the source of truth; no structured 11-key field parser in the UI.
- **D-14-06:** **Prominent validation_errors** — policy/schema failures shown in a visible warn block before raw output (current pattern).
- **D-14-07:** **Truncated preview** — ~320 char preview with expand/collapse for full output (current pattern).
- **D-14-08:** **Current attempt metadata** — timestamp, attempt number, model, latency_ms, disposition badge in the attempt header (no extra prompt_version row).

### Case discovery
- **D-14-09:** **Report ID filter + recent feed** — optional `report_id` query; unfiltered loads latest runs (50-run cap).
- **D-14-10:** **Recent cases on load** — landing without filter shows recent activity, not an empty “enter ID first” state.
- **D-14-11:** **Entry points unchanged** — sidebar nav + report detail “View agent console log” link only (no table context menu or quick-preview tab).
- **D-14-12:** **Truncated case list IDs** — short UUID prefix in left rail; full ID + link to report detail in log header.

### Audit depth & data access
- **D-14-13:** **Triage runs/attempts only** — no `triage_shadow_comparisons` panel in Phase 14.
- **D-14-14:** **Admin client + officer API gate** — keep `getAdminClient()` reads behind `requireOfficerContext()`; no new officer RLS on audit tables.
- **D-14-15:** **50-run cap retained** — `DEFAULT_RUN_LIMIT = 50`; UI copy must note results may be truncated.
- **D-14-16:** **Separate from Phase 12 assistant** — triage audit console only; officer assistant chat stays in `AdvisoryAssistantWidget`.

### Claude's Discretion
- Exact `14-UI-SPEC.md` polish deltas within existing `AgentConsoleViewer` (spacing, truncation notice, empty states).
- REQUIREMENTS traceability ID (propose `DASH-11` or extend `DASH-10` pattern).
- Human UAT checklist structure in `14-VALIDATION.md` (mirror Phase 13 UAT-1..N pattern).
- Whether `phase14:gate` SQL contract asserts officer API wiring only or also FK integrity smoke (no schema changes expected).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Triage audit schema & Phase 8 deferral
- `.planning/phases/08-async-triage-platform-refactor/08-CONTEXT.md` — D-24 full audit (`triage_runs` / `triage_attempts`); officer audit UI explicitly deferred.
- `.planning/phases/08-async-triage-platform-refactor/08-UI-SPEC.md` — Must-not-include: audit viewer was out of Phase 8 MVP.
- `supabase/migrations/20260722120002_async_triage_audit.sql` — Audit table DDL and `complete_triage_report` RPC.
- `.planning/codebase/ai-logic.md` — Triage run/attempt lifecycle and audit writer paths.

### Shadow & assistant (out of Phase 14 UI scope)
- `.planning/phases/10-shadow-rollout-production-evaluation/10-RESEARCH.md` — `triage_shadow_comparisons` storage; not in console UI.
- `.planning/phases/12-dashboard-advisory-assistant-conversational-officer-chat-wid/12-UI-SPEC.md` — Officer assistant widget contract (separate from triage audit).

### Phase gate patterns
- `.planning/phases/13-immediate-citizen-triage-on-submit-with-evaluator-prompt-and/13-VALIDATION.md` — Human UAT checklist format reference.
- `.planning/phases/12-dashboard-advisory-assistant-conversational-officer-chat-wid/12-03-SUMMARY.md` — Phase gate + legacy contract pattern.

### Live implementation (starting point)
- `src/components/dashboard/AgentConsoleViewer.tsx` — Primary UI.
- `src/server/repositories/triage-console.ts` — Case/run/attempt grouping.
- `src/server/services/officer-triage-console.ts` — Officer-gated loader.
- `src/app/api/officer/triage-console/route.ts` — GET API.
- `src/app/dashboard/agent-console/page.tsx` — Page shell.
- `src/server/repositories/triage-console.test.ts` — Repository unit test.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentConsoleViewer` — Case list + run log + attempt expand/collapse; already matches most D-14-05..08 decisions.
- `listTriageConsoleCases` — Groups runs/attempts by report; supports `reportId` filter and `runLimit`.
- `handleOfficerTriageConsoleRequest` — Officer auth + JSON response envelope.
- `DashboardSidebar` — `agentConsole` nav entry already wired.
- Report detail link — `/dashboard/agent-console?report_id=…` from `dashboard/reports/[reportId]/page.tsx`.

### Established Patterns
- Officer tools: `requireOfficerContext()` on API routes; admin Supabase client for service-role reads.
- Phase 12/13 gates: `phaseN:gate` npm script = vitest slice + legacy contract + SQL contract file.
- Bilingual copy under `dashboard.agentConsole` in `messages/en.json` / `messages/vi.json`.
- Desktop dashboard: `surface-card`, `dash-rise`, `agent-console-log` terminal styling in `globals.css`.

### Integration Points
- **Read path only:** `triage_runs` → `triage_attempts` → join `reports` metadata (description, triage_status, category).
- **No write paths** in Phase 14 — triage dispatch remains existing internal/officer APIs.
- **Truncation:** `DEFAULT_RUN_LIMIT = 50` in repository; UI must document when feed is capped.

### Gaps for planning (not yet shipped)
- No `phase14:gate` script or `14_phase14_contract.sql`.
- No `14-UI-SPEC.md`, `14-VALIDATION.md`, or REQUIREMENTS traceability row.
- No legacy contract test asserting agent-console route/sidebar/link wiring.
- Possible polish: truncation notice, gate tests for officer 401/502 paths.

</code_context>

<specifics>
## Specific Ideas

- Phase 14 should feel like **Phase 13** — verify and sign off working code, not rebuild.
- User explicitly rejected feature expansion (shadow panel, re-run, export, embedded logs).
- Desktop-first aligns with recent dashboard UX passes (reports table, delete dialog, preview sheet).

</specifics>

<deferred>
## Deferred Ideas

- **Shadow comparison panel** — baseline vs candidate diff from `triage_shadow_comparisons` (Phase 10 data; future phase).
- **Re-run triage from console** — officer action; belongs with DASH-09 dispatch patterns, not read-only audit.
- **Export/download audit logs** — new capability; separate phase.
- **Embedded agent log on report detail** — convenience UX; deferred per D-14-03.
- **Reports table context menu / quick-preview tab** — extra entry points; deferred per D-14-11.
- **Pagination beyond 50 runs** — API/UI cursor pagination; deferred per D-14-15.
- **Officer RLS on audit tables** — data-layer change; deferred per D-14-14.
- **Unified triage + assistant activity page** — deferred per D-14-16.

### Reviewed Todos (not folded)
- **Spike Cloud Tasks triage handler on Cloud Run** (`spike-cloud-tasks-triage-handler.md`) — stale Phase 7 spike; superseded by self-hosted `triage:worker`. Not folded into Phase 14.

</deferred>

---

*Phase: 14-officer-agent-console-per-case-triage-run-and-attempt-log-vi*
*Context gathered: 2026-07-22*
