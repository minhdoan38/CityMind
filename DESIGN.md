<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->
---
name: CityMind AI
description: Civic decision-support UI — clear, trustworthy, bilingual EN/VI
---

# Design System: CityMind AI

## 1. Overview

**Creative North Star: "The Trustworthy Counter"**

CityMind should feel like a well-run city service window: plain language, obvious next steps, evidence in view, no AI theater. Officers work in a calm product shell; citizens meet big, unambiguous report CTAs in the spirit of 311 — not a startup launch page.

Surfaces stay light and readable under office and outdoor phone light. Density belongs in the dashboard tables; public flows stay sparse and guided. Depth is tonal and structural, not glossy.

Explicitly rejects: generic purple SaaS / AI-startup landings, dark cyber / neon “smart city” dashboards, and dense bureaucratic portal clutter.

**Key Characteristics:**
- Restrained civic palette — one accent, used sparingly
- Single humanist sans for product + public continuity
- Motion only for state feedback
- Evidence and status over decoration
- Bilingual EN/VI treated as equal citizens of the layout

## 2. Colors

Restrained strategy: tinted neutrals carry almost all surface; one civic accent ≤10% of any screen (primary actions, focus, selected nav, critical status emphasis).

### Primary
- **Civic Teal** (`[to be resolved during implementation]` — hue family: deep teal / blue-green): Primary actions, focus rings, selected states. Calm authority, not neon.

### Neutral
- **Service Paper** (`[to be resolved]`): Main content background — true off-white, chroma toward teal (not cream/sand default).
- **Panel Mist** (`[to be resolved]`): Sidebar / toolbar secondary surface, slightly cooler or deeper than paper.
- **Ink** (`[to be resolved]`): Body and headings — near-black with enough contrast for WCAG AA body text.
- **Quiet Line** (`[to be resolved]`): Borders and dividers — low-chroma teal-gray, never pure black hairlines for decoration.

### Semantic (roles only; hex later)
- Success / warning / danger / info: distinct hues; never rely on color alone (pair with label or icon).

**The One Accent Rule.** Civic Teal appears on ≤10% of any given screen. Its rarity is the point — trust comes from restraint, not saturation.

**The No Neon Rule.** Forbidden: purple gradients, glow accents, cyberpunk dark shells.

## 3. Typography

**Display Font:** `[font pairing to be chosen at implementation]` — single humanist sans (same family as body; weight/size carry hierarchy)
**Body Font:** `[humanist sans — to be chosen]`
**Label/Mono Font:** Optional tabular/mono for IDs, timestamps, severity scores only

**Character:** One familiar humanist sans across landing and dashboard. Warm enough for citizens, precise enough for officers. No display serif in UI chrome; no decorative script.

### Hierarchy
- **Display** (public hero only; clamp max ≤ 6rem; letter-spacing ≥ -0.04em): Brand + one headline.
- **Headline / Title** (fixed rem scale ~1.125–1.2 ratio): Section and page titles in product UI.
- **Body** (16px / 1rem base, 65–75ch for prose): Instructions, AI summaries, notes.
- **Label** (smaller, medium weight): Form labels, table headers, status chips — never tiny uppercase tracked eyebrows as section scaffolding.

**The One Voice Rule.** Same type family for public and dashboard. Hierarchy is weight and size, not a second personality font.

## 4. Elevation

Flat by default. Depth via tonal layering (paper vs panel mist) and 1px quiet borders — not soft multi-layer drop shadows.

Shadows, if any, appear only for transient elevation (open menus, dialogs) at low blur (≤8px). Never pair heavy shadow with decorative borders on resting cards.

**The Flat-By-Default Rule.** Surfaces rest flat. Lift is a state response, not decoration.

## 5. Components

*(Seed — omit detailed component specs until shadcn/ui and scaffolds exist. Re-run `$impeccable document` after Phase 1 tracks B/C.)*

Intentional direction for implementers:
- **Buttons:** Clear primary (Civic Teal fill) + quiet secondary/ghost; large tap targets on public CTAs.
- **Cards:** Prefer none on heroes; use only as interaction containers in product UI.
- **Inputs:** Stroke fields, strong `:focus-visible`, explicit error text (not color-only).
- **Status:** Chips with label + color; severity never color-alone.

## 6. Do's and Don'ts

### Do:
- **Do** keep accent usage rare and purposeful (primary CTA, selection, focus).
- **Do** show evidence, confidence, uncertainty, and status history honestly.
- **Do** design EN and VI as first-class — no cramped afterthought locale.
- **Do** use motion only for state changes (150–250ms); honor `prefers-reduced-motion`.
- **Do** meet WCAG 2.2 AA contrast for body and UI text.

### Don't:
- **Don't** look like generic purple SaaS / AI-startup landing pages.
- **Don't** look like dark cyber / neon “smart city” dashboards.
- **Don't** ship dense bureaucratic government-portal clutter or jargon walls.
- **Don't** imply AI is autonomous authority or a prediction engine.
- **Don't** use gradient text, glassmorphism-as-default, side-stripe accent borders, or hero-metric SaaS templates.
