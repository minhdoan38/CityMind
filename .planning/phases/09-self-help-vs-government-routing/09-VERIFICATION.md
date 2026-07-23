---
phase: 09-self-help-vs-government-routing
verified: 2026-07-22
status: passed
---

# Phase 9 Verification

## Goal (from CONTEXT)

After async triage completes, deterministically route reports to self-help guidance or the government officer queue; citizens see playbooks and can escalate; officers see government-default queue with badges and overrides.

## Automated Gates

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `npm run test:unit` | ✅ 197+ passed (2026-07-22) |
| Legacy contracts | `npm run test:legacy` | ✅ 87 passed |
| Full suite | `npm run test` | ✅ green |
| Routing SQL contract | `supabase/tests/09_routing_contract.sql` | ✅ passed (Supabase SQL Editor, 2026-07-22) |
| Corrective migrations | `20260722140002`, `20260722140003` | ✅ applied (intake RPC + escalate grants) |

## Must-Haves (goal-backward)

| ID | Truth | Evidence | Status |
|----|-------|----------|--------|
| ROUT-01/02 | Deterministic `evaluateRoutingPolicy` with versioned audit columns | `policy.ts`, `20260722130001_routing_columns.sql` | ✅ |
| ROUT-02 | Worker applies routing on terminal triage | `apply-routing.ts` in `triage/service.ts` | ✅ |
| ROUT-03 | Officer default queue excludes self_help | `applyReportFilters`, `government_default` filter | ✅ |
| ROUT-04 | Citizen escalate + officer override | escalate API + officer routing API | ✅ |
| ROUT-05 | Destination badges | `RoutingDestinationBadge.tsx` | ✅ |
| ROUT-06 | Static EN/VI playbooks | `messages/*/public.routing.playbooks` | ✅ |
| ROUT-07 | Status page self-help + escalate | `status/page.tsx` | ✅ |
| ROUT-08 | graffiti category + policy tests | `CategorySchema`, `policy.test.ts` | ✅ |

## Human UAT (optional smoke)

- [ ] Low-severity eligible category routes to `self_help`; severity≥4 stays government
- [ ] Citizen playbook + escalate CTA end-to-end
- [ ] Officer "Include self-help" filter; override actions on detail

## Verdict

**Passed** — code and SQL contract green. Optional browser smoke above before production cutover.
