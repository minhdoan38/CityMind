---
name: CityMind AI
description: Civic decision-support UI — clear, trustworthy, bilingual EN/VI
---

# Design System: CityMind AI

## 1. Overview

**Creative North Star: "The Trustworthy Counter"**

CityMind should feel like a well-run city service window: plain language, obvious next steps, evidence in view, no AI theater. Officers work in a calm product shell inspired by modern analytics dashboards; citizens meet big, unambiguous report CTAs.

Surfaces use a **blue-first committed palette** (`#3B71F7` primary) on cool gray canvases (`#F5F7FB`). White cards float with soft shadows. Depth is tonal and structural — not glassmorphism or neon.

**Key Characteristics:**
- Blue primary for actions, selection, and data emphasis
- Google Sans family for brand continuity
- Motion for state feedback (150–250ms)
- Rounded 12px cards and controls
- Bilingual EN/VI as equal layout citizens

## 2. Colors

**Committed strategy:** blue carries primary actions, active nav, charts, and key metrics; neutrals carry structure.

### Primary
- **CityMind Blue** `#3B71F7` — primary buttons, focus rings, active nav, chart series
- **Blue Ink** `#2563EB` — secondary emphasis, links on light surfaces
- **Blue Mist** `#EEF2FF` — selected/hover tints

### Neutral
- **Canvas** `#F5F7FB` — dashboard workspace background
- **Panel** `#F8F9FC` — sidebar surface
- **Card** `#FFFFFF` — elevated content
- **Ink** `#1A1D26` — body and headings (WCAG AA on white)
- **Muted** `#5B6478` — labels and secondary text
- **Line** `#E2E8F2` — borders

### Semantic
- Success: green for positive trends
- Destructive: `#DC2626` for errors/rejected status
- Warning: amber for caution states

## 3. Typography

**Brand / headings:** Google Sans  
**Body / UI:** Google Sans Text  
**Display (public hero):** Google Sans Flex  
**Code / IDs:** Google Sans Code  

### Hierarchy (product UI — fixed rem)
- Page title: 1.5rem / semibold
- Section title: 1.25rem / semibold
- Body: 1rem / regular
- Label: 0.875rem / medium
- Metric value: 1.75rem / semibold tabular-nums

## 4. Elevation

Cards use `--shadow-card` at rest; dialogs/menus use `--shadow-elevated`. No nested cards.

## 5. Motion

- Hero entrance: `hero-rise` (public landing only)
- Dashboard stagger: `dash-rise` with 40ms steps
- Interactions: 150ms ease-out-expo on buttons
- Always honor `prefers-reduced-motion`

## 6. Do's and Don'ts

### Do:
- Use blue sparingly for meaning (CTA, selection, charts)
- Keep dashboard canvas gray and content on white cards
- Show evidence, confidence, and status honestly

### Don't:
- Revert to teal/civic-green palette without intent
- Use gradient text, glass cards, or side-stripe accents
- Ship purple SaaS or dark cyber dashboards
