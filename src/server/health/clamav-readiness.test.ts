import { afterEach, describe, expect, it, vi } from "vitest";

const pingClamav = vi.fn();
const isClamavEnabled = vi.fn();

vi.mock("@/server/services/clamav-client", () => ({
  pingClamav: (...args: unknown[]) => pingClamav(...args),
  isClamavEnabled: (...args: unknown[]) => isClamavEnabled(...args),
}));

import {
  checkClamavHealth,
  resetClamavHealthCache,
} from "./clamav-readiness";

describe("checkClamavHealth", () => {
  afterEach(() => {
    resetClamavHealthCache();
    vi.clearAllMocks();
  });

  it("returns down with disabled reason when ClamAV is disabled", async () => {
    isClamavEnabled.mockReturnValue(false);

    const result = await checkClamavHealth({ now: 1_000 });

    expect(result.body.status).toBe("down");
    expect(result.body.reason).toBe("disabled");
    expect(result.cacheHit).toBe(false);
    expect(pingClamav).not.toHaveBeenCalled();
  });

  it("returns up when ping succeeds", async () => {
    isClamavEnabled.mockReturnValue(true);
    pingClamav.mockResolvedValue(undefined);

    const result = await checkClamavHealth({ now: 2_000 });

    expect(result.body.status).toBe("up");
    expect(result.body.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.cacheHit).toBe(false);
  });

  it("returns down when ping fails", async () => {
    isClamavEnabled.mockReturnValue(true);
    pingClamav.mockRejectedValue(new Error("timeout"));

    const result = await checkClamavHealth({ now: 3_000 });

    expect(result.body.status).toBe("down");
    expect(result.body.reason).toBe("unreachable");
  });

  it("serves cached responses within the TTL", async () => {
    isClamavEnabled.mockReturnValue(true);
    pingClamav.mockResolvedValue(undefined);

    const first = await checkClamavHealth({ now: 4_000 });
    const second = await checkClamavHealth({ now: 10_000 });

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(pingClamav).toHaveBeenCalledTimes(1);
    expect(second.body).toEqual(first.body);
  });
});
