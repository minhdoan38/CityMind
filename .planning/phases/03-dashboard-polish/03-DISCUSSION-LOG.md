# Phase 3: Dashboard Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 3-Dashboard Polish
**Areas discussed:** Table & columns, Filter chrome, Resolve / reject flow, Export packaging, Detail page hierarchy

---

## Table & columns

| Option | Description | Selected |
|--------|-------------|----------|
| Lean ops | ID, created, category, priority, status, short summary | ✓ (agent) |
| Ops + severity | Lean ops plus severity visible by default | |
| Wide default | Many columns on; hide what isn’t needed | |
| You decide | Agent picks | ✓ (user mandate) |

**User's choice:** Discuss all areas; agent decides everything; write CONTEXT without further questions.
**Notes:** Locked D-01–D-05 in CONTEXT.md (lean defaults, compact table, row→detail, cursor pagination, client-only column prefs).

---

## Filter chrome

| Option | Description | Selected |
|--------|-------------|----------|
| Side panel | Permanent left filter rail | |
| Top toolbar + collapsible advanced | Above table; Clear filters | ✓ (agent) |
| Sheet/drawer only | Filters open on demand | |
| You decide | Agent picks | ✓ (user mandate) |

**User's choice:** Agent decide all.
**Notes:** Locked D-06–D-09 (collapsible above table, DASH-03 filters, filtered metrics, URL sync).

---

## Resolve / reject flow

| Option | Description | Selected |
|--------|-------------|----------|
| Detail-only + required note | Modal/confirm on detail; no table inline | ✓ (agent) |
| Table row actions too | Resolve from list | |
| Note optional for all statuses | | |
| You decide | Agent picks | ✓ (user mandate) |

**User's choice:** Agent decide all.
**Notes:** Locked D-10–D-14; extends existing `StatusActions` (currently note-less).

---

## Export packaging

| Option | Description | Selected |
|--------|-------------|----------|
| CSV only | | |
| Excel only | | |
| Both CSV + Excel, filtered set | Streaming; lean+ columns | ✓ (agent) |
| You decide | Agent picks | ✓ (user mandate) |

**User's choice:** Agent decide all.
**Notes:** Locked D-15–D-18; sidebar Export deep-links to same Reports export affordance.

---

## Detail page hierarchy

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence → AI → context → timeline → actions | Advisory AI labeled | ✓ (agent) |
| AI-first above evidence | | |
| Timeline-first | | |
| You decide | Agent picks | ✓ (user mandate) |

**User's choice:** Agent decide all.
**Notes:** Locked D-19–D-22; newest-first timeline; DASH-07 states.

---

## the agent's Discretion

- Entire decision set delegated by user after selecting all gray areas
- Library choices (table, Excel), page size, dialog vs sheet for confirm left to planner/executor within locked behaviors

## Deferred Ideas

- DASH-08 status link (Phase 4), maps (Phase 6), Phase 7 triage, notifications, bulk resolve
