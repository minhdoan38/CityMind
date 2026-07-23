import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const assertCleanBuffer = vi.fn();

vi.mock("@/server/services/clamav-client", () => ({
  assertCleanBuffer: (...args: unknown[]) => assertCleanBuffer(...args),
  EvidenceScanError: class EvidenceScanError extends Error {
    readonly code: "infected" | "scanner_unavailable";
    constructor(code: "infected" | "scanner_unavailable", message: string) {
      super(message);
      this.code = code;
    }
  },
}));

const sharpMock = vi.fn();
vi.mock("sharp", () => ({
  default: (...args: unknown[]) => sharpMock(...args),
}));

import { EvidenceScanError } from "@/server/services/clamav-client";
import { EvidenceServiceError } from "@/server/services/evidence-service";
import { processAndStoreEvidence } from "./evidence-image-pipeline";

const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const WEBP_BYTES = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

function createStorageClient() {
  const upload = vi.fn(async () => ({ error: null }));
  const client = {
    storage: {
      from: vi.fn(() => ({ upload })),
    },
  };
  return { client, upload };
}

function mockSharpSuccess(output: Uint8Array = WEBP_BYTES) {
  const chain = {
    rotate: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from(output)),
  };
  sharpMock.mockReturnValue(chain);
  return chain;
}

describe("processAndStoreEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertCleanBuffer.mockResolvedValue(undefined);
    mockSharpSuccess();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads sanitized WebP bytes with image/webp content type", async () => {
    const { client, upload } = createStorageClient();
    const result = await processAndStoreEvidence({
      client: client as never,
      reportId: "rep-1",
      bytes: PNG_BYTES,
      bucketName: "evidence",
    });

    expect(assertCleanBuffer).toHaveBeenCalledWith(PNG_BYTES);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^reports\/rep-1\/.+\.webp$/),
      WEBP_BYTES,
      expect.objectContaining({ contentType: "image/webp", upsert: false }),
    );
    expect(result.webpBytes).toEqual(WEBP_BYTES);
    expect(result.evidenceUri).toMatch(/^supabase:\/\/evidence\/reports\/rep-1\/.+\.webp$/);
  });

  it("maps infected scans to EvidenceServiceError infected", async () => {
    const { client, upload } = createStorageClient();
    assertCleanBuffer.mockRejectedValue(new EvidenceScanError("infected", "malware"));

    await expect(
      processAndStoreEvidence({
        client: client as never,
        reportId: "rep-infected",
        bytes: PNG_BYTES,
        bucketName: "evidence",
      }),
    ).rejects.toMatchObject({ code: "infected" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("maps scanner failures to EvidenceServiceError scanner_unavailable", async () => {
    const { client, upload } = createStorageClient();
    assertCleanBuffer.mockRejectedValue(
      new EvidenceScanError("scanner_unavailable", "down"),
    );

    await expect(
      processAndStoreEvidence({
        client: client as never,
        reportId: "rep-scan",
        bytes: PNG_BYTES,
        bucketName: "evidence",
      }),
    ).rejects.toMatchObject({ code: "scanner_unavailable" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects oversized bytes before upload", async () => {
    const { client, upload } = createStorageClient();

    await expect(
      processAndStoreEvidence({
        client: client as never,
        reportId: "rep-big",
        bytes: PNG_BYTES,
        bucketName: "evidence",
        maxBytes: 4,
      }),
    ).rejects.toMatchObject({ code: "oversized" });
    expect(upload).not.toHaveBeenCalled();
    expect(assertCleanBuffer).not.toHaveBeenCalled();
  });

  it("maps Sharp limit failures to transform_failed without storage upload", async () => {
    const { client, upload } = createStorageClient();
    sharpMock.mockImplementation(() => {
      throw new Error("Input image exceeds pixel limit");
    });

    await expect(
      processAndStoreEvidence({
        client: client as never,
        reportId: "rep-bomb",
        bytes: PNG_BYTES,
        bucketName: "evidence",
      }),
    ).rejects.toMatchObject({ code: "transform_failed" });
    expect(upload).not.toHaveBeenCalled();
  });
});
