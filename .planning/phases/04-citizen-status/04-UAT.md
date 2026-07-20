---
status: testing
phase: 04-citizen-status
source: [04-VERIFICATION.md]
started: 2026-07-20T14:24:35Z
updated: 2026-07-20T14:24:35Z
---

## Current Test

number: 1
name: Deep link auto-fetch + EN/VI
expected: |
  With backend running and a known report_id+token: open /en/status?reportId=…&token=…
  → auto-fetch shows status/summary/history; wrong token → one generic error;
  /vi/status shows VI copy
awaiting: user response

## Tests

### 1. Deep link auto-fetch + EN/VI
expected: With backend running and a known report_id+token: open /en/status?reportId=…&token=… → auto-fetch shows status/history; wrong token → one generic error; /vi/status shows VI copy
result: [pending]

### 2. Officer Copy status link
expected: Detail → Copy status link → paste is /en/status?reportId=… with no token=; recovery hint visible; live region announces Link copied
result: [pending]

### 3. Calm 429 UX
expected: Force status limiter → rate-limited Alert without existence language; Check status disabled briefly via Retry-After
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
