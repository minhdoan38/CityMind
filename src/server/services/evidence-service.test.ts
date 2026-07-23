import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALLOWED_IMAGE_MIME_TYPES,
  DEFAULT_MAX_EVIDENCE_BYTES,
  buildEvidenceObjectPath,
  buildSupabaseEvidenceUri,
  deleteEvidenceObject,
  parseSupabaseEvidenceUri,
  uploadEvidence,
  validateEvidenceBytes,
  type EvidenceValidationResult,
} from "./evidence-service";

const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

function expectInvalid(
  result: EvidenceValidationResult,
  code: "empty" | "oversized" | "invalid_type" | "spoofed_mime",
) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe(code);
}

describe("validateEvidenceBytes", () => {
  it("rejects empty uploads", async () => {
    const result = await validateEvidenceBytes(new Uint8Array(), {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
    });
    expectInvalid(result, "empty");
  });

  it("rejects oversized declared content length before reading bytes", async () => {
    const result = await validateEvidenceBytes(PNG_BYTES, {
      maxBytes: 8,
      declaredContentLength: 9,
    });
    expectInvalid(result, "oversized");
  });

  it("rejects oversized byte buffers", async () => {
    const result = await validateEvidenceBytes(PNG_BYTES, {
      maxBytes: 4,
    });
    expectInvalid(result, "oversized");
  });

  it("rejects non-image magic bytes", async () => {
    const result = await validateEvidenceBytes(new TextEncoder().encode("not-an-image"), {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
    });
    expectInvalid(result, "invalid_type");
  });

  it("rejects GIF magic bytes", async () => {
    const gifBytes = Uint8Array.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
    ]);
    const result = await validateEvidenceBytes(gifBytes, {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
    });
    expectInvalid(result, "invalid_type");
  });

  it("rejects SVG snippets", async () => {
    const svgBytes = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
    );
    const result = await validateEvidenceBytes(svgBytes, {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
    });
    expectInvalid(result, "invalid_type");
  });

  it("accepts PNG magic bytes", async () => {
    const result = await validateEvidenceBytes(PNG_BYTES, {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/png");
    expect(result.ext).toBe("png");
    expect(ALLOWED_IMAGE_MIME_TYPES.has(result.mimeType)).toBe(true);
  });

  it("accepts JPEG magic bytes", async () => {
    const result = await validateEvidenceBytes(JPEG_BYTES, {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.ext).toBe("jpg");
  });

  it("accepts image/jpg declared mime when bytes are JPEG", async () => {
    const result = await validateEvidenceBytes(JPEG_BYTES, {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
      declaredMimeType: "image/jpg",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("accepts application/octet-stream when bytes are JPEG", async () => {
    const result = await validateEvidenceBytes(JPEG_BYTES, {
      maxBytes: DEFAULT_MAX_EVIDENCE_BYTES,
      declaredMimeType: "application/octet-stream",
    });
    expect(result.ok).toBe(true);
  });
});

describe("buildEvidenceObjectPath", () => {
  it("returns UUID-based WebP object paths", () => {
    const path = buildEvidenceObjectPath("rep-123", "550e8400-e29b-41d4-a716-446655440000");
    expect(path).toMatch(/^reports\/rep-123\/.+\.webp$/);
    expect(path).toBe("reports/rep-123/550e8400-e29b-41d4-a716-446655440000.webp");
  });
});

describe("uploadEvidence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createStorageClient() {
    const uploaded: Record<string, { bytes: Uint8Array; contentType: string }> = {};
    const removed: string[] = [];
    const bucket = {
      upload: vi.fn(async (path: string, file: Uint8Array, options?: { contentType?: string; upsert?: boolean }) => {
        if (options?.upsert) {
          throw new Error("upsert must be false");
        }
        uploaded[path] = { bytes: file, contentType: options?.contentType ?? "application/octet-stream" };
        return { data: { path }, error: null };
      }),
      remove: vi.fn(async (paths: string[]) => {
        for (const path of paths) {
          removed.push(path);
          delete uploaded[path];
        }
        return { data: paths, error: null };
      }),
      download: vi.fn(async (path: string) => {
        const entry = uploaded[path];
        if (!entry) {
          return { data: null, error: { message: "not found" } };
        }
        return { data: entry.bytes, error: null };
      }),
    };
    const client = {
      storage: {
        from: vi.fn(() => bucket),
      },
    };
    return { client, bucket, uploaded, removed };
  }

  it("uploads validated evidence with deterministic path and upsert disabled", async () => {
    const { client, bucket, uploaded } = createStorageClient();
    const uri = await uploadEvidence({
      client: client as never,
      reportId: "rep-123",
      bytes: PNG_BYTES,
      bucketName: "evidence",
    });

    const objectPath = bucket.upload.mock.calls[0]?.[0] as string;
    expect(objectPath).toMatch(/^reports\/rep-123\/.+\.webp$/);
    expect(uri).toBe(buildSupabaseEvidenceUri("evidence", objectPath));
    expect(bucket.upload).toHaveBeenCalledWith(
      objectPath,
      PNG_BYTES,
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
    expect(uploaded[objectPath]?.bytes).toEqual(PNG_BYTES);
  });

  it("rejects spoofed uploads before storage or AI", async () => {
    const { client, bucket } = createStorageClient();
    await expect(
      uploadEvidence({
        client: client as never,
        reportId: "rep-spoof",
        bytes: new TextEncoder().encode("plain-text"),
        bucketName: "evidence",
      }),
    ).rejects.toMatchObject({ code: "invalid_type" });
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("compensates by deleting the uploaded object", async () => {
    const { client, bucket, removed } = createStorageClient();
    const objectPath = buildEvidenceObjectPath("rep-comp", "png");

    await uploadEvidence({
      client: client as never,
      reportId: "rep-comp",
      bytes: PNG_BYTES,
      bucketName: "evidence",
    });
    await deleteEvidenceObject({
      client: client as never,
      bucketName: "evidence",
      objectPath,
    });

    expect(bucket.remove).toHaveBeenCalledWith([objectPath]);
    expect(removed).toEqual([objectPath]);
  });

  it("parses and downloads private evidence by supabase URI", async () => {
    const { client } = createStorageClient();
    const uri = await uploadEvidence({
      client: client as never,
      reportId: "rep-dl",
      bytes: PNG_BYTES,
      bucketName: "evidence",
    });
    const parsed = parseSupabaseEvidenceUri(uri);
    expect(parsed.bucket).toBe("evidence");
    expect(parsed.objectPath).toMatch(/^reports\/rep-dl\/.+\.webp$/);
  });
});
