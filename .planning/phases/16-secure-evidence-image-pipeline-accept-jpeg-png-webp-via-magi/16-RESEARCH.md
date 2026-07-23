# Phase 16: Secure evidence image pipeline — Research

**Researched:** 2026-07-23
**Domain:** Secure citizen evidence upload — magic-byte validation, ClamAV INSTREAM scanning, Sharp WebP sanitization, Supabase Storage, batch migration
**Confidence:** HIGH (architecture + Sharp + existing codebase); MEDIUM (ClamAV Windows laptop ops)

## Summary

Phase 16 hardens the existing evidence upload path in `evidence-service.ts`, which already validates JPEG/PNG/WebP via `file-type` magic bytes and stores originals in the private Supabase `evidence` bucket at `reports/{reportId}/evidence.{ext}` (DATA-09 complete). The phase adds a **server-only sanitization pipeline** before any object reaches Storage or AI: size gate → magic-byte gate (reject SVG/GIF) → **ClamAV INSTREAM scan (fail closed)** → **Sharp decode/re-encode to WebP** (quality 88, metadata stripped, EXIF auto-orient) → upload final bytes only.

Inbound bytes should land in a **local quarantine temp file** named with a random UUID (never executed, never under a public static path). After successful scan + re-encode, upload to the private bucket using a UUID-based object key (e.g. `reports/{reportId}/{uuid}.webp`), persist `evidence_path`, and delete the quarantine temp file. Legacy `reports/{id}/evidence.jpg|png|webp` objects are converted by a **batch script** modeled on `scripts/capture-migration-inventory.mjs`.

ClamAV runs as a **separate `clamd` daemon** (Windows MSI service on loopback `127.0.0.1:3310`, or optional `clamav/clamav` container for dev). The Node app talks to it over TCP using the `clamscan` package’s `scanStream` / buffer APIs (INSTREAM under the hood). Set `localFallback: false` so scanner unavailability does not silently skip scanning.

**Primary recommendation:** Add `evidence-image-pipeline.ts` + `clamav-client.ts` under `src/server/services/`, refactor `uploadEvidence()` to call the pipeline once, add `scripts/migrate-evidence-to-webp.mjs`, extend `/api/ready` (or add `/api/health/clamav`) with a bounded PING probe, and gate with Vitest + a new `phase16:gate` SQL contract for bucket MIME alignment.

<phase_requirements>
## Phase Requirements (proposed — add to REQUIREMENTS.md during planning)

| ID | Description | Research Support |
|----|-------------|------------------|
| **SEC-IMG-01** | Server accepts only JPEG/PNG/WebP detected by magic bytes; rejects SVG, GIF, spoofed `Content-Type`, and non-image payloads before Storage/AI | Extend `validateEvidenceBytes`; explicit GIF/SVG rejection; existing `file-type` + sniff fallback [VERIFIED: `evidence-service.ts`] |
| **SEC-IMG-02** | Every evidence upload scanned via ClamAV `INSTREAM` before persist; **fail closed** on infection or scanner error when scanning is enabled | `clamscan` TCP + `scanStream`; map errors to 503; no `localFallback` [CITED: ClamAV INSTREAM protocol] |
| **SEC-IMG-03** | Sharp sanitization: decode with pixel/channel limits, auto-orient, WebP re-encode at quality 88, strip metadata | `sharp(buffer, { limitInputPixels, failOn: 'warning' }).rotate().webp({ quality: 88 })` [CITED: sharp docs] |
| **SEC-IMG-04** | Process inbound bytes in-memory for ≤10MB uploads; final object in private bucket only under UUID key (`reports/{reportId}/{uuid}.webp`); no OS quarantine file for MVP | In-memory INSTREAM + private bucket [RESOLVED: Open Q3] |
| **SEC-IMG-05** | Configurable max upload size (default **10MB**, aligned with Supabase `file_size_limit`) | `MAX_IMAGE_BYTES` + bucket 10485760 [VERIFIED: migration SQL] |
| **SEC-IMG-06** | Batch script migrates legacy evidence objects to WebP and updates `reports.evidence_path` | Reuse `capture-migration-inventory.mjs` listing/download pattern |
| **SEC-IMG-07** | Ops health: ClamAV reachability probe (PING) with bounded timeout, consumed by readiness or dedicated endpoint | Mirror `ai-readiness.ts` / `readiness.ts` patterns [VERIFIED: codebase] |
| **SEC-IMG-08** | Client `accept` and Zod size limits stay consistent with server max bytes | Update `ReportForm.tsx` 8MB → 10MB when server default changes |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Client file picker / Zod pre-check | Browser | — | UX only; never authoritative |
| Multipart parse + rate limit | API / Backend | — | `report-service.ts`, `citizen-chat-intake.ts` |
| Magic-byte validation | API / Backend | — | `evidence-service.ts` before scan/transform |
| ClamAV INSTREAM scan | API / Backend | External `clamd` | Bytes must be scanned server-side before Storage |
| Sharp decode / re-encode | API / Backend | — | CPU-bound sanitization on Node process |
| Quarantine temp files | API / Backend (OS temp) | — | Never web-served; deleted after pipeline |
| Final evidence storage | Database / Storage | API writes via service role | Private Supabase `evidence` bucket |
| Officer image streaming | API / Backend | Storage read | `officer-read.ts` — auth gate, no public URLs |
| AI vision input | API / Backend | — | Triage downloads sanitized WebP from Storage |
| Batch WebP migration | Tooling script | Storage + Postgres | Offline `scripts/*.mjs`, not request path |
| ClamAV daemon lifecycle | OS / optional container | — | Outside Next.js process per project constraint |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `file-type` | 22.0.1 (installed) | Magic-byte MIME detection | Already used in `evidence-service.ts`; do not trust `Content-Type` [VERIFIED: `package.json`] |
| `sharp` | 0.35.3 [VERIFIED: npm registry] | Decode, orient, pixel limits, WebP output | De-facto Node image pipeline; libvips-backed; metadata stripped by default [CITED: https://sharp.pixelplumbing.com/api-constructor/] |
| `clamscan` | 2.4.0 [VERIFIED: npm registry] | TCP/INSTREAM client to `clamd` | Maintained ClamAV Node client with `scanStream`, `ping`; uses INSTREAM when socket/TCP configured [CITED: https://github.com/kylefarris/clamscan] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` `randomUUID()` | Node 22+ | Quarantine + object filenames | Already used for `reportId` in submit flow |
| `node:fs/promises` + `node:os` | Node built-in | Quarantine temp files | Write inbound bytes to `%TEMP%/citymind-quarantine/{uuid}` |
| `node:stream` `Readable` | Node built-in | Feed `clamscan.scanStream` | Bridge `Uint8Array` → INSTREAM without temp file (optional); temp file still useful for large uploads |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `clamscan` npm | Hand-rolled TCP INSTREAM | Protocol framing is error-prone; official docs specify chunk format [CITED: ClamAV protocol] |
| `clamscan` npm | `clamdjs` `scanBuffer` | Less npm adoption; `clamscan` already documents `scanStream` + `ping` |
| Local temp quarantine | Bucket prefix `quarantine/` | Bucket quarantine leaves malware bytes in Storage; prefer OS temp + delete |
| Sharp WebP output | Store original format | User requirement: canonical WebP storage reduces polyglot risk |
| ClamAV on Windows MSI | `clamav/clamav` Docker | App runtime is Docker-free; ClamAV container is **optional dev-only** sidecar |

**Installation:**

```bash
npm install sharp clamscan
```

(`file-type` already present.)

**Version verification:**

```bash
npm view sharp version          # 0.35.3
npm view clamscan version       # 2.4.0
npm view file-type version      # 22.0.1
```

## Package Legitimacy Audit

> slopcheck ran 2026-07-23 — all three packages `[OK]`; slopcheck auto-install failed on Windows PATH (packages not installed by slopcheck runner).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `sharp` | npm | mature (libvips) | very high | github.com/lovell/sharp | OK | Approved |
| `clamscan` | npm | ~2014+ (v2.4.0) | moderate | github.com/kylefarris/clamscan | OK | Approved |
| `file-type` | npm | mature | very high | github.com/sindresorhus/file-type | OK | Already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none  

**Postinstall check:** `clamscan` — no `postinstall` script [VERIFIED: npm view]; `sharp` — platform-specific binary install (expected).

## Architecture Patterns

### System Architecture Diagram

```
Citizen (ReportForm / intake submit)
        │ multipart FormData field "image"
        ▼
┌───────────────────────────────────────────────────────────┐
│ API route → report-service / citizen-chat-intake          │
│   rate limit → parse FormData → Uint8Array in memory      │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│ evidence-image-pipeline.processEvidenceUpload()           │
│  1. size gate (MAX_IMAGE_BYTES, default 10MB)             │
│  2. magic bytes (file-type) → reject GIF/SVG/unknown      │
│  3. write quarantine temp: {tmpdir}/citymind/{uuid}.bin   │
│  4. ClamAV INSTREAM scan ──────────────► clamd :3310      │
│        │ infected → delete temp → 422 generic             │
│        │ scanner error → delete temp → 503 fail-closed    │
│  5. Sharp: decode, limitInputPixels, rotate/autoOrient,   │
│            webp q=88, metadata stripped                   │
│        │ transform error → delete temp → 415 generic      │
│  6. upload WebP to Supabase evidence bucket               │
│     key: reports/{reportId}/{uuid}.webp                   │
│  7. delete quarantine temp                                  │
└───────────────────────────┬─────────────────────────────┘
                            │ evidence_path = evidence/reports/...
                            ▼
┌───────────────────────────────────────────────────────────┐
│ Postgres reports.evidence_path + triage AI download       │
│ Officer GET image → officer-read → Storage download       │
└───────────────────────────────────────────────────────────┘

Batch (offline): migrate-evidence-to-webp.mjs
  list Storage → download → Sharp → upload .webp → UPDATE evidence_path → remove legacy object
```

### Recommended Project Structure

```
src/server/services/
├── evidence-service.ts           # path helpers, Storage CRUD, validateEvidenceBytes (keep)
├── evidence-image-pipeline.ts    # orchestrate quarantine → scan → sharp → upload
├── clamav-client.ts              # singleton init, ping(), scanBuffer(), fail-closed policy
├── evidence-image-pipeline.test.ts
└── clamav-client.test.ts

src/server/health/
├── clamav-readiness.ts           # optional: PING + TTL cache (mirror ai-readiness)
└── clamav-readiness.test.ts

scripts/
└── migrate-evidence-to-webp.mjs  # batch conversion + dry-run flag

supabase/tests/
└── 16_phase16_contract.sql       # bucket MIME, evidence_path samples
```

### Pattern 1: Centralize upload through one pipeline function

**What:** Replace direct `uploadEvidence({ bytes })` storage of raw bytes with `processAndStoreEvidence({ reportId, bytes, declaredMime })` that returns `{ evidencePath, webpBytes }`.

**When to use:** All three call sites: `report-service.ts` `submitReport`, `analyzeReport` (legacy), `citizen-chat-intake.ts` `finalizeIntakeSubmit`.

**Example:**

```typescript
// Source: sharp constructor + output docs
// https://sharp.pixelplumbing.com/api-constructor/
// https://sharp.pixelplumbing.com/api-output/
import sharp from "sharp";

const WEBP_QUALITY = 88;
const MAX_PIXELS = 16_777_216; // 4096×4096 — planner may tune via env

export async function sanitizeToWebp(input: Uint8Array): Promise<Buffer> {
  return sharp(input, {
    failOn: "warning",
    limitInputPixels: MAX_PIXELS,
    animated: false,
    pages: 1,
  })
    .rotate() // auto-orient from EXIF when present; strips orientation tag
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
```

### Pattern 2: ClamAV TCP client — fail closed, no local fallback

**What:** Lazy-init `clamscan` once; probe with `ping()`; scan via `Readable.from(buffer)` + `scanStream`.

**When to use:** Every upload when `CLAMAV_ENABLED !== 'false'`.

**Example:**

```typescript
// Source: https://github.com/kylefarris/clamscan — TCP + scanStream
import NodeClam from "clamscan";
import { Readable } from "node:stream";

const clam = await new NodeClam().init({
  removeInfected: false,
  preference: "clamdscan",
  clamdscan: {
    host: process.env.CLAMAV_HOST ?? "127.0.0.1",
    port: Number(process.env.CLAMAV_PORT ?? 3310),
    timeout: Number(process.env.CLAMAV_TIMEOUT_MS ?? 30_000),
    localFallback: false, // critical: do not silently skip on Windows
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

**INSTREAM protocol (if hand-rolling):** send `zINSTREAM\0`, then repeated `[4-byte BE length][chunk]`, then `00 00 00 00`; reply `stream: OK` or `stream: {sig} FOUND` [CITED: https://docs.clamav.net/manual/Usage/ClamdProtocol.html]. Prefer `clamscan` package.

### Pattern 3: Object path migration to UUID WebP keys

**What:** Change `buildEvidenceObjectPath(reportId, ext)` to `buildEvidenceObjectPath(reportId, objectId = randomUUID())` → `reports/{reportId}/{objectId}.webp`.

**When to use:** All new uploads post-Phase 16.

**Compatibility:** `downloadEvidenceObject` already infers MIME from extension — `.webp` maps correctly. `officer-read` ETag uses full `evidence_path` string — path change invalidates caches (desired).

**Constraint:** `reports_evidence_path_format_chk` only requires `bucket/object` shape — UUID paths satisfy `^[^/]+/.+` [VERIFIED: `20260721130004_evidence_path_additive.sql`].

### Pattern 4: Batch migration script

**What:** `scripts/migrate-evidence-to-webp.mjs` with `--dry-run`, `--limit`, `--report-id`.

**When to use:** One-time (or repeatable) conversion of existing `evidence.jpg|png|webp` objects.

**Flow:**

1. `loadProjectEnv()` + Supabase service role [VERIFIED: `load-project-env.mjs`]
2. List `reports` with non-null `evidence_path` (or list Storage under `reports/`)
3. For each object: download → validate → Sharp → upload new `.webp` key → `UPDATE reports SET evidence_path = ...` → `storage.remove` old key
4. Emit JSON summary `{ converted, skipped, failed, sha256_before, sha256_after }`

### Anti-Patterns to Avoid

- **Skipping scan when `clamd` is down in production:** violates fail-closed; return 503 `Evidence scanning unavailable` instead.
- **`localFallback: true` on Windows:** `clamscan` README states Windows server not a target; fallback may invoke missing binaries [CITED: clamscan README].
- **Trusting Sharp to accept SVG:** reject `image/svg+xml` at magic-byte layer; never pass SVG to Sharp with `unlimited: true`.
- **Storing originals alongside WebP:** increases attack surface; upload only sanitized WebP.
- **Public bucket or signed URL for citizen uploads:** keep service-role server upload only [VERIFIED: Phase 7 RLS — no anon insert].
- **Executing quarantine files:** write-only temp; no `spawn`, no shell open, no `sharp` input from citizen-controlled paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Magic-byte detection | Custom byte sniff only | `file-type` (+ keep minimal sniff fallback) | Maintained signatures; already integrated |
| ClamAV INSTREAM framing | Raw TCP chunk encoder | `clamscan` `scanStream` / buffer APIs | Length-prefix bugs, timeout handling |
| Image decode / transcode | canvas, jimp, manual libvips | `sharp` | Pixel bombs, orientation, metadata stripping |
| WebP encoder | wasm polyfills | `sharp().webp()` | Performance + battle-tested limits |
| Virus signature DB | Embedded patterns | `clamd` + `freshclam` | Signature updates must be operational concern |

**Key insight:** The dangerous parts are **virus scanning protocol** and **malicious image decoding** — both have mature libraries/daemons; custom code here has historically caused false negatives and DoS.

## Common Pitfalls

### Pitfall 1: `StreamMaxLength` smaller than app upload limit

**What goes wrong:** ClamAV returns `INSTREAM size limit exceeded` for valid uploads.  
**Why it happens:** Default `clamd.conf` limits below `MAX_IMAGE_BYTES`.  
**How to avoid:** Set `StreamMaxLength`, `MaxFileSize`, `MaxScanSize` ≥ 10MB (or env max); restart `clamd` after config change [CITED: ClamAV GitHub #1319].  
**Warning signs:** 503 only on larger images; clamd log mentions size limit.

### Pitfall 2: Scanner “optional” in dev becomes optional in prod

**What goes wrong:** Uploads bypass malware gate.  
**Why it happens:** `if (!clamAvailable) continue` antipattern.  
**How to avoid:** `CLAMAV_ENABLED=false` only for explicit local dev; default `true`; fail closed when enabled and ping fails.  
**Warning signs:** Tests pass without `clamd` running in CI unless mock injected.

### Pitfall 3: Pixel / decompression bombs

**What goes wrong:** Sharp/libvips memory exhaustion on small files.  
**Why it happens:** `limitInputPixels: false` or `unlimited: true`.  
**How to avoid:** Keep default or set explicit `EVIDENCE_MAX_INPUT_PIXELS`; `failOn: 'warning'`; `animated: false`. [CITED: sharp constructor docs]  
**Warning signs:** Single upload crashes Node process.

### Pitfall 4: GIF animation / SVG polyglots

**What goes wrong:** Accepted as image; SVG script gadgets or huge GIF frames.  
**Why it happens:** Client `accept` includes wrong types; weak detection.  
**How to avoid:** Reject `image/gif`, `image/svg+xml` at detection layer; Sharp `pages: 1`, `animated: false`.  
**Warning signs:** `file-type` returns `image/gif` for uploads — must return `invalid_type`.

### Pitfall 5: MIME mismatch after WebP canonicalization

**What goes wrong:** Supabase bucket rejects upload or officer serves wrong `Content-Type`.  
**Why it happens:** Upload still uses detected input MIME instead of `image/webp`.  
**How to avoid:** Always `contentType: 'image/webp'` on final upload; bucket already allows `image/webp` [VERIFIED: migration SQL].  
**Warning signs:** Storage API 400 on upload.

### Pitfall 6: Batch migration without DB/object parity

**What goes wrong:** `evidence_path` points to missing object or duplicate bytes.  
**Why it happens:** Upload new WebP but forget `remove` old key or DB update.  
**How to avoid:** Transactional order: upload new → update row → delete old; dry-run mode; SHA-256 log.  
**Warning signs:** Officer 404s; inventory script count mismatch.

### Pitfall 7: Client/server size limit drift

**What goes wrong:** Client allows 10MB, server still 8MB (or vice versa).  
**Why it happens:** `DEFAULT_MAX_EVIDENCE_BYTES = 8MB` vs bucket 10MB vs `ReportForm` Zod 8MB.  
**How to avoid:** Single constant exported from `evidence-service.ts`; import in client bundle via shared `src/lib/evidence-limits.ts` (no server-only imports in client).  
**Warning signs:** 413 after client validation passes.

## Code Examples

### Fail-closed error mapping (API layer)

```typescript
// Map pipeline errors to existing HTTP helpers in src/server/http/errors.ts
if (code === "scanner_unavailable") {
  throw new HttpError(503, "Evidence scanning is temporarily unavailable");
}
if (code === "infected") {
  throw unsupportedImageType("rejected"); // generic — do not echo virus names to citizens
}
if (code === "transform_failed") {
  throw unsupportedImageType("invalid");
}
```

### ClamAV health probe (mirror ai-readiness)

```typescript
// Pattern from src/server/health/ai-readiness.ts — TTL cache + bounded probe
export async function checkClamavHealth(): Promise<{ status: "up" | "down"; latency_ms: number }> {
  const started = Date.now();
  try {
    await clam.ping();
    return { status: "up", latency_ms: Date.now() - started };
  } catch {
    return { status: "down", latency_ms: Date.now() - started };
  }
}
```

### Sharp pipeline with env-driven quality

```typescript
// Source: https://sharp.pixelplumbing.com/api-output/#webp
const quality = Number(process.env.EVIDENCE_WEBP_QUALITY ?? 88);
await sharp(quarantineBytes, { failOn: "warning", limitInputPixels: maxPixels })
  .rotate()
  .webp({ quality })
  .toBuffer();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Content-Type only validation | Magic bytes (`file-type`) | Phase 2 (DATA-09) | Spoofed headers rejected |
| Store original JPEG/PNG/WebP | Sharp → canonical WebP | Phase 16 | Smaller objects; strips EXIF; single MIME |
| No malware scan | ClamAV INSTREAM | Phase 16 | Fail-closed upload gate |
| Deterministic `evidence.{ext}` path | `reports/{id}/{uuid}.webp` | Phase 16 | Non-guessable object keys within report folder |

**Deprecated/outdated:**

- `POST /api/public/reports/analyze` upload path — 410; pipeline still applies if legacy code path kept for tests.
- Legacy `image_gcs_uri` — use `evidence_path` only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `clamscan` npm TCP mode works from Node on Windows against local `clamd` | ClamAV integration | Need raw INSTREAM or WSL/Linux sidecar |
| A2 | Default fail-closed when `CLAMAV_ENABLED` unset means `true` in production | Failure modes | Dev laptops blocked until ClamAV installed or explicit `false` |
| A3 | 10MB default replaces 8MB across server + client + docs | Size limits | Unexpected 413 for users sized between 8–10MB |
| A4 | UUID object keys under `reports/{reportId}/` meet officer/triage expectations | Storage layout | Dashboard thumbnails break if code assumes `evidence.{ext}` |
| A5 | Optional Docker `clamav/clamav` is acceptable as **dev tooling** despite SELFHOST-05 | Environment | User may want MSI-only documented path |

## Open Questions (RESOLVED)

1. **Should ClamAV be mandatory on dev laptops?** — **RESOLVED**
   - **Decision:** `CLAMAV_ENABLED` defaults **false in dev** (document in `.env.example` with explicit opt-out); **true in production docs** (fail closed when enabled and `clamd` unreachable). Unit/CI tests mock `clamscan`; Windows MSI install documented for operators who enable scanning locally.

2. **Readiness vs dedicated `/api/health/clamav`?** — **RESOLVED**
   - **Decision:** **Both.** Ship `GET /api/health/clamav` (mirrors `/api/health/ai` TTL cache pattern) **and** append `{ name: 'clamav', status, latency_ms }` to `checkReadiness()` dependencies when `CLAMAV_ENABLED` is true; overall readiness `not_ready` when clamav enabled but down.

3. **Keep in-memory scan or temp-file quarantine for 10MB?** — **RESOLVED**
   - **Decision:** **In-memory scan for ≤10MB** — `assertCleanBuffer` via `Readable.from(buffer)` + `scanStream`; Sharp operates on same in-memory bytes. **No disk quarantine file required for MVP** at the 10MB size gate.

4. **AI vision uses sanitized WebP bytes inline or re-download?** — **RESOLVED**
   - **Decision:** Triage vision uses **sanitized WebP bytes from pipeline output** (`webpBytes` returned by `processAndStoreEvidence`) for synchronous analyze path; async worker re-downloads from `evidence_path` (always WebP post-Phase 16).

## Environment Availability

| Dependency | Required By | Available (research machine) | Version | Fallback |
|------------|------------|------------------------------|---------|----------|
| Node.js | Sharp, Next.js | ✓ | v25.2.1 | — |
| `clamd` / `freshclam` | SEC-IMG-02 | ✗ | — | Install ClamAV MSI + Windows service; or optional `clamav/clamav` container on 3310 |
| Supabase Storage | Evidence persist | ✓ (project) | — | Blocks uploads if down (existing) |
| Sharp native binaries | SEC-IMG-03 | not installed yet | 0.35.3 on npm | `npm install sharp` pulls prebuilds for Windows |

**Missing dependencies with no fallback:**

- Production with `CLAMAV_ENABLED=true` and no `clamd` — must fail closed (503), not accept uploads.

**Missing dependencies with fallback:**

- Local dev with `CLAMAV_ENABLED=false` — scanner skipped (explicit opt-out only).
- ClamAV via Docker — optional dev sidecar; not part of app image.

### ClamAV on Windows (laptop)

1. Install ClamAV Windows MSI from Cisco Talos distribution.
2. Copy `conf_examples/clamd.conf.sample` → `clamd.conf`; comment `#Example`; enable `TCPSocket 3310`, `TCPAddr localhost` [CITED: ClamAV win32 sample].
3. Set `StreamMaxLength 10M` (or match `MAX_IMAGE_BYTES`).
4. `clamd.exe --install`; run `freshclam.exe`; start **ClamAV ClamD** service.
5. Verify: `printf 'zPING\0' | nc 127.0.0.1 3310` → `PONG` [CITED: ClamAV protocol].

### Optional dev container (not app runtime)

```bash
docker run --name citymind-clamav -p 3310:3310 clamav/clamav:1.4
```

Configure `CLAMAV_HOST=127.0.0.1`, `CLAMAV_PORT=3310`. Document as optional; SELFHOST-05 remains satisfied because Next.js does not depend on Docker.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + node:test legacy |
| Config file | `vitest.config.mts` |
| Quick run command | `npm run test:unit -- src/server/services/evidence-image-pipeline.test.ts src/server/services/clamav-client.test.ts` |
| Full suite command | `npm run test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-IMG-01 | Reject GIF/SVG/spoofed MIME | unit | `npm run test:unit -- src/server/services/evidence-service.test.ts -t "reject"` | ✅ extend |
| SEC-IMG-01 | Accept JPEG/PNG/WebP magic bytes | unit | `npm run test:unit -- src/server/services/evidence-service.test.ts` | ✅ |
| SEC-IMG-02 | Fail closed when scanner throws | unit | `npm run test:unit -- src/server/services/clamav-client.test.ts` | ❌ Wave 0 |
| SEC-IMG-02 | Infected stream rejected | unit | mock `scanStream` → `isInfected: true` | ❌ Wave 0 |
| SEC-IMG-03 | Output is WebP; metadata stripped | unit | `npm run test:unit -- src/server/services/evidence-image-pipeline.test.ts` | ❌ Wave 0 |
| SEC-IMG-03 | Pixel bomb over limit fails | unit | pipeline test with tiny PNG claiming huge dims | ❌ Wave 0 |
| SEC-IMG-04 | Quarantine temp deleted on success/failure | unit | mock `fs.unlink` | ❌ Wave 0 |
| SEC-IMG-05 | 413 over max bytes | unit | `npm run test:unit -- src/server/services/report-service.test.ts -t "oversized"` | ✅ |
| SEC-IMG-06 | Batch script dry-run lists candidates | integration | `node scripts/migrate-evidence-to-webp.mjs --dry-run` | ❌ Wave 0 |
| SEC-IMG-07 | Health probe down when ping fails | unit | `npm run test:unit -- src/server/health/clamav-readiness.test.ts` | ❌ Wave 0 |
| SEC-IMG-08 | Client Zod matches server max | unit | `npm run test:legacy -- tests/report-form.test.mjs` | ✅ extend |

### Sampling Rate

- **Per task commit:** `npm run test:unit -- src/server/services/evidence*.ts src/server/services/clamav-client.test.ts`
- **Per wave merge:** `npm run test:unit`
- **Phase gate:** `npm run phase16:gate` (proposed: unit tests + `supabase/tests/16_phase16_contract.sql`)

### Wave 0 Gaps

- [ ] `src/server/services/clamav-client.ts` + tests with mocked `clamscan`
- [ ] `src/server/services/evidence-image-pipeline.ts` + tests (Sharp fixture PNG/JPEG)
- [ ] `src/server/health/clamav-readiness.ts` + tests
- [ ] `scripts/migrate-evidence-to-webp.mjs`
- [ ] `supabase/tests/16_phase16_contract.sql` — bucket `allowed_mime_types` includes only `image/webp` post-migration (or still jpeg/png/webp until batch completes)
- [ ] `package.json` `phase16:gate` script
- [ ] Shared `src/lib/evidence-limits.ts` for client/server max bytes
- [ ] Framework install: `npm install sharp clamscan`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Private bucket; officer `requireOfficerContext` for image route |
| V5 Input Validation | yes | Magic bytes + size + Sharp decode limits + Zod client pre-check |
| V6 Cryptography | no | No custom crypto; hashing unchanged |

### Known Threat Patterns for Node/Next.js + Storage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malware in citizen upload | Tampering | ClamAV INSTREAM before persist |
| Polyglot file (image + script) | Elevation | Magic bytes + Sharp re-encode; reject SVG/GIF |
| Decompression / pixel bomb | DoS | `limitInputPixels`, `MAX_IMAGE_BYTES`, rate limits |
| MIME spoofing | Spoofing | `file-type` + declared MIME cross-check (existing) |
| Path traversal in filenames | Tampering | Server generates UUID paths; ignore client filenames |
| Evidence hotlinking | Information disclosure | Private bucket + officer-only BFF stream |
| Scanner bypass on error | Elevation | Fail closed — 503, not accept |

## Project Constraints (from AGENTS.md / stack)

- Next.js 16 + Node 22 only; no Python/FastAPI path for evidence.
- Supabase Storage private `evidence` bucket; service-role server uploads.
- Loopback-first laptop runtime; Docker removed from **app** runtime (ClamAV daemon may be MSI or optional sidecar).
- AI advisory only — sanitized images feed triage vision; no change to officer authority.
- Generic citizen error messages (DATA-10) — do not leak virus names or scanner internals.
- GSD workflow: phase plans should land via `/gsd-plan-phase` / `/gsd-execute-phase`.

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `src/server/services/evidence-service.ts` — current validation, paths, 8MB default
- [VERIFIED: codebase] `src/server/services/report-service.ts`, `citizen-chat-intake.ts` — upload call sites
- [VERIFIED: codebase] `supabase/migrations/20260721130001_next_backend_contract.sql` — bucket 10MB, MIME allowlist
- [CITED: https://docs.clamav.net/manual/Usage/ClamdProtocol.html] — INSTREAM framing, PING, StreamMaxLength
- [CITED: https://sharp.pixelplumbing.com/api-constructor/] — `limitInputPixels`, `failOn`, `rotate`
- [CITED: https://sharp.pixelplumbing.com/api-output/] — WebP quality, metadata stripped by default
- [CITED: https://github.com/kylefarris/clamscan] — TCP `scanStream`, `ping`, `localFallback`

### Secondary (MEDIUM confidence)

- [CITED: https://github.com/Cisco-Talos/clamav/blob/main/win32/conf_examples/clamd.conf.sample] — Windows TCP 3310
- WebSearch synthesis — Windows MSI install steps for `clamd` service
- [VERIFIED: npm registry] `sharp@0.35.3`, `clamscan@2.4.0`, `file-type@22.0.1`

### Tertiary (LOW confidence)

- [ASSUMED] Optional `clamav/clamav` Docker tag `1.4` for dev — verify tag at plan time

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — packages verified on npm; sharp/clamav docs cited; `file-type` already in production code
- Architecture: **HIGH** — clear extension of existing `evidence-service` + Storage layout; call sites identified
- Pitfalls: **MEDIUM** — Windows ClamAV ops vary by install; StreamMaxLength tuning needs human verification on target laptop

**Research date:** 2026-07-23  
**Valid until:** 2026-08-23 (sharp/clamav stable); 2026-07-30 for ClamAV Windows install specifics
