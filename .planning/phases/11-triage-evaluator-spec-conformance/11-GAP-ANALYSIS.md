# Phase 11 — Gap Analysis

**Sources:** `prompt/citymind_ai_triage_structured_output_evaluator.json`, `.planning/codebase/ai-logic.md`, Phase 9 routing  
**Updated:** 2026-07-22

## A. Triage runtime vs evaluator spec

| # | Area | Expected | Implemented | Severity |
|---|------|----------|-------------|----------|
| A1 | Triage runner | Push `POST /internal/triage/{report_id}` | DB poll worker every 5s | High |
| A2 | Output schema | 11-key evaluator JSON | Legacy 9-field `ReportAnalysis` | High |
| A3 | Policy | `critical` requires `severity == 5` | `critical` min severity 4 | High |
| A4 | Categories | 10 evaluator enums | Prompt 6 / Zod 7 | Medium |
| A5 | `/analyze` compat | Temporary shim or documented 410 | 410 Gone | Low |

## B. UX contracts (unverified)

| # | Area | Expected | Implemented | Severity |
|---|------|----------|-------------|----------|
| B1 | Citizen `failed` copy | Calm, no provider leakage | Phase 8 claim; not contract-tested | Medium |
| B2 | Officer elevation | `failed` / `manual_review` in `triage_bucket` | Sort exists; elevation unproven | Medium |
| B3 | Default sort | SLA / oldest-first within bucket | `triage_bucket` asc default | Low |

## C. Guided self-help (new — user request 2026-07-22)

| # | Area | Expected | Implemented | Severity |
|---|------|----------|-------------|----------|
| C1 | Success page coach | After triage, self_help citizens get **AI chat** to solve easy problems | Success page = ID/token copy only | **High** |
| C2 | Hard → government | Government path clear; no coach-first for hard cases | Routing exists; success UX doesn't branch | **High** |
| C3 | Easy vs hard UX | Branching UI on success + status by `routing_destination` + triage state | Static playbooks on status only (Phase 9) | Medium |
| C4 | Coach AI separation | Conversational coach (advisory) distinct from structured triage | Single triage path only | Medium |
| C5 | Token-scoped chat API | Citizen chat bounded to report + access token | Not implemented | High |

## D. Operations & officer tools (new)

| # | Area | Expected | Implemented | Severity |
|---|------|----------|-------------|----------|
| D1 | AI readiness ping | Probe triage model ready (`/api/health/ai` or `/api/ready`) | `/api/ready` checks Supabase only | **High** |
| D2 | Dashboard AI status | Visible chip/badge from ping | None | Medium |
| D3 | Quick triage button | Officer triggers triage for pending/failed report | None; must wait for worker | **High** |
| D4 | Disable chat when AI down | Success/status coach gated on health | N/A | Medium |

## Suggested tracks (`/gsd-plan-phase 11`)

| Track | Scope |
|-------|--------|
| **A** | 11-key schema + evaluator prompt + DB migration + read adapter |
| **B** | Policy assertions from evaluator JSON; fix critical/severity rules |
| **C** | Internal triage push route + intake enqueue + officer “Run triage now” |
| **D** | UX contract tests (failed copy, triage_bucket, sort) |
| **E** | `/analyze` shim decision + sunset |
| **F** | **AI health ping** — extend readiness; dashboard + success page consumers |
| **G** | **Self-help coach** — token-scoped chat API, success/status branching UI, EN/VI |
| **H** | **Dashboard quick actions** — AI status chip, per-row triage trigger, self-help indicators |

**Wave suggestion:** A+B (schema) → C (dispatch) → F (health) → G+H (UX) in parallel after routing contract stable.
