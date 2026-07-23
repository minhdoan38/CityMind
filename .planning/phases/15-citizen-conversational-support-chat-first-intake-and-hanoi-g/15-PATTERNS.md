# Phase 15: Citizen Conversational Support — Pattern Map

**Mapped:** 2026-07-23  
**Files analyzed:** 28 target new/modified files (from CONTEXT + ROADMAP goal + live codebase)  
**Analogs found:** 24 / 28

## Phase Context

**Goal:** Chat-first citizen conversational support with Hanoi v5.2 triage + bilingual guidance scripts; government handoff when citizens cannot self-resolve.

**Delta from Phase 13:** Phase 13 shipped sync triage on **form submit** (`ReportForm` → `submitReport` → `CitizenTriageOutcome`). Phase 15 makes **conversational intake** the primary `/report` UX, wires **Hanoi v5.2** (16-key schema, no priority fields), and delivers **pre-approved guidance scripts** via deterministic `guidance_code` resolver — replacing the missing legacy evaluator JSON.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/domain/hanoi-analysis.ts` | utility | transform | `src/server/domain/evaluator-analysis.ts` | role-match |
| `src/server/domain/guidance-resolver.ts` | utility | transform | `src/server/routing/playbooks.ts` | role-match |
| `src/server/ai/hanoi.ts` | utility | transform | `src/server/ai/evaluator.ts` | exact |
| `src/server/ai/openai-compatible.ts` (modify) | service | transform | same file (`analyzeStructured`) | exact |
| `src/server/validation/hanoi-policy.ts` | utility | transform | `src/server/validation/evaluator-policy.ts` | role-match |
| `src/server/triage/service.ts` (modify) | service | transform | same file (`runTriageForReport`) | exact |
| `prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json` | config | transform | deleted evaluator JSON | exact |
| `prompt/citymind_hanoi_guidance_scripts_v2_bilingual (1).json` | config | transform | `src/server/routing/playbooks.ts` catalog | role-match |
| `supabase/migrations/*_hanoi_analysis_columns.sql` | migration | CRUD | `20260722160001_evaluator_analysis_columns.sql` | exact |
| `src/server/services/citizen-chat-intake.ts` | service | request-response | `src/server/services/citizen-coach.ts` | exact |
| `src/app/api/public/reports/intake/messages/route.ts` | route | request-response | `src/app/api/public/reports/coach/messages/route.ts` | exact |
| `src/app/api/public/reports/intake/start/route.ts` | route | request-response | `src/app/api/public/reports/route.ts` | role-match |
| `src/app/api/public/reports/intake/submit/route.ts` | route | request-response | `src/server/services/report-service.ts` (`submitReport`) | role-match |
| `src/components/coach/ChatIntakePanel.tsx` | component | request-response | `src/components/coach/CoachPanel.tsx` | exact |
| `src/app/[locale]/report/page.tsx` (modify) | component | request-response | same file | exact |
| `src/components/ReportForm.tsx` (modify) | component | request-response | same file (secondary/legacy link) | exact |
| `src/server/routing/policy.ts` (modify) | utility | transform | same file (`evaluateRoutingPolicy`) | exact |
| `src/server/services/citizen-status.ts` (modify) | service | transform | `projectCitizenTriageView` | exact |
| `src/components/coach/CitizenTriageOutcome.tsx` (modify) | component | request-response | same file | exact |
| `src/components/coach/GuidanceScriptCard.tsx` | component | request-response | `CitizenTriageOutcome` Alert blocks | role-match |
| `src/server/repositories/chat-messages.ts` | repository | CRUD | same file | exact |
| `src/server/services/citizen-chat-intake.test.ts` | test | request-response | `src/server/services/citizen-coach.test.ts` | exact |
| `src/server/domain/guidance-resolver.test.ts` | test | transform | `src/server/validation/evaluator-policy.test.ts` | role-match |
| `tests/chat-intake-contract.test.mjs` | test | batch | `tests/citizen-success-triage.test.mjs` | exact |
| `supabase/tests/15_phase15_contract.sql` | test | batch | `supabase/tests/13_phase13_contract.sql` | role-match |
| `package.json` (`phase15:gate`) | config | batch | `phase13:gate`, `phase14:gate` | exact |
| `messages/en.json`, `messages/vi.json` (modify) | config | transform | `public.coach`, `public.successOutcome` | exact |

## Pattern Assignments

### `src/server/domain/hanoi-analysis.ts` (utility, transform)

**Analog:** `src/server/domain/evaluator-analysis.ts`

**Key differences from 11-key evaluator:**
- 16 keys including `matched_known_issue`, `handling_type`, `handling_label`, `guidance_code`, `critical_alert`, `allowed_actions`, `prohibited_actions`
- `severity` is string enum (`low` | `medium` | `high` | `critical`), not integer 1–5
- No `priority` / `priority_reason` fields
- `confidence` anchored to {0.9, 0.75, 0.55, 0.3}
- Load category/guidance_code enums from Hanoi JSON at module init (same pattern as `loadEvaluatorCategories`)

**Severity projection for legacy columns:**

```typescript
// Map Hanoi severity → reports.severity integer for dashboard/routing compat
const HANOI_SEVERITY_TO_INT = { low: 1, medium: 2, high: 4, critical: 5 } as const;
```

### `src/server/domain/guidance-resolver.ts` (utility, transform)

**Analog:** `src/server/routing/playbooks.ts` + script catalog JSON

**Resolver contract:**

```typescript
export type GuidanceResolution =
  | { status: "script_ready"; script_id: string; text: string; locale: "vi-VN" | "en-US" }
  | { status: "generate_later"; reason: string };

export function resolveGuidanceScript(input: {
  guidance_code: string;
  handling_type: 1 | 2 | 3;
  severity: "low" | "medium" | "high" | "critical";
  report_text: string;
}): GuidanceResolution;
```

**Rules (from catalog `behavior`):**
- `high` / `critical` severity → always `generate_later`
- `guidance_code === "generate_later"` → `generate_later`
- Match script by `guidance_code`; verify `allowed_severity` + `required_handling_type`
- Locale: Vietnamese majority in `report_text` → `vi-VN`, else `en-US` (mirror Hanoi prompt language routing)
- Substitute `{{severity_label}}` from `template_variables`

### `src/server/ai/hanoi.ts` (utility, transform)

**Analog:** `src/server/ai/evaluator.ts`

```typescript
export function loadHanoiConfig(configPath?: string): HanoiConfig;
export function buildHanoiSystemPrompt(configPath?: string): string;
export function getHanoiConfigVersion(configPath?: string): string;
// Default path: prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json
```

### `src/server/services/citizen-chat-intake.ts` (service, request-response)

**Analog:** `src/server/services/citizen-coach.ts`

**Shared patterns to reuse:**
- `CoachAuthSchema` token binding via `hashAccessToken` + `tokenBindsReport`
- `insertChatMessage` / `listChatMessagesByReportId` from `chat-messages` repository
- Rate limiting via `enforceCoachRateLimit` or dedicated `enforceIntakeRateLimit`
- AI health gate via `checkAiHealth` before facilitator replies

**Intake-specific additions:**
- `startIntakeSession()` — creates report row + access token (TRIAGE-01 pattern)
- `handleIntakeMessage()` — persists user/assistant turns; facilitator prompt collects description, location, evidence readiness
- `finalizeIntakeSubmit()` — updates report fields, attaches evidence, calls `dispatchTriageAndWait`, returns `CitizenTriageOutcome` projection

### `src/components/coach/ChatIntakePanel.tsx` (component, request-response)

**Analog:** `src/components/coach/CoachPanel.tsx`

**Reuse:**
- Message list + textarea + send form layout
- `/api/health/ai` probe for `aiDown` state
- Loading/error/sending state machine
- `useTranslations("public.intake")` namespace (new)

**Differences:**
- Calls `/api/public/reports/intake/*` not coach API
- "Submit report" CTA when minimum fields collected (description ≥ 5 chars per D-15-09 discretion)
- Optional location/evidence attachment step before finalize

### `src/server/routing/policy.ts` (utility, transform)

**Analog:** same file — extend `evaluateRoutingPolicy` input

**Hanoi handling_type routing (D-15-04):**

| handling_type | routing_destination | citizen UX |
|---------------|---------------------|------------|
| 1 (SELF_GUIDANCE) + script_ready | `self_help` | Guidance script + optional CoachPanel |
| 2 (TEMPORARY_SAFE_ACTION) | `government` | Queue messaging + report codes |
| 3 (KEEP_AWAY) | `government` | Urgent queue messaging |
| `generate_later` resolution | `government` | Manual review queue copy |

### Phase gate composition

**Analog:** `phase13:gate`, `phase14:gate`

**Proposed `phase15:gate`:**

```
npm run test:unit -- src/server/domain/guidance-resolver.test.ts src/server/services/citizen-chat-intake.test.ts src/server/validation/hanoi-policy.test.ts src/server/ai/openai-compatible.test.ts
&& npm run test:legacy -- tests/chat-intake-contract.test.mjs tests/citizen-success-triage.test.mjs
&& node scripts/run-supabase-sql.mjs -f supabase/tests/15_phase15_contract.sql
```

## Out of Scope (per CONTEXT deferred)

- Officer assistant / agent console changes (Phase 14)
- Shadow eval / TRIAGE-14 migration
- Citizen accounts (ADV-03)
- External channels (WhatsApp/Zalo)

## Cross-Phase Dependencies

| Provides | Phase | Consumed by Phase 15 |
|----------|-------|----------------------|
| `chat_messages` table | Phase 11/13 | Intake + coach message persistence |
| `citizen-coach` token auth | Phase 11 | Intake message auth pattern |
| `dispatchTriageAndWait` | Phase 13 | Finalize submit triage |
| `CitizenTriageOutcome` | Phase 13 | Success page branching |
| Officer agent console | Phase 14 | Audit surface for Hanoi triage runs (read-only, no changes) |
