---
title: Spike Cloud Tasks triage handler on Cloud Run
date: 2026-07-21
priority: high
phase: 7
context: .planning/notes/async-triage-architecture.md
status: pending
---

# Spike: Cloud Tasks → authenticated internal triage handler

## Goal

Prove the Phase 7 production runner path before full triage module implementation:

```text
POST /reports (stub or minimal persist)
→ enqueue Cloud Task
→ POST /internal/triage/{report_id} (OIDC-authenticated)
→ idempotent claim (triage_status pending → processing)
→ stub analyze (sleep or mock)
→ triage_status completed | manual_review
```

## Success criteria

- [ ] Cloud Task created from FastAPI after report persist
- [ ] Internal handler rejects unauthenticated requests (no public access)
- [ ] OIDC / service-account auth validated on Cloud Run ingress
- [ ] Idempotent claim: duplicate task delivery does not double-analyze
- [ ] Task retry on transient failure; terminal state on exhaustion → `manual_review`
- [ ] Deployed config flag rejects `BackgroundTasks`-only mode
- [ ] Reconciliation sweep design documented (stuck `processing` > N min)

## Out of scope for spike

- Full 11-key Gemini contract
- Semantic policy validators
- `triage_runs` / `triage_attempts` tables (note schema intent only)
- Citizen/officer UI changes

## Deliverables

1. Spike branch or spike doc in `.planning/phases/07-async-triage-platform/07-SPIKE-cloud-tasks.md`
2. Go/no-go on Cloud Tasks vs alternatives for CityMind Cloud Run deployment
3. Estimated IAM + queue + handler wiring checklist for planner

## References

- `.planning/notes/async-triage-architecture.md`
- TRIAGE-05, TRIAGE-06 in `.planning/REQUIREMENTS.md`
- Current analyze path: `backend/app/api/reports.py::analyze_report`

## Invoke

`/gsd-spike` or `/gsd-plan-phase 7` after spike completes.
