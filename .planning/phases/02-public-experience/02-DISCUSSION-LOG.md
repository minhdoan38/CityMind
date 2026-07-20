# Phase 2: Public Experience - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 2-Public Experience
**Areas discussed:** Home page content, Report form behavior, Locale & dashboard shell
**Areas skipped:** Access token UX (REQUIREMENTS defaults)

---

## Home page content

### Q1 — Primary CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Report → /report | Citizen action first | ✓ |
| Split CTAs | Report + Track | |
| Report + Officer equally weighted | | |
| You decide | | |

**User's choice:** Report → /report

### Q2 — AI advisory placement

| Option | Description | Selected |
|--------|-------------|----------|
| Hero supporting line | | ✓ |
| Dedicated callout section | | |
| Footer only | | |
| You decide | | |

**User's choice:** Hero supporting line

### Q3 — Section order

| Option | Description | Selected |
|--------|-------------|----------|
| How it works → Instructions → About → Contact | | ✓ |
| How it works → About → Instructions → Contact | | |
| How it works → Instructions → Contact → About | | |
| You decide | | |

**User's choice:** How it works → Instructions → About → Contact → Footer

### Q4 — Visual tone

| Option | Description | Selected |
|--------|-------------|----------|
| Civic / calm light UI | | ✓ |
| Dark tech dashboard | | |
| You decide | | |

**User's choice:** Civic / calm light UI

### Q5 — Contact section

| Option | Description | Selected |
|--------|-------------|----------|
| Static contact block (mailto / coming soon) | | ✓ |
| Real form + API | | |
| Link-only | | |
| You decide | | |

**User's choice:** Static contact block

### Q6 — Instructions depth

| Option | Description | Selected |
|--------|-------------|----------|
| 3–5 short steps | | ✓ |
| Long FAQ list | | |
| You decide | | |

**User's choice:** 3–5 short steps

### Q7 — Officer sign-in visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle header/footer text link | | ✓ |
| Visible secondary header button | | |
| Hidden | | |
| You decide | | |

**User's choice:** Subtle text link

### Q8 — Hero visual

| Option | Description | Selected |
|--------|-------------|----------|
| Full-bleed civic photo | | ✓ |
| Illustration / abstract only | | |
| Typography-only hero | | |
| You decide | | |

**User's choice:** Full-bleed civic photo

---

## Report form behavior

### Q1 — Location requirement

| Option | Description | Selected |
|--------|-------------|----------|
| Optional but encouraged | | ✓ |
| Required | | |
| Required unless image | | |
| You decide | | |

**User's choice:** Optional but encouraged

### Q2 — Image constraints UX

| Option | Description | Selected |
|--------|-------------|----------|
| Helper text + client Zod | | ✓ |
| Server-only errors | | |
| You decide | | |

**User's choice:** Helper text + Zod

### Q3 — Success flow

| Option | Description | Selected |
|--------|-------------|----------|
| Inline success on /report | | |
| Navigate to /report/success | | ✓ |
| You decide | | |

**User's choice:** /report/success

### Q4 — Analyzing state

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled submit + progress message | | ✓ |
| Full-page overlay modal | | |
| You decide | | |

**User's choice:** Disabled submit + “Analyzing…” message

---

## Locale & dashboard shell

### Q1 — Locale URL strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix /en and /vi | | ✓ |
| Cookie/header only | | |
| You decide | | |

**User's choice:** Prefix routes

### Q2 — Default locale

| Option | Description | Selected |
|--------|-------------|----------|
| Detect Accept-Language, fallback en | | ✓ |
| Always Vietnamese | | |
| Always English | | |
| You decide | | |

**User's choice:** Detect, fallback en

### Q3 — Unauthenticated /dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to /login with return URL | | ✓ |
| Redirect to /login only | | |
| You decide | | |

**User's choice:** Login with return URL

### Q4 — Phase 2 dashboard list

| Option | Description | Selected |
|--------|-------------|----------|
| Simple recent cards | | ✓ |
| Summary only / placeholder | | |
| Ship Phase 3 table early | | |
| You decide | | |

**User's choice:** Simple recent cards

---

## Agent Discretion

- Access token format/expiry (area skipped)
- Hero photo asset source
- Exact bilingual marketing copy
- Whether card list keeps simple MVP filters

## Deferred Ideas

- `/status` page — Phase 4
- Dashboard table/export — Phase 3
- Contact mailer backend — future
