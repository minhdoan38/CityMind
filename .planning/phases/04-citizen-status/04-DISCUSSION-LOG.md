# Phase 4: Citizen Status - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 4-Citizen Status
**Areas discussed:** Status page entry, Citizen-visible payload, Shareable link security, Officer copy-link UX, Failure & rate-limit UX

---

## Status page entry

| Option | Description | Selected |
|--------|-------------|----------|
| Form only | Manual report_id + token | |
| Deep-link only | Query params auto-load | |
| Both form + auto-fill from query | Matches success prep URL | ✓ (agent) |
| You decide | User mandate | ✓ |

**User's choice:** all areas; agent decides everything; write CONTEXT.
**Notes:** Locked D-01–D-04.

---

## Citizen-visible payload

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal status only | No history | |
| Status + summary + history (no AI/evidence) | CIT-02 | ✓ (agent) |
| Full officer detail mirror | | |
| You decide | User mandate | ✓ |

**User's choice:** Agent decide all.
**Notes:** Locked D-05–D-08; officer notes as plain text OK; no actor_id.

---

## Shareable link security

| Option | Description | Selected |
|--------|-------------|----------|
| Keep query-string token (success prep) | Continuity | ✓ (agent) |
| Hash-fragment only | | |
| Paste-only never in URL | Breaks success link | |
| You decide | User mandate | ✓ |

**User's choice:** Agent decide all.
**Notes:** Locked D-09–D-12; uniform expiry/invalid failure.

---

## Officer copy-link UX

| Option | Description | Selected |
|--------|-------------|----------|
| Copy full tokenized URL | Impossible — plaintext not stored | |
| Copy reportId-only status URL + hint | Honest recovery limit | ✓ (agent) |
| Re-issue new token from dashboard | Deferred | |
| You decide | User mandate | ✓ |

**User's choice:** Agent decide all.
**Notes:** Locked D-13–D-15 (D-14a/b/c).

---

## Failure & rate-limit UX

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct expired vs invalid messages | Leaks info | |
| Single generic 401 message | CIT-03 | ✓ (agent) |
| You decide | User mandate | ✓ |

**User's choice:** Agent decide all.
**Notes:** Locked D-16–D-18; IP rate limit + 429 UI.

---

## the agent's Discretion

- Entire decision set delegated by user after selecting all gray areas

## Deferred Ideas

- Token re-issue/rotation, NOTF-01 email/SMS, fragment-only tokens, Phase 7 on status page
