# Phase 15 — Research (planner-synthesized)

**Researched:** 2026-07-23  
**Source:** Live codebase, Hanoi prompt JSONs, Phase 11–14 patterns, CONTEXT locked decisions  
**Depth:** Standard (Level 1 — no new external dependencies)

## Summary

Phase 15 replaces the **missing** `citymind_ai_triage_structured_output_evaluator.json` with **Hanoi v5.2** and adds **chat-first intake** atop existing coach/triage seams. The highest-risk work is schema migration (string severity + 16 keys) and deterministic script delivery — not new infrastructure.

**Primary recommendation:** Three implementation waves — (W1) Hanoi classifier + resolver + triage wiring, (W2) chat intake API/service, (W3) citizen UX + handling_type routing + `phase15:gate`.

---

## Standard Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Classifier config | `prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json` | User-locked D-15-02; 16-key schema, config_version 5.2.0 |
| Script catalog | `prompt/citymind_hanoi_guidance_scripts_v2_bilingual (1).json` | User-locked D-15-03; deterministic resolver |
| Validation | Zod strict schema + `hanoi-policy.ts` | Matches Phase 11 evaluator-policy pattern |
| Chat persistence | Existing `chat_messages` table | D-15-07 — extend, don't duplicate |
| Intake auth | Access token hash (same as coach/status) | D-15-05 token-scoped privacy |
| UI | `ChatIntakePanel` on `/[locale]/report` | D-15-01 chat-first; legacy `ReportForm` as secondary link |
| Triage dispatch | `dispatchTriageAndWait` on finalize | Phase 13 sync-primary pattern |

**No new npm packages required.**

---

## Hanoi Schema Migration

### Current state

- `evaluator-analysis.ts` loads **deleted** evaluator JSON → runtime failure on import
- `openai-compatible.ts` uses `EvaluatorAnalysisSchema` (11-key, integer severity, priority fields)
- `reports` table has evaluator columns from migration `20260722160001` but **no** Hanoi-specific fields

### Target state (16-key persistence boundary)

**New domain module:** `src/server/domain/hanoi-analysis.ts`

| Hanoi field | DB column (additive migration) | Notes |
|-------------|-------------------------------|-------|
| `category` | existing `category` | Same 10 categories |
| `matched_known_issue` | `matched_known_issue BOOLEAN` | New |
| `observed_facts` | existing `observed_facts JSONB` | Reuse |
| `inferences` | existing `inferences JSONB` | Reuse |
| `unknowns` | existing `unknowns JSONB` | Reuse |
| `severity` (string) | `severity_label TEXT` + mapped `severity INT` | Project string→int for dashboard |
| `severity_reason` | existing | Reuse |
| `confidence` | existing `confidence` | Anchored enum values |
| `handling_type` | `handling_type SMALLINT` | 1/2/3 |
| `handling_label` | `handling_label TEXT` | Enum string |
| `allowed_actions` | `allowed_actions JSONB` | New |
| `prohibited_actions` | `prohibited_actions JSONB` | New |
| `recommended_action` | existing | Reuse |
| `guidance_code` | `guidance_code TEXT` | New |
| `critical_alert` | `critical_alert BOOLEAN` | New |
| `requires_human_review` | existing | Always true |
| `output_language` | `output_language TEXT` | Derived at resolve time, optional persist |

**Legacy projection:** `analysis-projection.ts` gains `projectHanoiAnalysis()` for officer dashboard backward compat (summary ← observed_facts[0], priority deprecated → derive from severity_label).

### Provider empty-content fix

**Observed risk:** OpenAI-compatible providers may return empty `choices[0].message.content`.

**Mitigation (D-15-02):** In `analyzeStructured`, treat null/empty/refusal content as `AnalysisProviderError` code `invalid_response` before JSON parse — triggers retry/manual_review, never silent empty persist.

---

## Guidance Resolver Design

### Resolution algorithm

1. If `severity` is `high` or `critical` → `{ status: "generate_later", reason: "high_and_critical" }`
2. If `guidance_code === "generate_later"` → `{ status: "generate_later", reason: "explicit_code" }`
3. Find script in catalog where `guidance_code` matches
4. Verify `allowed_severity` includes current severity AND `required_handling_type` matches
5. Select locale via report_text language routing (vi-VN majority → vi, else en-US)
6. Interpolate `{{severity_label}}` from `template_variables`
7. Return `{ status: "script_ready", script_id, text, locale }`

### Fail-closed rules

- No nearest-match (`allow_nearest_match: false` in catalog)
- Incompatible handling_type → `generate_later`
- Missing script entry → `generate_later`

**Unit test matrix:** at least self_collect_safe_litter (type 1 low), report_road_damage (type 2 medium), generate_later (high), locale vi/en parity.

---

## Chat Intake UX Options

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| A. Dedicated `/[locale]/chat` route | Clean URL | Extra nav surface | **Rejected** — keep `/report` as entry |
| B. Chat-first `/report` + legacy form link | D-15-01 primary flow; minimal route churn | Page layout change | **SELECTED** |
| C. Replace ReportForm entirely | Simplest surface | Breaks PUB-03 form tests | **Rejected** — keep form as fallback |

### Session lifecycle (resolved)

**RESOLVED:** Create report + access token on **first user message** via `POST /api/public/reports/intake/start` (TRIAGE-01 immediate ID). Facilitator chat persists to `chat_messages` immediately. Finalize via `POST /api/public/reports/intake/submit` when description ≥ 5 chars (and optional location/evidence). Token issued at start enables token-scoped message API without citizen accounts (D-15-05, D-15-09).

### Facilitator model (resolved)

**RESOLVED:** Reuse triage provider env (`AI_BASE_URL`, `AI_MODEL`) for intake facilitator with a **distinct system prompt** (collect fields, no triage classification). Post-submit coach remains on `AI_COACH_*` per SHELP-03.

---

## Handling Type Routing

Extend `evaluateRoutingPolicy` to accept Hanoi fields:

```typescript
evaluateRoutingPolicy({
  triageStatus,
  handling_type,      // 1 | 2 | 3 | null
  guidance_resolution, // script_ready | generate_later
  critical_alert,
  // legacy fallbacks: category, severity, priority, confidence
})
```

**Routing matrix (D-15-04):**

- `handling_type === 1` AND `guidance_resolution === script_ready` → `self_help`
- `handling_type === 2` OR `3` → `government`
- `generate_later` → `government` (reason: `guidance_pending`)
- `critical_alert === true` → `government` (reason: `critical_alert`)
- Fallback to legacy category/severity rules for pre-Hanoi rows

Update `projectCitizenTriageView` to include `guidance_script` (resolved text) and `guidance_status` in citizen-safe response when `service_step === self_help_guidance`.

---

## Open Questions (all RESOLVED inline)

| Question | Resolution |
|----------|------------|
| Chat entry surface? | Enhanced `/[locale]/report` with `ChatIntakePanel` primary; "Use classic form" link to `ReportForm` |
| When to create report? | First user message → `intake/start` creates row + token |
| Facilitator vs coach model? | Facilitator = triage provider; coach = `AI_COACH_*` |
| Supersede TRIAGE-09..11? | **TRIAGE-15** covers Hanoi v5.2 for Phase 15; TRIAGE-09..11 remain pending for eval/shadow alignment (out of Phase 15 scope) |
| phase15:gate composition? | vitest (resolver + intake + hanoi-policy) + legacy contracts + SQL Hanoi columns |
| File name for Hanoi JSON? | Keep literal filename `citymind_ai_hanoi_triage_guidance_v5_2 (1).json`; add constant `HANOI_PROMPT_PATH` in `hanoi.ts` |

---

## Package Legitimacy Audit

No new packages. N/A.

---

## Architectural Responsibility Map

| Tier | Module | Responsibility |
|------|--------|----------------|
| Domain | `hanoi-analysis.ts`, `guidance-resolver.ts` | Pure schema + script resolution |
| AI | `hanoi.ts`, `openai-compatible.ts` | Provider call + parse |
| Validation | `hanoi-policy.ts` | Post-schema policy (handling/severity mapping, critical_alert) |
| Service | `citizen-chat-intake.ts`, `triage/service.ts` | Orchestration |
| API | `intake/start`, `intake/messages`, `intake/submit` | HTTP boundary |
| UI | `ChatIntakePanel`, `CitizenTriageOutcome` | Citizen-facing |
| Routing | `policy.ts`, `citizen-status.ts` | handling_type → destination |

---

## Pitfalls

1. **Import-time crash** — `evaluator-analysis.ts` reads deleted JSON; Wave 1 must switch triage to Hanoi config before any intake finalize calls triage.
2. **Severity type mismatch** — Hanoi string vs dashboard integer; always persist both `severity_label` and mapped `severity`.
3. **Script leakage** — Never expose raw triage JSON to citizens; only resolved script text + allowed/prohibited actions summary.
4. **Token scope** — Intake messages API must reject cross-report tokens (copy coach auth tests).
5. **Empty provider response** — Gate before Zod parse; disposition `manual_review` not `completed`.
