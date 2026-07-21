---
title: Async Triage Architecture Decisions
date: 2026-07-21
context: GSD explore session — persist-first intake, async AI triage, officer/citizen contracts
source: /gsd-explore
status: locked
---

# Async Triage Architecture Decisions

> **Core principle:** Persist report first, triage second. AI failure must never lose a citizen submission. AI assists intake; it never gates officer visibility.

## Problem (current state)

`POST /api/v1/reports/analyze` is synchronous and all-or-nothing:

1. Validate → upload image → urban context → Gemini → insert → issue token
2. Any Gemini/GCS/DB failure → **502**, citizen loses submission
3. No `triage_status`, audit trail, semantic validation, or retry semantics
4. Officers only see reports after successful AI analysis

See `.planning/codebase/ai-logic.md` for current pipeline documentation.

---

## Phase 7 scope — Intake / triage split

### New intake flow

```text
POST /reports
→ validate input
→ upload image
→ insert report (intake_status=received, triage_status=pending)
→ enqueue triage task (deployed) OR BackgroundTasks (local)
→ return ReportSubmissionResponse immediately
```

### New response DTO

Do **not** preserve full `AnalyzeResponse` on the new endpoint — category/severity may not exist yet.

```json
{
  "report_id": "...",
  "access_token": "...",
  "intake_status": "received",
  "triage_status": "pending"
}
```

- `access_token` issued on successful persistence — token = report ownership, not AI output
- Keep `POST /analyze` + `AnalyzeResponse` temporarily for backward compatibility

### New report fields

| Field | Values |
|-------|--------|
| `triage_status` | `pending` \| `processing` \| `completed` \| `failed` \| `manual_review` |
| `triage_error` | Internal only — never exposed to citizens |
| `triaged_at` | Timestamp when triage reached terminal state |

---

## Triage module layout

```text
backend/app/triage/
├── service.py
├── config_loader.py
├── schemas.py
├── validators/
│   ├── schema.py
│   └── policy.py
├── providers/
│   ├── base.py
│   └── gemini.py
└── audit.py
```

- JSON contract: **11 keys**, no repair, one retry, `human_review` always possible
- Semantic validation (code rules): critical ↔ severity 5, evidence for immediate danger, conflict → confidence ≤ 0.64, unsupported claims → `manual_review`

---

## Processing mechanism

| Environment | Runner |
|-------------|--------|
| **Local dev** | `FastAPI BackgroundTasks` |
| **Deployed (Cloud Run)** | **Cloud Tasks** → authenticated `POST /internal/triage/{report_id}` |
| **Safety net** | Reconciliation sweep for stuck `pending`/`processing` (not primary runner) |

**Production flow:**

```text
POST /reports
→ persist report + triage_status=pending
→ enqueue Cloud Task
→ return access_token
→ task calls POST /internal/triage/{report_id}
→ claim idempotently
→ analyze
→ completed | manual_review
```

**Hard rule:** deployed environment must **refuse** BackgroundTasks-only configuration.

Requirements: idempotency, timeout, retry, dead-letter → `manual_review` or `failed` with audit.

---

## Citizen status UX (B + C)

**MVP workflow labels** (service language, not infrastructure):

```text
received → AI review pending → under officer review → resolved/rejected
```

| `triage_status` | Citizen sees | Hidden |
|-----------------|--------------|--------|
| `pending` / `processing` | Report received, workflow step, timestamp, reference ID | category, severity, priority, confidence |
| `completed` | Above + analysis fields progressively revealed | — |
| `failed` | *"Automated review is unavailable. Your report is saved and will be reviewed by an officer."* | All AI fields |

**Never expose:** provider errors, retries, safety blocks, stack traces.

---

## Officer queue UX

Reports appear in the **default officer list immediately**.

| `triage_status` | Visibility | Display |
|-----------------|------------|---------|
| `pending` / `processing` | Default queue | **AI pending** badge |
| `failed` / `manual_review` | Default queue, **elevated** | Above normal pending |
| `completed` | Default queue | category, severity, priority |

- Missing AI fields remain **NULL** — never invent fallback values
- Default sort: `manual_review`/`failed` first → oldest received (or SLA deadline)
- Filter by `triage_status`

### Officer detail display order (Phase 7 UI)

1. Citizen description / image
2. AI status badge
3. Observed facts (`evidence`)
4. Unknowns (`uncertainty`)
5. Severity / priority
6. Officer decision controls

- Remove confidence **percentage** until calibrated
- Show *"model confidence — uncalibrated"* temporarily if shown at all

---

## Audit tables

```text
triage_runs
triage_attempts
```

Store: model, prompt version, config version, raw output, safety block reason, latency, validation errors, retry output, final disposition.

---

## Evaluation suite (Phase 9 input)

`backend/evals/`:

- Expert-labelled EN/VI dataset
- Category macro-F1, severity agreement
- Critical under-triage rate
- Hallucination / grounding checks
- Injection tests, safety-block tests
- Outage report-loss test (intake survives AI failure)
- Consistency repetitions

**Rollout gate:** new model must beat baseline on under-triage, grounding, EN/VI parity, and failure rate before production swap.

---

## Roadmap placement

| Phase | Name |
|-------|------|
| **7** | Async triage platform refactor |
| **8** | Self-help vs government routing |
| **9** | Shadow rollout and production evaluation |

---

## Related requirements

TRIAGE-01 through TRIAGE-08 in `.planning/REQUIREMENTS.md`.

---

*Exploration locked 2026-07-21. Proceed with `/gsd-discuss-phase 7` or spike todo before planning.*
