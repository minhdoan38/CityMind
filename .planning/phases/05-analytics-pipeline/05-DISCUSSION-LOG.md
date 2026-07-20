# Phase 5: Analytics Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 05-analytics-pipeline
**Areas discussed:** ETL cadence, Analytics charts, Date-range UX, Public Home stats, Hotspots w/o maps, Privacy boundary
**Mode:** User selected **all** areas and answered **your decision** (agent discretion for every area)

---

## ETL cadence & freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Hourly incremental | Near-real-time warehouse | |
| Daily incremental + manual full reload | Ops-simple MVP freshness | ✓ |
| Weekly full only | Lowest cost, stale analytics | |

**User's choice:** Agent decide  
**Notes:** Locked D-01–D-04 daily cron, incremental default, observable failures.

---

## Analytics tab charts

| Option | Description | Selected |
|--------|-------------|----------|
| Three MVP charts + hotspot list | Volume, category, SLA + ranked list | ✓ |
| Single overview scorecard only | Too thin for ANLY-02/03 | |
| Full BI suite (many widgets) | Scope creep | |

**User's choice:** Agent decide  
**Notes:** D-05–D-07 officer-only `/dashboard/analytics`.

---

## Date-range UX

| Option | Description | Selected |
|--------|-------------|----------|
| Presets 7/30/90 + custom; default 30d | Matches filter URL patterns | ✓ |
| Custom only | Worse UX | |
| Fixed last-30 only | Blocks ANLY-03 spirit | |

**User's choice:** Agent decide  
**Notes:** D-08–D-10 URL `searchParams` persistence.

---

## Public Home stats (Track B)

| Option | Description | Selected |
|--------|-------------|----------|
| Thin optional strip + graceful degrade | ROADMAP optional Track B | ✓ |
| Defer entirely | Valid; user asked ship-capable default | |
| Rich public dashboard | Scope / privacy risk | |

**User's choice:** Agent decide  
**Notes:** D-11–D-13 count/category only; k-anonymity in privacy section.

---

## Hotspots without maps

| Option | Description | Selected |
|--------|-------------|----------|
| Category (and optional area label) ranked list | No MapLibre | ✓ |
| Require map UI now | Belongs Phase 6 | |
| Skip hotspots entirely | Weakens ANLY-02 | |

**User's choice:** Agent decide  
**Notes:** D-14–D-15; lat/lng may land in BQ unused by UI.

---

## Privacy boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Strict exclude tokens/evidence/PII + public k≥3 | Aligns AGENTS.md | ✓ |
| Mirror full ops rows into BQ | Rejected | |
| No public aggregates ever | Conflicts with chosen Track B thin strip | |

**User's choice:** Agent decide  
**Notes:** D-16–D-18.

---

## Outcomes

All six gray areas locked via agent discretion. CONTEXT.md written for `$gsd-plan-phase 5`.
