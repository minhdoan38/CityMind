# Phase 9: Self-help vs Government Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 9-self-help-vs-government-routing
**Areas discussed:** routing trigger, self-help content, citizen journey, officer queue visibility, policy rules, government queue criteria

---

## Routing trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Post-triage only | Route after triage_status=completed | ✓ |
| Post-triage + manual_review | Route self-help on completed; government on manual_review/failed | |
| You decide | Planner picks based on Phase 8 triage lifecycle | |

| Option | Description | Selected |
|--------|-------------|----------|
| Policy rules on triage output | category + severity + priority thresholds (deterministic) | ✓ |
| AI recommendation + policy gate | use recommended_action but policy can override | |
| Category mapping only | simple lookup table | |

| Option | Description | Selected |
|--------|-------------|----------|
| Government queue while pending | Officers see report; routing updates after triage | ✓ |
| Hidden until routed | Officers only see government-routed reports | |
| Visible with destination badge | All reports visible; badge shows destination | |

| Option | Description | Selected |
|--------|-------------|----------|
| No re-routing | Destination set once; escalate is citizen-initiated | |
| Officer can override | Officers move self-help → government | |
| Both | Citizen escalate + officer override paths | ✓ |

**User's choice:** Post-triage only; deterministic policy on triage output; government-visible while pending; both escalate and officer override.
**Notes:** Aligns with Phase 8 persist-first model — every report exists before routing runs.

---

## Self-help content

| Option | Description | Selected |
|--------|-------------|----------|
| Static playbooks | Curated EN/VI articles per category | ✓ |
| AI-generated guidance | Personalized steps from triage output | |
| Hybrid | Static base + AI tailors wording | |

| Option | Description | Selected |
|--------|-------------|----------|
| Short actionable steps | 3–5 bullets + optional links | ✓ |
| Full article | Longer civic guidance page | |
| Minimal redirect | One paragraph + external link | |

| Option | Description | Selected |
|--------|-------------|----------|
| In-repo JSON/catalog | messages or dedicated routing catalog | ✓ |
| Database/CMS | Officers edit in Supabase | |
| External links only | Point to city website FAQs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Hide AI fields | Show only playbook on self-help path | ✓ |
| Show category label | e.g. "This looks like a pothole issue" | |
| Show AI summary | observed_facts + recommended_action | |

**User's choice:** Static playbooks, short steps, in-repo catalog, hide AI fields on self-help path.

---

## Citizen journey

| Option | Description | Selected |
|--------|-------------|----------|
| Status page only | Guidance on existing token status page | ✓ |
| Success page redirect | Dedicated guidance page after submit | |
| Both | Hint on success + full guidance on status | |

| Option | Description | Selected |
|--------|-------------|----------|
| Adapt workflow steps | Self-help: received → guidance → resolved | ✓ |
| Keep same 4 steps | Extra panel on existing steps | |
| You decide | Planner designs calm copy | |

| Option | Description | Selected |
|--------|-------------|----------|
| Escalate CTA | "Still need city help?" → government queue | ✓ |
| New report | Fresh submission required | |
| No escalate | Self-help is terminal | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep access token | Same token after escalation | ✓ |
| New token on escalate | Fresh token when escalating | |

**User's choice:** Status page surface, adapted steps, escalate CTA, same token.

---

## Officer queue visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Government queue default | Default hides self-help; filter chip to include | ✓ |
| All visible | Self-help in default queue with badge | |
| Separate tab | Self-help tab vs government tab | |

| Option | Description | Selected |
|--------|-------------|----------|
| View only | Read-only self-help reports | |
| Override actions | Escalate to government or mark resolved | ✓ |
| Hidden | Officers cannot access self-help reports | |

| Option | Description | Selected |
|--------|-------------|----------|
| Destination badge | Self-help vs Government in table | ✓ |
| Filter only | Routing visible only via filter | |
| Detail page only | Badge on detail only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Phase 8 sort | manual_review/failed first on government queue | ✓ |
| Government-routed first | Government before self-help within bucket | |
| You decide | Planner optimizes sort | |

**User's choice:** Government-only default, override actions, destination badge, Phase 8 sort preserved.

---

## Policy rules

| Option | Description | Selected |
|--------|-------------|----------|
| In-repo TypeScript module | src/server/routing/policy.ts with version constant | ✓ |
| JSON config file | prompt/routing-policy.json | |
| Database table | Editable without deploy | |

| Option | Description | Selected |
|--------|-------------|----------|
| Report column + audit | routing_destination, routing_reason, policy_version | ✓ |
| Separate routing_runs table | Like triage_runs audit | |
| Minimal | routing_destination only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Semver constant | ROUTING_POLICY_VERSION stored per decision | ✓ |
| Git commit hash | Auto-captured at deploy | |
| No versioning | Skip for MVP | |

| Option | Description | Selected |
|--------|-------------|----------|
| Triage worker hook | Route after successful triage in same pass | ✓ |
| Separate routing worker | Second poll step | |
| Compute on read | Derive on status load | |

**User's choice:** TS policy module, report-row audit, semver version, triage worker hook.

---

## Government queue criteria

| Option | Description | Selected |
|--------|-------------|----------|
| Severity/priority thresholds | severity ≥4 OR priority high/critical → government | ✓ |
| Category blocklist | utility_hazard, structural_damage, flooding always government | |
| Both | Blocklist + thresholds | |

| Option | Description | Selected |
|--------|-------------|----------|
| Low-severity eligible categories | graffiti, waste, pothole, streetlight at severity ≤2 | ✓ |
| Explicit whitelist only | Only listed categories can self-help | |
| You decide | Planner drafts initial table | |

| Option | Description | Selected |
|--------|-------------|----------|
| Always government | manual_review/failed never self-help | ✓ |
| Policy decides | manual_review can still self-help | |
| Self-help with flag | Self-help + needs-attention badge | |

| Option | Description | Selected |
|--------|-------------|----------|
| Low confidence → government | confidence < 0.65 routes to government | ✓ |
| No confidence gate | Only category/severity/priority | |
| You decide | Align with Phase 8 thresholds | |

**User's choice:** Severity/priority always-government rules, low-severity category whitelist, manual_review/failed always government, confidence < 0.65 → government.

---

## Claude's Discretion

- Exact self-help workflow step labels and EN/VI copy
- Playbook catalog file layout
- Filter chip naming and default query params
- Migration column types and escalate/override RPC design

## Deferred Ideas

- Cloud Tasks triage handler spike (Phase 8 legacy — skipped)
- Database-editable self-help CMS
- AI-personalized self-help guidance
- Eval suite / shadow rollout (Phase 10)
