import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scanStream = vi.fn();
const ping = vi.fn();
const init = vi.fn(async () => ({ scanStream, ping }));

vi.mock("clamscan", () => ({
  default: class NodeClamMock {
    init = init;
  },
}));

import {
  assertCleanBuffer,
  EvidenceScanError,
  isClamavEnabled,
  pingClamav,
  resetClamavClientForTests,
} from "./clamav-client";

const CLEAN_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);

describe("clamav-client", () => {
  beforeEach(() => {
    resetClamavClientForTests();
    vi.clearAllMocks();
    delete process.env.CLAMAV_ENABLED;
    scanStream.mockResolvedValue({ isInfected: false });
    ping.mockResolvedValue(true);
    init.mockResolvedValue({ scanStream, ping });
  });

  afterEach(() => {
    resetClamavClientForTests();
    delete process.env.CLAMAV_ENABLED;
  });

  it("treats ClamAV as enabled unless CLAMAV_ENABLED is false", () => {
    expect(isClamavEnabled()).toBe(true);
    process.env.CLAMAV_ENABLED = "false";
    expect(isClamavEnabled()).toBe(false);
  });

  it("skips scanStream when ClamAV is disabled", async () => {
    process.env.CLAMAV_ENABLED = "false";
    await assertCleanBuffer(CLEAN_BYTES);
    expect(scanStream).not.toHaveBeenCalled();
  });

  it("passes clean buffers when scanStream reports no infection", async () => {
    await assertCleanBuffer(CLEAN_BYTES);
    expect(scanStream).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        clamdscan: expect.objectContaining({ localFallback: false }),
        clamscan: { active: false },
      }),
    );
  });

  it("throws infected when scanStream reports malware", async () => {
    scanStream.mockResolvedValue({
      isInfected: true,
      viruses: ["Eicar-Test-Signature"],
    });

    await expect(assertCleanBuffer(CLEAN_BYTES)).rejects.toMatchObject({
      code: "infected",
    });
  });

  it("throws scanner_unavailable when scanStream rejects", async () => {
    scanStream.mockRejectedValue(new Error("connection refused"));

    await expect(assertCleanBuffer(CLEAN_BYTES)).rejects.toMatchObject({
      code: "scanner_unavailable",
    });
  });

  it("throws scanner_unavailable when ping fails while enabled", async () => {
    ping.mockRejectedValue(new Error("timeout"));

    await expect(pingClamav()).rejects.toBeInstanceOf(EvidenceScanError);
    await expect(pingClamav()).rejects.toMatchObject({
      code: "scanner_unavailable",
    });
  });
});
