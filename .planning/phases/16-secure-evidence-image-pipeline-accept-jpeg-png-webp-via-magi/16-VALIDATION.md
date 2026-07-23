---
phase: 16-secure-evidence-image-pipeline-accept-jpeg-png-webp-via-magi
phase_number: 16
updated: 2026-07-23
---

# Phase 16 — Validation Commands

**Phase:** Secure evidence image pipeline — ClamAV + Sharp WebP sanitization  
**Updated:** 2026-07-23

Run from repository root. SQL gates require `SUPABASE_DB_URL` (skip locally if unset — document in SUMMARY).

---

## Per-plan gates

### 16-01 — Dependencies + ClamAV client (Wave 1)

```bash
npm run test:unit -- src/server/services/clamav-client.test.ts
```

### 16-02 — Sharp pipeline + evidence-service integration (Wave 2)

```bash
npm run test:unit -- src/server/services/evidence-image-pipeline.test.ts src/server/services/evidence-service.test.ts
```

### 16-03 — Upload path wiring + limits alignment (Wave 2)

```bash
npm run test:unit -- src/server/services/report-service.test.ts
npm run test:unit -- src/server/services/citizen-chat-intake.test.ts
```

### 16-04 — Batch migration script + health probe (Wave 3)

```bash
node scripts/migrate-evidence-to-webp.mjs --dry-run
npm run test:unit -- src/server/health/clamav-readiness.test.ts
```

### 16-05 — Gate, SQL contract, traceability (Wave 3)

```bash
grep "SEC-IMG" .planning/REQUIREMENTS.md
npm run phase16:gate
```

---

## Phase gate

```bash
npm run phase16:gate
```

**Expected composition:**

1. Unit: `clamav-client.test.ts`, `evidence-image-pipeline.test.ts`, `evidence-service.test.ts`, `clamav-readiness.test.ts`, report/chat intake image tests
2. Legacy: report form / evidence limit contract tests (SEC-IMG-08)
3. SQL: `supabase/tests/16_phase16_contract.sql` (evidence bucket MIME policy + storage path conventions)

---

## Manual / environment checks

| Check | Command | Pass criteria |
|-------|---------|---------------|
| ClamAV daemon | `clamdscan --version` or TCP ping `127.0.0.1:3310` | Responds when `CLAMAV_ENABLED=true` |
| EICAR test | Upload EICAR test file via dev API | 422/503 reject, generic citizen message |
| WebP output | Submit JPEG report | `evidence_path` ends with `.webp`; officer image route serves `image/webp` |
| Batch dry-run | `node scripts/migrate-evidence-to-webp.mjs --dry-run` | Lists legacy non-webp objects without mutating |
