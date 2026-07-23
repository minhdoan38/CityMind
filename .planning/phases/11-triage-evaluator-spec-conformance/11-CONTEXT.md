# Phase 11: Triage Spec & Guided Self-Help - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the gap between the evaluator spec and live triage runtime, then deliver **guided self-help**: citizens who land on easy (`self_help`) paths get a **conversational coach AI** on success and status pages; hard cases stay on the **government** path. Officers get **AI health visibility** and **quick triage** actions. Self-hosted laptop stack only — no Cloud Tasks / Cloud Run.

</domain>

<decisions>
## Implementation Decisions

### Coach UX (citizen)

- **D-01:** Coach chat on **both** success page and status page — citizen can start on success after triage completes and **resume** on status with the same token-scoped thread.
- **D-02:** **Wait on success page** — poll triage until `completed` or `failed`, then branch UI (do not redirect immediately to status for routing).
- **D-03:** **Persist coach messages in Postgres** — report-scoped `chat_messages` (or equivalent); survives refresh and status-page resume; audit-friendly.
- **D-04:** **Government path** — when `routing_destination=government`, triage `failed`/`manual_review`, or hard routing signals: show government-queue messaging; **no coach-first** panel. Escalate CTA remains available on status (Phase 9).
- **D-05:** When **`GET /api/health/ai`** is `down`, coach UI is **disabled** with calm warning; ID/token copy and status link still work.

### Coach vs triage AI

- **D-06:** **Same provider config** — use `AI_MODEL`, `AI_BASE_URL`, `THIRD_PARTY_API_KEY` for both roles; **separate system prompts** (triage = 11-key evaluator JSON; coach = conversational self-help grounded in report + playbook).
- **D-07:** Coach must **not contradict** routing or triage output; advisory only; cannot change report status or routing.

### AI health & triage dispatch

- **D-08:** **`GET /api/health/ai`** — lightweight minimal JSON completion probe (not full smoke suite); returns `up`/`degraded`/`down`, latency, model id; no secrets.
- **D-09:** **Push-primary triage** — intake enqueues via authenticated `POST /internal/triage/{report_id}`; existing **poll worker remains fallback** safety net for stuck `pending` rows.
- **D-10:** Dashboard **AI status chip** consumes `/api/health/ai` (green/amber/red).

### Evaluator schema & policy (Tracks A–B)

- **D-11:** **Dual-read adapter** during migration — persist 11-key evaluator shape; UI/services read through adapter mapping legacy columns until full cutover; avoid big-bang breakage.
- **D-12:** Wire **`prompt/citymind_ai_triage_structured_output_evaluator.json`** as triage prompt + Zod source of truth (11 keys, 10 categories).
- **D-13:** Policy must enforce **`critical` requires `severity == 5`** and evaluator `policy_assertions` (not legacy min-severity-4 for critical).

### API compatibility

- **D-14:** **`POST /api/public/reports/analyze`** stays **410 Gone** — document intake path; no compatibility shim in Phase 11.

### Officer quick actions (Track H)

- **D-15:** **Per-row** “Run triage now” for `pending` / `failed` / `retry` — calls internal triage dispatch.
- **D-16:** **Bulk retry** for selected failed/pending rows on dashboard table.

### Claude's Discretion

- Exact `chat_messages` schema, polling interval on success page, coach message rate limits, and dual-read adapter field mapping — planner/researcher to propose within D-03/D-11 constraints.
- EN/VI copy tone for coach vs government branches — follow existing `messages/en.json` / `vi.json` patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Triage evaluator spec
- `prompt/citymind_ai_triage_structured_output_evaluator.json` — 11-key schema, system prompt, policy assertions, eval thresholds
- `.planning/codebase/ai-logic.md` — current runtime flow (async intake, worker, routing, shadow)
- `.planning/phases/11-triage-evaluator-spec-conformance/11-GAP-ANALYSIS.md` — gap table vs implemented

### Phase 9 routing & citizen flows (building blocks)
- `src/server/routing/policy.ts` — self_help vs government rules
- `src/server/routing/playbooks.ts` — static playbook ids
- `src/app/[locale]/status/page.tsx` — service_step, playbook UI, escalate
- `src/app/[locale]/report/success/page.tsx` — current success page (ID/token only)
- `src/server/services/citizen-escalate.ts` — escalate API

### AI provider & health
- `src/server/ai/openai-compatible.ts` — triage adapter (extend for evaluator prompt)
- `src/server/health/readiness.ts` — pattern for `/api/ready`; AI health is separate route per D-08
- `scripts/smoke-ai.mjs` — reference for provider contract (not used per-request for health)

### Officer dashboard
- `src/components/reports/ReportsTable.tsx` — row actions, triage badges
- `src/server/triage/service.ts` — `runTriageForReport` hook for internal dispatch
- `src/app/dashboard/page.tsx` — header area for AI chip

### Requirements
- `.planning/REQUIREMENTS.md` — TRIAGE-09…14, SHELP-01…05, OPS-01, DASH-09

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Status page** (`status/page.tsx`) — already branches `self_help_guidance` vs government; playbook steps; escalate CTA — extend with coach panel resume.
- **Success page** — sessionStorage flash for `reportId` + `accessToken`; add triage polling + coach embed.
- **Routing** — `evaluateRoutingPolicy` + `applyRoutingForReport` post-triage; coach only when `self_help` + `completed`.
- **Escalate** — `POST /api/public/reports/escalate` + `citizen-escalate.ts` already implemented.
- **Readiness** — `checkReadiness()` pattern for Supabase; mirror for AI probe.
- **Triage worker** — `scripts/triage-worker.mjs` + `claim.ts` — keep as fallback after push dispatch.

### Established Patterns
- Token-scoped citizen APIs (status, escalate) — coach API must match hash-verify pattern.
- Bilingual `next-intl` catalogs under `messages/en.json`, `messages/vi.json`.
- Officer actions via API routes + `requireOfficerContext`.
- SSE parsing in `openai-compatible.ts` for 9router-style responses.

### Integration Points
- Intake (`report-service.ts`) → enqueue internal triage after `create_intake_report_with_access_token`.
- Success/status UI → poll citizen status projection or lightweight triage+routing endpoint.
- Dashboard table → new row action + bulk selection calling internal triage route.
- DB migration → 11-key columns + `chat_messages` table + dual-read view/adapter in repositories.

</code_context>

<specifics>
## Specific Ideas

- User wants success page where citizens **chat with AI for easy problems**; **hard problems transfer to government** (aligns with Phase 9 routing + new coach).
- **Ping** whether AI model is ready before offering coach / showing dashboard green state.
- **Quick button on dashboard** to run triage without waiting for poll worker.
- Current dev AI: `mmf/mimo-auto` via `https://9router.minhmice.com/v1` — same endpoint for coach per D-06.

</specifics>

<deferred>
## Deferred Ideas

- **WebSocket streaming coach** — polling/SSE acceptable for Phase 11 (per ROADMAP out of scope).
- **Officer coach preview** — optional; not selected in discussion; defer unless planner finds low cost.
- **Separate coach model** — user chose same endpoint; revisit if latency/cost issues in eval.
- **`/analyze` compatibility shim** — explicitly rejected (D-14).

</deferred>

---

*Phase: 11-triage-evaluator-spec-conformance*
*Context gathered: 2026-07-22*
