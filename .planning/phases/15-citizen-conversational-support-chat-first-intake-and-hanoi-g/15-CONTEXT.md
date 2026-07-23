# Phase 15 — Context (planner-synthesized)

**Synthesized:** 2026-07-23  
**Source:** User direction, Phase 15 roadmap entry, prior process analysis, live codebase  
**Discuss-phase:** Not run — decisions locked from user request + existing coach/triage seams

## Goal

Evolve CityMind from **one-shot report form** to **conversational citizen support**: chat-guided intake, Hanoi v5.2 triage + bilingual guidance script delivery, and clear handoff to government/manual procedures when citizens cannot safely self-resolve — while preserving token-scoped status tracking and officer decision authority.

## User intent (locked)

| ID | Decision | Rationale |
|----|----------|-----------|
| **D-15-01** | **Chat-first citizen UX** — primary public flow is conversational support, not only `ReportForm` submit | User: "kinda chatting support citizen, not just normal report" |
| **D-15-02** | Wire **Hanoi v5.2 triage** (`prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json`) as classifier system prompt + 16-key schema | User updated prompts; replaces missing legacy evaluator JSON |
| **D-15-03** | Wire **bilingual guidance catalog** (`prompt/citymind_hanoi_guidance_scripts_v2_bilingual (1).json`) via deterministic `guidance_code` resolver | Scripts are pre-approved; AI outputs code only per v5.2 spec |
| **D-15-04** | **Handling type routing** — type 1 self-guidance → citizen script + optional coach; type 2/3 and `generate_later` → government queue / manual procedures | Matches Hanoi handling model; officers remain authority |
| **D-15-05** | **Preserve access-token privacy** — chat and status remain token-scoped; no citizen accounts | Existing CIT-01..04 contracts |
| **D-15-06** | **AI advisory only** — `requires_human_review` always true; chat cannot change report status or routing without policy paths | Aligns with PROJECT.md core value |
| **D-15-07** | **Build on existing coach stack** — extend `chat_messages`, `citizen-coach`, `CoachPanel` patterns; do not duplicate officer assistant | Phase 11 SHELP already ships post-submit coach |
| **D-15-08** | **Bilingual EN/VI** — locale from report text per Hanoi language routing; UI via next-intl | Existing i18n stack |
| **D-15-09** | **Report still persisted** — conversation culminates in a `reports` row + access token (intake may be chat-collected fields) | Officers need auditable cases |
| **D-15-10** | **Depends on Phase 14** — officer agent console remains audit surface for triage runs/attempts | ROADMAP dependency |

## Claude's Discretion

- Chat entry surface: dedicated `/[locale]/chat` vs enhanced `/report` page vs both with redirect
- Whether intake creates report on first message vs after minimum fields (description + optional location)
- Coach model: reuse triage provider vs separate `AI_COACH_*` env
- Phase gate composition (`phase15:gate`) — vitest + legacy + SQL contract pattern
- Exact number of plans (2–4 waves) within 3-task/plan limit

## Deferred Ideas (OUT OF SCOPE)

- Citizen Supabase accounts / login (ADV-03)
- Officer chat inside citizen thread
- WhatsApp/Zalo external channels
- Autonomous AI status changes without officer action
- Replacing officer dashboard with chat-only ops

## Existing code to extend

| Area | Path |
|------|------|
| Report form (legacy intake) | `src/components/ReportForm.tsx` |
| Coach panel + API | `src/components/coach/CoachPanel.tsx`, `src/server/services/citizen-coach.ts` |
| Chat persistence | `src/server/repositories/chat-messages.ts`, `chat_messages` table |
| Triage engine | `src/server/triage/service.ts`, `openai-compatible.ts` |
| Routing | `src/server/routing/policy.ts` (may extend for handling_type) |
| Success/status UX | `CitizenTriageOutcome`, `SuccessTriagePanel`, `status/page.tsx` |
| Hanoi prompts | `prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json`, `prompt/citymind_hanoi_guidance_scripts_v2_bilingual (1).json` |

## Gaps from prior analysis

- `prompt/citymind_ai_triage_structured_output_evaluator.json` **missing** — Phase 15 replaces with Hanoi v5.2
- No `resolve_guidance()` implementation for script catalog
- No 16-key Zod schema / DB columns for Hanoi classifier output
- Provider may return empty structured content — must gate/fix in Phase 15
