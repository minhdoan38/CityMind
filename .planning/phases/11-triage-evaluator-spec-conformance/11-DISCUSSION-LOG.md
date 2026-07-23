# Phase 11 Discussion Log

**Date:** 2026-07-22  
**Mode:** Interactive discuss (all gray areas selected)

## Pre-discussion

- Draft `11-CONTEXT.md` existed (vision doc) — **updated** with locked decisions.
- No SPEC.md; requirements from ROADMAP + REQUIREMENTS.md + gap analysis.

## Areas discussed

### Coach UX

| Question | Options | Decision |
|----------|---------|----------|
| Coach placement | success only / status only / both | **Both** — success after submit, resume on status |
| Branch timing | wait on success / redirect status / hybrid | **Wait on success** — poll triage, then branch |
| Chat persistence | Postgres / ephemeral / sessionStorage | **Postgres** — report-scoped messages |

### AI ops

| Question | Options | Decision |
|----------|---------|----------|
| Coach vs triage model | same default / separate env / same endpoint different model | **Same model + endpoint**, separate coach prompt |
| AI health | lightweight / extend ready / full smoke | **Lightweight** `GET /api/health/ai` |
| Triage dispatch | push only / push+poll fallback / poll primary | **Push primary + poll fallback** |

### Schema & officer

| Question | Options | Decision |
|----------|---------|----------|
| 11-key migration | big-bang / dual-read / parallel columns | **Dual-read adapter** |
| `/analyze` compat | keep 410 / shim flag / shim sunset | **Keep 410 Gone** |
| Officer actions | row only / row+detail / row+bulk | **Row + bulk** retry |

## Deferred

- WebSocket streaming coach
- Officer coach preview
- `/analyze` shim
