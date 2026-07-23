---
quick_id: 260723-tzh
status: in_progress
description: Add accessible, persistent column resizing to the officer dashboard table
---

# Quick Task Plan

## Goal

Make officer dashboard report columns resizable with pointer, touch, and keyboard input while preserving horizontal scrolling and existing table behavior.

## Tasks

1. Add a reusable keyboard resize function and column-size persistence to `ReportsTable`.
2. Upgrade resize handles with accessible separator semantics, visible focus, and reset behavior.
3. Add a legacy contract test and run focused lint/test verification.

## Must Haves

- Arrow keys resize the focused column handle in predictable increments.
- Pointer and touch resizing continue to use TanStack Table.
- Saved widths survive reload and reset with the existing layout reset control.
- Fixed utility columns remain non-resizable.
- Narrow viewports retain horizontal scrolling.
