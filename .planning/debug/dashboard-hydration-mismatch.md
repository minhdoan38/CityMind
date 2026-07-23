---
status: resolved
trigger: Hydration mismatch on /dashboard
created: 2026-07-22
updated: 2026-07-22
---

# Debug: dashboard-hydration-mismatch

## Symptoms

- Recoverable hydration error on `/dashboard`
- Date cell: server `19 Jul 2026, 12:35 pm` vs client `Jul 19, 2026, 12:35 PM`
- ResolutionRateWidget SVG: float attribute drift between Node SSR and browser

## Root cause

1. `formatWhen` used `toLocaleString(undefined, …)` — default locale differs between Node and browser.
2. `Math.cos`/`Math.sin` tick coordinates serialized with slightly different float precision on server vs client.

## Fix

- Pin dashboard dates to `en-US` in `ReportsTable.tsx`
- Round SVG coordinates in `ResolutionRateWidget.tsx`
