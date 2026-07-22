# Phase 14: Officer agent console — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `14-CONTEXT.md`.

**Date:** 2026-07-22
**Phase:** 14-officer-agent-console-per-case-triage-run-and-attempt-log-vi
**Areas discussed:** Phase scope, Log presentation, Case discovery, Audit depth

---

## Phase scope

| Option | Description | Selected |
|--------|-------------|----------|
| Hardening only | Lock requirements, UI-SPEC, phase14:gate, contracts, polish existing viewer. No new officer actions. | ✓ |
| Harden + small UX wins | Hardening plus structured display and better filters — still read-only. | |
| Expand capabilities | Re-run triage, export logs, shadow diff panel — larger scope. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full phase gate | Vitest + legacy contract + SQL gate (`phase14:gate`) | ✓ |
| Tests only | Vitest + legacy; no SQL contract | |
| UAT checklist only | Manual gate | |

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone console only | Deep-link from report detail; no embedded log | ✓ |
| Embedded mini-log on detail | Collapsed section on report detail | |
| Sheet from table/preview | Slide-over from reports table | |

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop-first | Mobile best-effort | ✓ |
| Fully responsive | Tablet/phone required | |
| Desktop-only | Hide below lg | |

**User's choice:** Hardening only; full phase gate; standalone console; desktop-first.

---

## Log presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Raw output primary | Monospace raw_output; expand for full JSON | ✓ |
| Structured fields primary | Parsed 11-key rows; raw behind toggle | |
| Hybrid | Summary chips + raw below | |

| Option | Description | Selected |
|--------|-------------|----------|
| Prominent validation block | Warn pre block before raw output | ✓ |
| Compact | Badge + expand | |
| Separate tab | Policy failures tab per attempt | |

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated preview + expand | ~320 chars + Show full output | ✓ |
| Always show full output | Scroll in panel | |
| Collapsed attempts by default | Expand one at a time | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current metadata row | Timestamp, attempt #, model, latency, disposition | ✓ |
| Add prompt_version | Extra header fields | |
| Minimal header | Timestamp + disposition only | |

**User's choice:** Raw primary; prominent validation; truncate+expand; current metadata row.

---

## Case discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Report ID filter + recent feed | Optional filter; unfiltered = latest 50 runs | ✓ |
| Report ID required | Empty until filtered | |
| Recent feed + status/date filters | Extra filters | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show recent cases on load | Last 50 runs when unfiltered | ✓ |
| Empty until filtered | Prompt for report ID | |
| Default failed/manual_review only | Filtered default view | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar + report detail link | Current entry points only | ✓ |
| Add context menu | Reports table row menu | |
| Quick-preview tab | Tab in ReportQuickPreviewSheet | |

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated ID in list | Full ID in log header | ✓ |
| Full report ID in list | break-all UUID | |
| Description-first labels | ID secondary | |

**User's choice:** ID filter + recent feed; recent on load; sidebar + detail link; truncated list IDs.

---

## Audit depth

| Option | Description | Selected |
|--------|-------------|----------|
| Triage runs/attempts only | No shadow diff panel | ✓ |
| Include shadow comparison panel | Baseline vs candidate | |
| run_kind badge only | Production vs shadow label | |

| Option | Description | Selected |
|--------|-------------|----------|
| Admin client + officer API gate | Current pattern | ✓ |
| Officer RLS on audit tables | New policies | |
| Postgres views + officer JWT | No admin client | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 50-run cap | Document truncation in UI | ✓ |
| Add pagination | Load more / cursor API | |
| Raise limit to 200 | Console-only cap increase | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep triage and assistant separate | Phase 12 widget stays separate | ✓ |
| Unified page with tabs | Triage + assistant | |
| Cross-link only | Mention assistant on detail | |

**User's choice:** Triage-only audit; admin+gate; 50-run cap; separate from assistant chat.

---

## Claude's Discretion

- UI-SPEC polish within existing `AgentConsoleViewer`
- REQUIREMENTS traceability ID (`DASH-11` proposal)
- Human UAT checklist format in `14-VALIDATION.md`
- SQL contract scope for `phase14:gate`

## Deferred Ideas

See `14-CONTEXT.md` `<deferred>` — shadow panel, re-run, export, embedded log, extra entry points, pagination, RLS, unified assistant page.
