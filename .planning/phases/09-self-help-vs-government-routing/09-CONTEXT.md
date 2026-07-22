# Phase 9: Self-help vs Government Routing - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

After async triage completes, deterministically route each report to either **self-help guidance** (curated civic playbooks, no officer workflow by default) or the **government officer queue** (existing officer review path). Routing uses policy rules on triage output — not a second AI call. Citizens on the self-help path see adapted status workflow steps and can escalate to government; officers see government-routed reports by default with destination badges and override actions. All routing decisions are auditable on the report row with a versioned policy constant.

**Depends on:** Phase 8 async triage (intake, worker, triage_status lifecycle, citizen/officer UX contracts).

**Out of scope this phase:** Eval suite and shadow rollout gate (Phase 10 / TRIAGE-08); database-editable CMS for self-help content; separate routing worker process; real-time push notifications; email/SMS.

</domain>

<decisions>
## Implementation Decisions

### Routing trigger
- **D-01:** Run routing **post-triage only** — evaluate destination when `triage_status=completed`. Do not route at intake or while `pending`/`processing`.
- **D-02:** Routing inputs are **deterministic policy rules on triage output** — category, severity, priority, and confidence thresholds. Do not use a separate AI routing call.
- **D-03:** While triage is pending/processing, treat reports as **government queue visible** — officers continue to see all reports (Phase 8 behavior) until routing completes.
- **D-04:** Destination may change after initial routing via **both** citizen escalate CTA and officer override actions.

### Self-help content
- **D-05:** Self-help delivery is **static playbooks** — curated EN/VI guidance per eligible category, not AI-generated at routing time.
- **D-06:** Content depth is **short actionable steps** — 3–5 bullets plus optional external links.
- **D-07:** Content lives in an **in-repo catalog** — dedicated routing playbook module and/or `messages/en.json` + `messages/vi.json` keys (planner picks structure).
- **D-08:** On the self-help citizen path, **hide all AI triage fields** — show playbook steps only; no category/severity/summary/recommendation.

### Citizen journey
- **D-09:** Self-help guidance appears on the **existing token status page** only (no dedicated post-submit redirect).
- **D-10:** **Adapt workflow steps** for self-help-routed reports — e.g. received → guidance available → resolved (no officer-review step in the self-help path).
- **D-11:** Provide an **escalate CTA** — *"Still need city help?"* moves the report to the government officer queue.
- **D-12:** **Keep the same access token** after escalation; do not issue a new token.

### Officer queue visibility
- **D-13:** **Default officer view shows government-routed reports only**; optional filter chip includes self-help-routed reports.
- **D-14:** Officers have **override actions** on self-help-routed reports — escalate to government and mark resolved.
- **D-15:** Show a **destination badge** (`Self-help` vs `Government`) in the reports table.
- **D-16:** **Keep Phase 8 triage sort** within the government default queue — `manual_review`/`failed` first, then pending/processing, then completed.

### Policy rules and audit
- **D-17:** Policy rules live in an **in-repo TypeScript module** (e.g. `src/server/routing/policy.ts`) with a `ROUTING_POLICY_VERSION` semver constant.
- **D-18:** Persist audit fields on **`reports`**: `routing_destination`, `routing_reason`, `routing_policy_version` (exact column names are planner discretion).
- **D-19:** Store **semver policy version** on every routing decision for Phase 10 reproducibility.
- **D-20:** Execute routing in the **triage worker hook** — immediately after successful triage completion in the same worker pass (no separate routing worker).

### Government vs self-help criteria
- **D-21:** **Always government:** `severity >= 4` **OR** `priority` in (`high`, `critical`).
- **D-22:** **Self-help eligible:** categories `graffiti`, `waste`, `pothole`, `streetlight` **only when** `severity <= 2` and other gates pass.
- **D-23:** `manual_review` / `failed` triage disposition **always routes to government** — never self-help.
- **D-24:** `confidence < 0.65` **routes to government** (aligns with Phase 8 conflicting-signal cap at 0.64).

### Claude's Discretion
- Exact self-help workflow step labels and EN/VI copy.
- Playbook catalog file layout (`src/server/routing/playbooks.ts` vs message keys).
- Filter chip naming and default query param for government-only view.
- Migration column types and RPC updates for escalate/override mutations.
- Whether `routing_reason` is a machine code, human string, or both.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and product
- `.planning/ROADMAP.md` — Phase 9 goal and dependency on Phase 8.
- `.planning/PROJECT.md` — AI advisory-only principle; officers remain decision authority.
- `PRODUCT.md` — Civic clarity, bilingual EN/VI, no AI theater on citizen paths.

### Upstream phase decisions
- `.planning/phases/08-async-triage-platform-refactor/08-CONTEXT.md` — Async triage lifecycle, citizen/officer UX contracts, policy validation, audit tables. Routing explicitly deferred to Phase 9.
- `.planning/phases/08-async-triage-platform-refactor/08-05-SUMMARY.md` — Citizen status and officer table UX ready for routing extension.
- `.planning/notes/async-triage-architecture.md` — Persist-first intake and triage lifecycle (ignore FastAPI/Cloud Tasks deployment sections).

### Triage output contract (routing inputs)
- `prompt/citymind_ai_triage_structured_output_evaluator.json` — Category enum, severity 1–5, priority enum, confidence, `requires_human_review` always true.

### Implementation anchors
- `src/server/services/citizen-status.ts` — `projectCitizenTriageView`, service steps to extend for self-help path.
- `src/server/triage/service.ts` — `runTriageForReport` hook point for post-triage routing.
- `src/components/reports/ReportsTable.tsx`, `ReportsFilters.tsx`, `TriageStatusBadge.tsx` — Officer queue UI extension points.
- `supabase/migrations/20260722120001_async_triage_intake.sql` — `triage_status` lifecycle and claim RPCs.
- `supabase/migrations/20260722120002_async_triage_audit.sql` — `finish_triage_run` report updates.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `projectCitizenTriageView()` in `citizen-status.ts` — central place to branch citizen UX by `routing_destination` and adapt `service_step`.
- `ReportsFilters.tsx` triage_status chips — pattern for adding a `routing_destination` government-only default filter.
- `TriageStatusBadge.tsx` — pattern for a new `RoutingDestinationBadge` component.
- Phase 8 triage worker (`scripts/triage-worker.mjs` + `src/server/triage/service.ts`) — natural hook after `disposition === "completed"`.

### Established Patterns
- Phase 8 hides AI fields until triage completes — extend to hide AI fields entirely on self-help path (D-08).
- Officer default sort elevates `manual_review`/`failed` — preserve for government queue view (D-16).
- Policy validation in `src/server/validation/analysis-policy.ts` — mirror deterministic style for routing policy module.
- Bilingual copy in `messages/en.json` + `messages/vi.json` — use for playbook text and escalate CTA.

### Integration Points
- **Schema:** Add `routing_destination`, `routing_reason`, `routing_policy_version` (+ optional `routed_at`) to `reports`; migration + SQL contract test.
- **Worker:** Call `applyRoutingPolicy(report)` after successful triage in `runTriageForReport`.
- **Citizen API:** Extend `getCitizenStatus` / `projectCitizenTriageView` to return playbook content and adapted steps for self-help.
- **Officer loaders:** Default filter `routing_destination = 'government'`; badge column in `ReportsTable`.
- **Escalate/override:** New RPC or service method to flip `routing_destination` to `government` with audit note in status history.

</code_context>

<specifics>
## Specific Ideas

- Self-help is calm civic guidance — not AI theater. Playbooks should read like a well-run city service FAQ, consistent with PRODUCT.md anti-references.
- Escalate CTA copy direction: *"Still need city help?"* — plain, bilingual, obvious next action.
- Government queue remains the safety net: high severity, high/critical priority, low confidence, and any triage failure always land with officers.

</specifics>

<deferred>
## Deferred Ideas

- **Cloud Tasks triage handler spike** — Phase 8 legacy; skipped during Phase 9 discuss (not relevant to routing).
- **Database-editable self-help CMS** — officers editing playbooks without deploy; future enhancement.
- **AI-personalized self-help guidance** — hybrid static + AI tailoring; rejected for MVP (D-05).
- **Eval suite / shadow rollout** — Phase 10 (TRIAGE-08).

</deferred>

---

*Phase: 09-self-help-vs-government-routing*
*Context gathered: 2026-07-22*
