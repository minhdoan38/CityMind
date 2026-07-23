# Phase 11 — Validation Commands

**Phase:** 11-triage-evaluator-spec-conformance  
**Updated:** 2026-07-22

Run from repository root (`CityMind/`). Requires Supabase (`SUPABASE_DB_URL`) for SQL gates and AI credentials for live probes.

---

## Per-plan gates

### 11-01 — Evaluator schema + policy (Wave 1)

```bash
npm run test:unit -- src/server/domain/evaluator-analysis.test.ts
npm run test:unit -- src/server/domain/analysis-projection.test.ts
npm run test:unit -- src/server/validation/evaluator-policy.test.ts
npm run test:unit -- src/server/triage/service.test.ts
node scripts/run-supabase-sql.mjs -f supabase/migrations/20260722160001_evaluator_analysis_columns.sql
node scripts/run-supabase-sql.mjs -f supabase/migrations/20260722160002_complete_triage_report_v2.sql
```

### 11-02 — Push dispatch (Wave 2)

```bash
npm run test:unit -- src/server/triage/dispatch.test.ts
npm run test:unit -- src/server/security/internal-auth.test.ts
npm run test:unit -- src/server/services/report-service.test.ts
npm run test:unit -- src/server/services/officer-triage-dispatch.test.ts
```

Manual: submit report → `triage_status` moves to `processing` within seconds (not 5s worker tick only).

### 11-03 — AI health (Wave 2)

```bash
npm run test:unit -- src/server/health/ai-readiness.test.ts
curl -s http://127.0.0.1:3000/api/health/ai
```

Expect JSON `{ "status": "up"|"degraded"|"down", "model": "...", "latency_ms": N, "checked_at": "..." }`. No API keys in body.

### 11-04 — Coach UX (Wave 3)

```bash
npm run test:unit -- src/server/services/citizen-coach.test.ts
npm run test:unit -- src/server/ai/coach.test.ts
node scripts/run-supabase-sql.mjs -f supabase/migrations/20260722160003_chat_messages.sql
```

Manual:
1. Submit easy (self_help) report → success page polls → coach panel appears.
2. Submit hard (government) report → success page shows government messaging, no coach.
3. Refresh success/status → coach thread resumes.
4. With AI down → coach send disabled, warning shown.

### 11-05 — Dashboard quick actions (Wave 3)

```bash
npm run test:legacy -- tests/dashboard-table.test.mjs
```

Manual: dashboard header AI chip green/amber/red; Run triage now on pending row; bulk retry ≤25 failed/pending rows.

### 11-06 — Contracts + eval migration (Wave 4)

```bash
npm run test:legacy -- tests/citizen-status-contract.test.mjs
npm run test:unit -- src/server/evals
npm run eval:mock
npm run eval:gate
node scripts/run-supabase-sql.mjs -f supabase/tests/11_phase11_contract.sql
```

---

## Phase gate (all plans complete)

Add to `package.json` in 11-06:

```json
"phase11:gate": "npm run test:unit -- src/server/domain src/server/validation/evaluator-policy.test.ts src/server/triage src/server/health src/server/services/citizen-coach.test.ts src/server/ai/coach.test.ts src/server/evals && npm run test:legacy -- tests/citizen-status-contract.test.mjs tests/dashboard-table.test.mjs && npm run eval:mock && npm run eval:gate && node scripts/run-supabase-sql.mjs -f supabase/tests/11_phase11_contract.sql"
```

Run:

```bash
npm run phase11:gate
```

---

## Full test suite (pre-release)

```bash
npm run test
npm run phase11:gate
```

---

## Operator-only (not CI)

```bash
npm run eval:live
curl -s http://127.0.0.1:3000/api/health/ai
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3000/api/public/reports/analyze
```

Expect `/analyze` → **410 Gone**.

---

## Environment checklist

| Variable | Required for |
|----------|----------------|
| `SUPABASE_DB_URL` | SQL migrations + contracts |
| `THIRD_PARTY_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Live triage, coach, health probe |
| `INTERNAL_TRIAGE_SECRET` | Push dispatch (min 32 chars) |

---

## Multi-source coverage audit

| Source | Item | Plan |
|--------|------|------|
| GOAL | 11-key evaluator persistence | 11-01 |
| GOAL | Push dispatch on intake | 11-02 |
| GOAL | AI health ping | 11-03 |
| GOAL | Success-page coach + government branch | 11-04 |
| GOAL | Dashboard AI chip + quick triage | 11-05 |
| GOAL | Contract tests + eval 11-key | 11-06 |
| REQ | TRIAGE-09..11 | 11-01 |
| REQ | TRIAGE-12 | 11-02 |
| REQ | OPS-01 | 11-03 |
| REQ | SHELP-01..05 | 11-04 |
| REQ | DASH-09 | 11-05 |
| REQ | TRIAGE-13..14 | 11-06 |
| CONTEXT | D-01..D-16 | Distributed per plan (D-14 in 11-06) |
| RESEARCH | Dual-read, dispatch auth, coach schema, health cache | 11-01..11-04 |
| DEFERRED | WebSocket coach, officer coach preview, /analyze shim | Not planned |

**Status:** All requirements and locked decisions covered. No phase split required.
