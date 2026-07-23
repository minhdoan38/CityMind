# Phase 16: Secure Evidence Image Pipeline — Pattern Map

**Mapped:** 2026-07-23  
**Files analyzed:** 19 target new/modified files (from RESEARCH.md)  
**Analogs found:** 17 / 19

## Phase Context

**Goal:** Harden citizen evidence uploads with magic-byte validation, ClamAV INSTREAM scanning (fail closed), Sharp WebP sanitization, quarantine temp files, UUID object keys, and a batch migration script for legacy evidence objects.

**Delta from Phase 7 (DATA-09):** `evidence-service.ts` already validates JPEG/PNG/WebP via `file-type` and stores originals at `reports/{reportId}/evidence.{ext}`. Phase 16 inserts a **server-only pipeline** (scan → re-encode → upload WebP only) and changes object keys to `reports/{reportId}/{uuid}.webp`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/services/evidence-image-pipeline.ts` | service | file-I/O + transform | `src/server/services/evidence-service.ts` (`uploadEvidence`) | exact |
| `src/server/services/clamav-client.ts` | service | request-response | `src/server/health/ai-readiness.ts` (external probe client) | role-match |
| `src/server/services/evidence-service.ts` (modify) | service | file-I/O | same file | exact |
| `src/server/services/report-service.ts` (modify) | service | request-response | same file (`submitReport` upload block) | exact |
| `src/server/services/citizen-chat-intake.ts` (modify) | service | request-response | same file (`finalizeIntakeSubmit` upload block) | exact |
| `src/server/health/clamav-readiness.ts` | utility | request-response | `src/server/health/ai-readiness.ts` | exact |
| `src/app/api/health/clamav/route.ts` | route | request-response | `src/app/api/health/ai/route.ts` | exact |
| `src/server/health/readiness.ts` (modify) | utility | request-response | same file + `clamav-readiness.ts` | role-match |
| `src/lib/evidence-limits.ts` | utility | transform | `src/server/services/evidence-service.ts` (constants only) | role-match |
| `src/components/ReportForm.tsx` (modify) | component | request-response | same file | exact |
| `scripts/migrate-evidence-to-webp.mjs` | utility | batch | `scripts/capture-migration-inventory.mjs` | exact |
| `src/server/services/evidence-image-pipeline.test.ts` | test | file-I/O | `src/server/services/evidence-service.test.ts` | exact |
| `src/server/services/clamav-client.test.ts` | test | request-response | `src/server/health/ai-readiness.test.ts` | role-match |
| `src/server/health/clamav-readiness.test.ts` | test | request-response | `src/server/health/ai-readiness.test.ts` | exact |
| `src/server/services/evidence-service.test.ts` (extend) | test | file-I/O | same file | exact |
| `tests/report-form.test.mjs` (extend) | test | batch | same file | exact |
| `supabase/tests/16_phase16_contract.sql` | test | batch | `supabase/tests/14_phase14_contract.sql` + migration `20260721130001` | role-match |
| `package.json` (`phase16:gate`, deps) | config | batch | `phase14:gate`, `phase15:gate` | exact |
| `src/server/http/errors.ts` (modify) | utility | transform | same file (`imageTooLarge`) | exact |

## Pattern Assignments

### `src/server/services/evidence-image-pipeline.ts` (service, file-I/O + transform)

**Analog:** `src/server/services/evidence-service.ts`

**Imports pattern** (lines 1-4):

```typescript
import "server-only";

import { fileTypeFromBuffer } from "file-type";
import type { SupabaseClient } from "@supabase/supabase-js";
```

**Validation + storage gate** (lines 178-256) — pipeline step 1–2 reuse before scan:

```typescript
export async function validateEvidenceBytes(
  bytes: Uint8Array | Buffer | null | undefined,
  options: {
    maxBytes: number;
    declaredContentLength?: number | null;
    declaredMimeType?: string | null;
  },
): Promise<EvidenceValidationResult> {
  // ... size gate, detectImageMime, spoofed_mime check ...
}

export async function uploadEvidence(options: {
  client: SupabaseClient;
  reportId: string;
  bytes: Uint8Array | Buffer;
  bucketName: string;
  maxBytes?: number;
  declaredContentLength?: number | null;
  declaredMimeType?: string | null;
}): Promise<string> {
  const validation = await validateEvidenceBytes(options.bytes, { maxBytes, ... });
  if (!validation.ok) {
    throw new EvidenceServiceError(validation.code, "Evidence upload rejected");
  }
  const objectPath = buildEvidenceObjectPath(options.reportId, validation.ext);
  const { error } = await options.client.storage
    .from(options.bucketName)
    .upload(objectPath, normalized, {
      contentType: validation.mimeType,
      upsert: false,
    });
  // ...
}
```

**Pipeline orchestration contract** — replace direct `uploadEvidence` at call sites with:

```typescript
// New export — orchestrate quarantine → scan → sharp → upload
export async function processAndStoreEvidence(options: {
  client: SupabaseClient;
  reportId: string;
  bytes: Uint8Array | Buffer;
  bucketName: string;
  declaredContentLength?: number | null;
  declaredMimeType?: string | null;
}): Promise<{ evidenceUri: string; webpBytes: Uint8Array }>;
```

**Temp file pattern** — analog `src/server/evals/load-dataset.test.ts` (lines 1-20):

```typescript
import { mkdtemp, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const quarantineDir = path.join(tmpdir(), "citymind-quarantine");
// write to `${quarantineDir}/${randomUUID()}.bin`; always unlink in finally
```

**Final upload must use `contentType: 'image/webp'`** — change from input MIME to canonical WebP (current code uses `validation.mimeType` at line 248).

**Error class** — extend or mirror `EvidenceServiceError` (lines 93-101):

```typescript
export class EvidenceServiceError extends Error {
  readonly code: EvidenceValidationErrorCode | "storage_failed" | "invalid_uri";
  constructor(code: EvidenceServiceError["code"], message: string) {
    super(message);
    this.name = "EvidenceServiceError";
    this.code = code;
  }
}
```

Add pipeline codes: `infected`, `scanner_unavailable`, `transform_failed` (map at API layer per RESEARCH.md).

---

### `src/server/services/clamav-client.ts` (service, request-response)

**Analog:** `src/server/health/ai-readiness.ts` (lazy init + bounded probe) + RESEARCH Pattern 2

**Singleton + TTL cache pattern** (ai-readiness lines 21-27, 50-86):

```typescript
const AI_HEALTH_TTL_MS = 45_000;
let cache: { at: number; body: AiHealthResponse } | null = null;

export function resetAiHealthCache(): void {
  cache = null;
}

export async function checkAiHealth(
  env: ServerEnv = getServerEnv(),
  options: { now?: number; fetchImpl?: typeof fetch } = {},
): Promise<AiHealthResult> {
  const now = options.now ?? Date.now();
  if (cache && now - cache.at < AI_HEALTH_TTL_MS) {
    return { body: cache.body, cacheHit: true };
  }
  // ... probe ...
}
```

**ClamAV init** (from RESEARCH — apply in `clamav-client.ts`):

```typescript
import NodeClam from "clamscan";
import { Readable } from "node:stream";

// Lazy-init once; localFallback: false (critical)
const clam = await new NodeClam().init({
  removeInfected: false,
  preference: "clamdscan",
  clamdscan: {
    host: process.env.CLAMAV_HOST ?? "127.0.0.1",
    port: Number(process.env.CLAMAV_PORT ?? 3310),
    timeout: Number(process.env.CLAMAV_TIMEOUT_MS ?? 30_000),
    localFallback: false,
    active: true,
  },
  clamscan: { active: false },
});

export async function assertCleanBuffer(bytes: Uint8Array): Promise<void> {
  const stream = Readable.from(Buffer.from(bytes));
  const { isInfected, viruses } = await clam.scanStream(stream);
  if (isInfected) {
    throw new EvidenceScanError("infected", viruses?.join(", ") ?? "malware");
  }
}
```

**Env gate:** skip scan only when `CLAMAV_ENABLED === 'false'`; default enabled → fail closed on ping/scan errors.

---

### `src/server/services/evidence-service.ts` (modify)

**Analog:** same file

**Path migration** (lines 115-117) — change signature to UUID WebP keys:

```typescript
// Current
export function buildEvidenceObjectPath(reportId: string, ext: string): string {
  return `reports/${reportId}/evidence.${ext}`;
}

// Phase 16: reports/{reportId}/{objectId}.webp
export function buildEvidenceObjectPath(
  reportId: string,
  objectId: string = randomUUID(),
): string {
  return `reports/${reportId}/${objectId}.webp`;
}
```

**Size default** (line 6) — align with bucket `file_size_limit` 10485760:

```typescript
export const DEFAULT_MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
// → 10 * 1024 * 1024 (or import from evidence-limits.ts)
```

**GIF/SVG rejection** — extend `detectImageMime` / `ALLOWED_IMAGE_MIME_TYPES` block (lines 8-12, 75-81): explicit reject when `file-type` returns `image/gif` or `image/svg+xml`.

**Keep** `parseEvidencePath`, `downloadEvidenceObject` EXT_TO_MIME map (lines 20-25, 309-312) — `.webp` already mapped; officer stream unchanged.

---

### `src/server/services/report-service.ts` (modify)

**Analog:** same file — `submitReport` and `analyzeReport` upload blocks

**Upload call site** (lines 202-211):

```typescript
if (imageBytes && imageMime) {
  evidenceUri = await uploadEvidence({
    client: deps.client,
    reportId,
    bytes: imageBytes,
    bucketName: deps.evidenceBucket ?? EVIDENCE_BUCKET,
    maxBytes: deps.maxEvidenceBytes ?? resolveMaxEvidenceBytes(),
    declaredContentLength: imageBytes.byteLength,
    declaredMimeType: imageMime,
  });
}
```

**Replace with** `processAndStoreEvidence`; pass **sanitized `webpBytes`** to triage/AI instead of original bytes (analyzeReport line 332).

**Error mapping** (lines 255-268):

```typescript
if (error instanceof EvidenceServiceError) {
  if (error.code === "oversized") {
    throw imageTooLarge();
  }
  if (
    error.code === "invalid_type" ||
    error.code === "spoofed_mime" ||
    error.code === "empty"
  ) {
    throw unsupportedImageType("unknown");
  }
}
```

**Extend** for `scanner_unavailable` → `HttpError(503, ...)` and `infected`/`transform_failed` → `unsupportedImageType("unknown")` (generic citizen message per DATA-10).

**Compensation delete** (lines 247-252) — keep pattern when DB/triage fails after upload:

```typescript
if (evidenceUri) {
  try {
    await deleteEvidenceByUri({ client: deps.client, uri: evidenceUri });
  } catch {
    // Compensation delete is best-effort; original failure still surfaces.
  }
}
```

---

### `src/server/services/citizen-chat-intake.ts` (modify)

**Analog:** same file — `finalizeIntakeSubmit` (lines 405-414)

**Pre-upload validation** (lines 350-361) — already calls `validateEvidenceBytes`; after pipeline centralizes validation, keep single path through `processAndStoreEvidence` in `finalizeIntakeSubmit` only.

**Error mapping** (lines 470-479) — identical to `report-service.ts`; extend for scanner/pipeline codes.

---

### `src/server/health/clamav-readiness.ts` (utility, request-response)

**Analog:** `src/server/health/ai-readiness.ts`

**TTL cache + probe** (lines 21-27, 50-86):

```typescript
const AI_HEALTH_TTL_MS = 45_000;
let cache: { at: number; body: AiHealthResponse } | null = null;

export async function checkAiHealth(
  env: ServerEnv = getServerEnv(),
  options: { now?: number; fetchImpl?: typeof fetch } = {},
): Promise<AiHealthResult> {
  const now = options.now ?? Date.now();
  if (cache && now - cache.at < AI_HEALTH_TTL_MS) {
    return { body: cache.body, cacheHit: true };
  }
  // ...
}
```

**ClamAV variant:**

```typescript
export type ClamavHealthResponse = {
  status: "up" | "down";
  latency_ms: number;
  checked_at: string;
};

export async function checkClamavHealth(options?: {
  now?: number;
}): Promise<{ body: ClamavHealthResponse; cacheHit: boolean }> {
  // await clam.ping() with bounded timeout; return down on throw
}
```

Export `resetClamavHealthCache()` for tests (mirror `resetAiHealthCache`).

---

### `src/app/api/health/clamav/route.ts` (route, request-response)

**Analog:** `src/app/api/health/ai/route.ts`

```typescript
import { checkClamavHealth } from "@/server/health/clamav-readiness";

export async function GET() {
  const result = await checkClamavHealth();
  const status = result.body.status === "down" ? 503 : 200;

  return Response.json(result.body, {
    status,
    headers: {
      "Cache-Control": "private, max-age=30",
      "X-Cache": result.cacheHit ? "HIT" : "MISS",
    },
  });
}
```

---

### `src/server/health/readiness.ts` (modify)

**Analog:** same file — add `clamav` to `dependencies[]` when `CLAMAV_ENABLED !== 'false'`

**Dependency probe pattern** (lines 33-88):

```typescript
export async function checkReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReadinessResponse> {
  const started = Date.now();
  // ... supabase probe with withTimeout(READINESS_TIMEOUT_MS) ...
  return {
    status: "ready",
    dependencies: [
      { name: "supabase", status: "up", latency_ms: Date.now() - started },
    ],
  };
}
```

**Apply:** When ClamAV enabled, append `{ name: "clamav", status, latency_ms }`; set `status: "not_ready"` if clamav down (fail closed for ops).

---

### `src/lib/evidence-limits.ts` (utility, transform)

**Analog:** `src/server/services/evidence-service.ts` constants (lines 6, 103-113)

**Must NOT import `server-only`** — client components import this.

```typescript
// Client-safe mirror of server limits
export const DEFAULT_MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function resolveMaxEvidenceBytesFromEnv(
  env: Record<string, string | undefined> = {},
): number {
  const raw = env.NEXT_PUBLIC_MAX_IMAGE_BYTES?.trim() ?? env.MAX_IMAGE_BYTES?.trim();
  // same parse logic as evidence-service resolveMaxEvidenceBytes
}
```

Server `evidence-service.ts` re-exports or imports from here to avoid drift (SEC-IMG-08).

---

### `src/components/ReportForm.tsx` (modify)

**Analog:** same file (lines 25-32, 77-83, 254)

```typescript
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  // ...
];

image: z
  .custom<FileList | undefined>()
  .refine((files) => {
    if (!files?.[0]) return true;
    return files[0].size <= MAX_FILE_SIZE;
  }, "Max image size is 8MB.")
```

**Apply:** Import `DEFAULT_MAX_EVIDENCE_BYTES` from `@/lib/evidence-limits`; update Zod message to `10MB`; keep `accept` JPEG/PNG/WebP only (no GIF/SVG).

---

### `scripts/migrate-evidence-to-webp.mjs` (utility, batch)

**Analog:** `scripts/capture-migration-inventory.mjs`

**Script skeleton** (lines 1-21, 64-75, 31-61):

```javascript
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "./load-project-env.mjs";

function fail(message) {
  console.error(`capture-migration-inventory: ${message}`);
  process.exit(1);
}

async function listEvidenceObjects(client) {
  const objects = [];
  const { data: reportFolders, error } = await client.storage
    .from("evidence")
    .list("reports", { limit: 1000 });
  // ... nested list + download + sha256 ...
}
```

**Phase 16 deltas:**
- CLI flags: `--dry-run`, `--limit`, `--report-id`
- Per object: download → Sharp WebP → upload `reports/{id}/{uuid}.webp` → `UPDATE reports SET evidence_path` → `storage.remove` old key
- JSON summary to stdout: `{ converted, skipped, failed, sha256_before, sha256_after }`
- Use `fail()` + `main().catch(...)` exit pattern from lines 163-164

---

### `src/server/services/evidence-image-pipeline.test.ts` (test)

**Analog:** `src/server/services/evidence-service.test.ts`

**Fixture bytes** (lines 15-25):

```typescript
const PNG_BYTES = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);
```

**Mock storage client** (lines 111-143):

```typescript
function createStorageClient() {
  const uploaded: Record<string, { bytes: Uint8Array; contentType: string }> = {};
  const bucket = {
    upload: vi.fn(async (path, file, options) => { ... }),
    remove: vi.fn(async (paths) => { ... }),
  };
  return { client: { storage: { from: vi.fn(() => bucket) } }, bucket, uploaded };
}
```

**Apply:** Mock `clamav-client.assertCleanBuffer`, `fs/promises` unlink; assert output `contentType: 'image/webp'`; assert quarantine file deleted on success and failure.

---

### `src/server/services/clamav-client.test.ts` (test)

**Analog:** `src/server/health/ai-readiness.test.ts`

**Mock external dependency** (lines 35-44, 71-76):

```typescript
it("returns down when AI env is missing", async () => {
  const result = await checkAiHealth({ ...BASE_ENV, THIRD_PARTY_API_KEY: "" });
  expect(result.body.status).toBe("down");
});

it("returns down when the provider responds with an error", async () => {
  const fetchImpl = vi.fn(async () => new Response("error", { status: 500 }));
  const result = await checkAiHealth(BASE_ENV, { fetchImpl, now: 3_000 });
  expect(result.body.status).toBe("down");
});
```

**Apply:** `vi.mock('clamscan')` — mock `init`, `ping`, `scanStream` returning `{ isInfected: false }` / `{ isInfected: true, viruses: ['Eicar'] }` / throw for fail-closed.

---

### `src/server/health/clamav-readiness.test.ts` (test)

**Analog:** `src/server/health/ai-readiness.test.ts` — cache TTL test (lines 78-87):

```typescript
it("serves cached responses within the TTL", async () => {
  const fetchImpl = vi.fn(async () => okResponse());
  const first = await checkAiHealth(BASE_ENV, { fetchImpl, now: 4_000 });
  const second = await checkAiHealth(BASE_ENV, { fetchImpl, now: 10_000 });
  expect(first.cacheHit).toBe(false);
  expect(second.cacheHit).toBe(true);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
```

---

### `src/server/services/evidence-service.test.ts` (extend)

**Analog:** same file

**Add cases:**
- Reject GIF magic bytes (`GIF89a...`) → `invalid_type`
- Reject SVG (`<svg...`) → `invalid_type`
- `buildEvidenceObjectPath` returns `reports/{id}/{uuid}.webp` shape
- Update deterministic path assertions (line 154-157) for new key format

---

### `tests/report-form.test.mjs` (extend)

**Analog:** same file (line 42):

```javascript
assert.match(form, /8\s*\*\s*1024\s*\*\s*1024/);
```

**Apply:** Assert import from `evidence-limits` or `10 * 1024 * 1024`.

---

### `supabase/tests/16_phase16_contract.sql` (test, batch)

**Analog:** `supabase/tests/14_phase14_contract.sql` + bucket invariants from `20260721130001_next_backend_contract.sql`

**Assert helper** (14_phase14 lines 7-16):

```sql
CREATE OR REPLACE FUNCTION _test_assert(condition boolean, message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF NOT condition THEN
        RAISE EXCEPTION 'ASSERTION FAILED: %', message;
    END IF;
END;
$$;
```

**Bucket contract** (migration lines 9-16):

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence', 'evidence', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
```

**Phase 16 assertions:**
- `evidence` bucket `public = false`, `file_size_limit = 10485760`
- `allowed_mime_types` contains `image/webp` (post-migration may narrow to webp-only per planner)
- Sample `evidence_path` matching `^evidence/reports/[^/]+/.+\.webp$` passes `reports_evidence_path_format_chk`

---

### `package.json` (`phase16:gate`, deps)

**Analog:** `phase14:gate` / `phase15:gate` (lines 22-23)

```json
"phase15:gate": "npm run test:unit -- src/server/domain/guidance-resolver.test.ts ... && npm run test:legacy -- tests/chat-intake-contract.test.mjs ... && node scripts/run-supabase-sql.mjs -f supabase/tests/15_phase15_contract.sql"
```

**Proposed `phase16:gate`:**

```json
"phase16:gate": "npm run test:unit -- src/server/services/evidence-service.test.ts src/server/services/evidence-image-pipeline.test.ts src/server/services/clamav-client.test.ts src/server/health/clamav-readiness.test.ts && npm run test:legacy -- tests/report-form.test.mjs && node scripts/run-supabase-sql.mjs -f supabase/tests/16_phase16_contract.sql"
```

**Dependencies:** add `"sharp": "^0.35.3"`, `"clamscan": "^2.4.0"` (`file-type` already at `^22.0.1`).

---

### `src/server/http/errors.ts` (modify)

**Analog:** same file (lines 49-57)

```typescript
export function imageTooLarge(): HttpError {
  return new HttpError(413, "Image exceeds configured size limit");
}

export function unsupportedImageType(received = "unknown"): HttpError {
  return new HttpError(
    415,
    `Only JPEG, PNG, or WebP images are accepted. Received: ${received}`,
  );
}
```

**Add** (optional dedicated helper):

```typescript
export function evidenceScanningUnavailable(): HttpError {
  return new HttpError(503, "Evidence scanning is temporarily unavailable");
}
```

Use generic `unsupportedImageType("unknown")` for infected/transform failures — do not echo virus names.

---

## Shared Patterns

### Server-only module guard

**Source:** `src/server/services/evidence-service.ts` line 1  
**Apply to:** `evidence-image-pipeline.ts`, `clamav-client.ts`, `clamav-readiness.ts`

```typescript
import "server-only";
```

### Evidence error → HTTP mapping

**Source:** `src/server/services/report-service.ts` lines 105-112, 255-268  
**Apply to:** `report-service.ts`, `citizen-chat-intake.ts`, any new API routes

```typescript
function mapEvidenceValidationError(code): HttpError {
  if (code === "oversized") return imageTooLarge();
  return unsupportedImageType("unknown");
}
```

### Compensation delete on partial failure

**Source:** `src/server/services/report-service.ts` lines 247-252  
**Apply to:** All upload call sites after pipeline introduction

### Officer evidence streaming (verify only)

**Source:** `src/server/services/officer-read.ts` lines 210-248

```typescript
const { bytes, mimeType } = await downloadEvidenceLocation({
  client: auth.context.client,
  evidencePath: reference.evidencePath,
});
return new Response(Buffer.from(bytes), {
  status: 200,
  headers: { "Content-Type": mimeType, ETag: etag, ... },
});
```

No changes expected — `.webp` extension maps via `EXT_TO_MIME` in `evidence-service.ts`.

### Batch script env loading

**Source:** `scripts/load-project-env.mjs` lines 34-56

```javascript
export function loadProjectEnv() {
  const merged = {
    ...parseEnvFile(path.join(REPO_ROOT, ".env.local")),
    ...parseEnvFile(path.join(REPO_ROOT, ".env")),
    ...process.env,
  };
  // SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY normalization
  return merged;
}
```

### Phase gate composition

**Source:** `package.json` — vitest subset + legacy contract + `run-supabase-sql.mjs -f supabase/tests/NN_phaseNN_contract.sql`

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Sharp WebP sanitization internals | service | transform | No existing `sharp` usage in codebase — follow RESEARCH Pattern 1 + sharp docs |
| ClamAV INSTREAM TCP client | service | request-response | No prior malware scanning — `clamscan` npm is new integration (slopcheck approved) |

## Metadata

**Analog search scope:** `src/server/services/`, `src/server/health/`, `src/app/api/health/`, `src/app/api/ready/`, `scripts/`, `supabase/tests/`, `src/components/ReportForm.tsx`, `tests/report-form.test.mjs`  
**Files scanned:** ~35  
**Pattern extraction date:** 2026-07-23

## PATTERN MAPPING COMPLETE

**Phase:** 16 - Secure evidence image pipeline  
**Files classified:** 19  
**Analogs found:** 17 / 19

### Coverage
- Files with exact analog: 12
- Files with role-match analog: 5
- Files with no analog: 2 (Sharp pipeline core, ClamAV TCP client)

### Key Patterns Identified
- Centralize all uploads through `processAndStoreEvidence()` replacing direct `uploadEvidence()` at three call sites (`report-service`, `citizen-chat-intake`)
- ClamAV health mirrors `ai-readiness.ts` TTL cache + `/api/health/ai` route shape
- Batch migration mirrors `capture-migration-inventory.mjs` Storage list/download + `loadProjectEnv` + JSON stdout
- Client/server size limits share `src/lib/evidence-limits.ts` (no `server-only`)
- Error mapping stays generic for citizens; 503 only for scanner unavailable

### File Created
`.planning/phases/16-secure-evidence-image-pipeline-accept-jpeg-png-webp-via-magi/16-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
