---
quick_id: 260723-tzh
status: complete
description: Add accessible, persistent column resizing to the officer dashboard table
completed: 2026-07-23
---

# Summary

Added production-ready column resizing to the dashboard report table.

## Delivered

- Pointer and touch resize handles continue to use TanStack Table.
- Focused handles resize with Left/Right Arrow; Shift doubles the step.
- Double-click resets an individual column width.
- Width preferences persist in local storage and clear with Reset layout.
- Selection, urgency, and action utility columns cannot be resized.
- The table scrolls horizontally on narrow viewports.
- Resize handles expose separator semantics and a visible focus state.

## Verification

- `npm run lint -- --quiet src/components/reports/ReportsTable.tsx tests/dashboard-table.test.mjs` — passed.
- `node --test tests/dashboard-table.test.mjs` — 22 passed, 0 failed.
- `npx tsc --noEmit` — resize changes introduce no new errors; the repository remains blocked by pre-existing errors, including `ColumnDef.accessorKey` accesses in `ReportsTable.tsx` and unrelated server/test typing failures.

## Notes

No commit was created because both implementation files and `.planning/STATE.md` already contained unrelated user changes. Committing whole files would have included work outside this quick task.
