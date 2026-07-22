---
phase: 12-dashboard-advisory-assistant-conversational-officer-chat-wid
phase_number: 12
updated: 2026-07-22
---

# Phase 12 — Validation Commands

**Phase:** 12-dashboard-advisory-assistant-conversational-officer-chat-wid  
**Updated:** 2026-07-22

Run from repository root (`CityMind/`). Requires Supabase (`SUPABASE_DB_URL`) for SQL gates and AI credentials for live assistant calls.

---

## Per-plan gates

### 12-01 — Persistence + repository (Wave 1)

```bash
npm run test:unit -- src/server/repositories/officer-assistant-messages.test.ts
node scripts/run-supabase-sql.mjs -f supabase/migrations/*_officer_assistant_messages.sql
node scripts/run-supabase-sql.mjs -f supabase/tests/12_phase12_contract.sql
```

### 12-02 — Service hardening + report attach (Wave 2)

```bash
npm run test:unit -- src/server/services/officer-assistant.test.ts
npm run test:unit -- src/server/ai/officer-assistant.test.ts
```

### 12-03 — Widget UX + health contract (Wave 2)

```bash
npm run test:legacy -- tests/advisory-assistant-widget.test.mjs
grep -E "assistantDegraded|assistantUnavailable|assistantThinking" messages/en.json messages/vi.json
```

Manual:
1. Log in as officer → open dashboard → send assistant message → receive reply.
2. Refresh page → thread persists (after 12-01).
3. With AI down → send disabled, `assistantUnavailable` shown.
4. With AI degraded → amber warning, send still works.

---

## Phase gate

```bash
npm run phase12:gate
```

Expected: all unit tests pass + `12_phase12_contract.sql` exits 0.

---

## Requirement traceability

| Req ID | Automated | Manual |
|--------|-----------|--------|
| DASH-10 | Widget i18n grep | Dashboard visual check |
| DASH-10a | `officer-assistant.test.ts` (401, 422, 429, 503) | — |
| DASH-10b | `officer-assistant.test.ts` context injection | `src/server/ai/officer-assistant.test.ts` | — |
| DASH-10c | repository test + SQL contract | Refresh persistence |
| DASH-10d | attach 404 test | Attach from report detail |
| DASH-10e | `phase12:gate` | EN/VI copy review |
