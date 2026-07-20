---
phase: 03-dashboard-polish
reviewed: 2026-07-20T16:19:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - supabase/migrations/20260720_000002_dashboard_polish.sql
  - backend/app/security.py
  - backend/app/services/supabase.py
  - backend/app/api/reports.py
  - frontend/src/components/reports/ReportsTable.tsx
  - frontend/src/components/reports/ReportsFilters.tsx
  - frontend/src/components/reports/ReportsMetrics.tsx
  - frontend/src/components/reports/types.ts
  - frontend/src/components/reports/ExportButton.tsx
  - frontend/src/app/dashboard/page.tsx
  - frontend/src/app/dashboard/layout.tsx
  - frontend/src/app/dashboard/reports/[reportId]/page.tsx
  - frontend/src/components/StatusActions.tsx
  - frontend/src/app/api/officer/reports/export/route.ts
  - frontend/src/components/DashboardSidebar.tsx
  - frontend/src/components/ui/table.tsx
  - frontend/src/components/ui/checkbox.tsx
  - frontend/src/components/ui/select.tsx
  - frontend/src/components/ui/popover.tsx
  - frontend/src/components/ui/collapsible.tsx
  - frontend/src/components/ui/dialog.tsx
  - frontend/messages/en.json
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-20T16:19:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues

## Summary

Phase 03 dashboard polish was reviewed across the reports API (cursor, export, `actor_id`, note gate), table/filters/detail Dialog UI, and the export BFF auth path. Officer auth for export is sound (`getClaims` role gate + FastAPI `require_officer`). The standout defect is opaque keyset cursor encoding: colon-delimited payloads break on default `created_at` ISO timestamps, so “Next” pagination (and export paging via the same cursor) is incorrect. Secondary issues: silent export truncation, unquoted PostgREST keyset filters, non-atomic status denorm updates, decision notes in query strings, and CSV formula-injection risk.

Pre-existing missing ReportStarterBar was not treated as a failure (out of Phase 3 scope).

## Critical Issues

### CR-01: Keyset cursor encoding breaks on ISO `created_at` timestamps

**File:** `backend/app/services/supabase.py:23-34`
**Issue:** `encode_cursor` joins fields with `:` and `decode_cursor` uses `raw.split(":", 3)`. Default sort values are ISO-8601 timestamps containing colons (e.g. `2026-07-20T15:30:00+00:00`). Decoding truncates the sort value and corrupts `report_id`:

```text
encode: created_at:desc:2026-07-20T15:30:00+00:00:<uuid>
decode: ('created_at', 'desc', '2026-07-20T15', '30:00+00:00:<uuid>')
```

`list_recent` then applies a wrong keyset filter. Default dashboard “Next” pagination and `iter_filtered` export paging (which reuses `list_recent` cursors) skip/duplicate rows or return empty/error pages. No unit tests cover `encode_cursor`/`decode_cursor`.

**Fix:** Encode a structured payload (JSON or length-prefixed fields), not colon-joined raw strings:

```python
def encode_cursor(sort: str, order: str, value: str, report_id: str) -> str:
    raw = json.dumps(
        {"sort": sort, "order": order, "value": value, "report_id": report_id},
        separators=(",", ":"),
    )
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[str, str, str, str]:
    pad = "=" * (-len(cursor) % 4)
    data = json.loads(base64.urlsafe_b64decode(cursor + pad).decode("utf-8"))
    try:
        return data["sort"], data["order"], data["value"], data["report_id"]
    except (KeyError, TypeError) as exc:
        raise ValueError("Invalid cursor") from exc
```

Add tests with real ISO timestamps and multi-page `created_at` ordering.

## Warnings

### WR-01: PostgREST keyset filter interpolates unquoted cursor values

**File:** `backend/app/services/supabase.py:192-199`
**Issue:** `_apply_keyset` builds `.or_(f"{column}.lt.{value},and(...)")` with raw `value` / `report_id`. Timestamps (`+`, `:`) and any crafted cursor content (`,`, `)`, `.`) can break or reshape the filter grammar. Combined with client-supplied opaque cursors, this is both a correctness hazard and a filter-injection surface for authenticated officers.

**Fix:** After fixing CR-01, quote/escape PostgREST values (double-quote and escape embedded quotes) or use a safer filter API that binds values rather than string-building the `or` expression. Reject cursors whose `sort`/`order`/`value`/`report_id` fail a strict allowlist/format check before querying.

### WR-02: Export soft-caps at 10k with no client signal

**File:** `backend/app/api/reports.py:346-364`, `backend/app/services/supabase.py:312-356`
**Issue:** `iter_filtered` stops at `EXPORT_SOFT_ROW_CAP` (10_000) without a trailer, header, or truncated flag. Officers can download a partial CSV/XLSX believing it is the full filtered set — silent data loss for ops/audit use.

**Fix:** When `yielded == soft_cap` and another page would exist, set a response header (e.g. `X-CityMind-Export-Truncated: true`) and/or append a final CSV row / XLSX notice. Surface that in `ExportButton` error/warning UI.

### WR-03: `update_status` is not atomic (event insert vs `current_status`)

**File:** `backend/app/services/supabase.py:358-380`
**Issue:** Inserts `status_events` then separately updates `reports.current_status`. If the update fails after a successful insert, timeline and denormalized status diverge; list/summary filters on `current_status` become wrong while history shows the new event.

**Fix:** Use a single RPC/transaction (Postgres function) that inserts the event and updates `reports.current_status` together, or compensate/roll back the event on update failure.

### WR-04: Decision notes sent as URL query parameters

**File:** `frontend/src/components/StatusActions.tsx:41-48`, `frontend/src/app/api/officer/reports/[reportId]/status/route.ts:9-14`
**Issue:** Resolve/reject notes (often sensitive operational text) are placed in the query string for both the browser `fetch` and the BFF→FastAPI call. Query strings commonly land in access logs, proxy logs, and browser history.

**Fix:** Send `{ status, note }` as a JSON body on `PATCH` (update FastAPI handler + BFF to read the body). Keep the server-side blank-note 422 gate.

### WR-05: CSV export vulnerable to spreadsheet formula injection

**File:** `backend/app/api/reports.py:49-58,304-315`
**Issue:** Exported `summary`, `recommendation`, and `status_note` are written raw into CSV. Citizen-influenced or officer-entered values starting with `=`, `+`, `-`, or `@` can execute as formulas when opened in Excel/Sheets.

**Fix:** Sanitize on write — prefix risky cells with `'` or a tab, or force text quoting per field in `_csv_iter` / XLSX string writes.

## Info

### IN-01: Invalid cursor bytes become 502 instead of 422

**File:** `backend/app/api/reports.py:265-268`, `backend/app/services/supabase.py:28-30`
**Issue:** Malformed base64/`UnicodeDecodeError` from `decode_cursor` are not `ValueError`, so `/recent` maps them to 502 “Database query failed” rather than 422.
**Fix:** Catch `(ValueError, binascii.Error, UnicodeDecodeError, json.JSONDecodeError)` in `decode_cursor` and raise `ValueError("Invalid cursor")`.

### IN-02: Sidebar Export/Settings labels not i18n’d

**File:** `frontend/src/components/DashboardSidebar.tsx:45-54`
**Issue:** Export nav title is hardcoded `'Export'` / `'Settings'` while DASH-07 added EN/VI export catalog keys elsewhere.
**Fix:** Use `useTranslations('navigation')` (or dashboard export keys) for both labels.

### IN-03: Date filters append `Z` to local date-picker values

**File:** `frontend/src/components/reports/ReportsFilters.tsx:176-198`
**Issue:** `YYYY-MM-DD` from `<input type="date">` is converted to `...T00:00:00Z` / `...T23:59:59Z`, which is UTC day bounds, not the officer’s local day — off-by-timezone filter skew near midnight.
**Fix:** Document UTC semantics in the UI, or convert local start/end-of-day to ISO via `Date` before setting params.

---

_Reviewed: 2026-07-20T16:19:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
