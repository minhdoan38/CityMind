---
target: src/components/reports/ReportsTable.tsx
total_score: 29
p0_count: 0
p1_count: 1
timestamp: 2026-07-23T12-52-31Z
slug: src-components-reports-reportstable-tsx
---
# Critique: ReportsTable.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Global bulk loading indicator is good, but row-level state transitions during bulk triage are opaque. |
| 2 | Match System / Real World | 4 | Standard terminology and icons reflect real-world civic dispatch. |
| 3 | User Control and Freedom | 2 | Lack of interactive table controls (no column reordering, resizing, or reset options). |
| 4 | Consistency and Standards | 4 | Conforms well to the CityMind design system, shadcn-based primitives, and Lucide conventions. |
| 5 | Error Prevention | 3 | Bulk cap (25 max) is enforced, but lacks proactive row selection filtering. |
| 6 | Recognition Rather Than Recall | 3 | Hidden columns (like severity by default) are hard to discover without opening the column selector. |
| 7 | Flexibility and Efficiency | 2 | Missing accelerators (keyboard navigation, column drag/resize, bulk toolbar, presets). |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, civic layout but prone to horizontal overflow on laptop viewports when all columns are visible. |
| 9 | Error Recovery | 3 | Outcome announcer handles feedback, but partial bulk failures lack granular recovery paths. |
| 10 | Help and Documentation | 2 | AI-assisted status (e.g. shadow mismatch, triage outcomes) lacks clear inline tooltips. |
| **Total** | | **29/40** | **Good** |

## Anti-Patterns Verdict

**LLM Assessment**:
The table layout is solid and respects the CityMind design system guidelines (Canvas background, white card panels, blue emphasis on sorting/links). It avoids generic SaaS slop (no gradient text, no side-stripe borders). However, it uses a static/rigid table model. For a heavy officer dashboard, this feels slightly "unfinished" because the column layout is rigid and lacks density controls.

**Deterministic Scan**:
Deterministic scan returned `[]` (0 rules triggered). Code structure is clean, responsive, and uses proper accessibility attributes.

## Overall Impression
A highly functional, clean civic dashboard table. However, it operates as a static spreadsheet rather than a dynamic desktop workspace. Enhancing flexibility (reordering, resizing, density) will elevate this from a static viewer to a premium officer console.

## What's Working
- **Bilingual & Locale Handling**: Dates, statuses, and badges are fully bilingual (EN/VI) with excellent fallback text helper logic.
- **Context Menu Integration**: Right-click context menus (`ReportRowContextMenu`) allow quick action access without cluttering the row layout.
- **Subtle Visual Cues**: Muted thumbnails, clear badges for routing/status, and clean typography layouts.

## Priority Issues

### [P1] Rigid Layout & Column Overflow
- **Why it matters**: With many columns (Report ID, status, priority, category, created date, etc.), laptop screens experience horizontal truncation or squishing.
- **Fix**: Implement drag-to-reorder columns and column resizing using `@tanstack/react-table` column sizing API.
- **Suggested command**: `/impeccable layout`

### [P2] Power User Friction (Alex)
- **Why it matters**: Officers managing hundreds of reports per day must use the mouse for every preview, checkbox, and triage action.
- **Fix**: Add keyboard shortcuts (Arrow Up/Down to navigate rows, Space to select, Enter to preview/open, Esc to dismiss).
- **Suggested command**: `/impeccable delight`

### [P2] High Visual Cognitive Load in Bulk Selection
- **Why it matters**: Selecting items triggers a header count label but lacks a dedicated, high-visibility action bar. It's easy to lose track of selected items when scrolling.
- **Fix**: Implement a floating action toolbar at the bottom of the table when selectedCount > 0.
- **Suggested command**: `/impeccable layout`

## Persona Red Flags

- **Alex (Power User)**: No keyboard shortcuts. Navigating through 50 reports requires tedious cursor movement and clicks.
- **Sam (Accessibility)**: Screen reader announces table grid, but custom selection checkboxes (`ReportBulkCheckbox`) and sorting buttons inside table headers need clearer interactive focus outlines and descriptions.

## Minor Observations
- The severity column is hidden by default. A more descriptive helper/tooltip explaining what it is would invite users to activate it.
