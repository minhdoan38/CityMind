import { afterEach, describe, expect, it, vi } from "vitest";

const checkClamavHealth = vi.fn();
const isClamavEnabled = vi.fn();

vi.mock("@/server/health/clamav-readiness", () => ({
  checkClamavHealth: (...args: unknown[]) => checkClamavHealth(...args),
}));

vi.mock("@/server/services/clamav-client", () => ({
  isClamavEnabled: (...args: unknown[]) => isClamavEnabled(...args),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

import { checkReadiness } from "@/server/health/readiness";

const BASE_ENV = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

describe("checkReadiness", () => {
  afterEach(() => {
    vi.clearAllMocks();
    isClamavEnabled.mockReturnValue(false);
  });

  it("returns not_ready when Supabase env is missing", async () => {
    const result = await checkReadiness({});
    expect(result.status).toBe("not_ready");
    expect(result.dependencies[0]).toMatchObject({
      name: "supabase",
      status: "down",
    });
  });

  it("returns ready when Supabase probe succeeds and ClamAV is disabled", async () => {
    isClamavEnabled.mockReturnValue(false);
    const result = await checkReadiness(BASE_ENV);
    expect(result.status).toBe("ready");
    expect(result.dependencies).toEqual([
      expect.objectContaining({ name: "supabase", status: "up" }),
    ]);
    expect(checkClamavHealth).not.toHaveBeenCalled();
  });

  it("includes clamav when enabled and up", async () => {
    isClamavEnabled.mockReturnValue(true);
    checkClamavHealth.mockResolvedValue({
      body: { status: "up", latency_ms: 12, checked_at: "2026-07-23T00:00:00.000Z" },
      cacheHit: false,
    });

    const result = await checkReadiness(BASE_ENV);

    expect(result.status).toBe("ready");
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "supabase", status: "up" }),
        expect.objectContaining({ name: "clamav", status: "up", latency_ms: 12 }),
      ]),
    );
  });

  it("returns not_ready when clamav is enabled but down", async () => {
    isClamavEnabled.mockReturnValue(true);
    checkClamavHealth.mockResolvedValue({
      body: {
        status: "down",
        latency_ms: 5,
        checked_at: "2026-07-23T00:00:00.000Z",
        reason: "unreachable",
      },
      cacheHit: false,
    });

    const result = await checkReadiness(BASE_ENV);

    expect(result.status).toBe("not_ready");
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "clamav", status: "down" }),
      ]),
    );
  });

  it("does not expose secrets or connection details", async () => {
    const result = await checkReadiness({
      ...BASE_ENV,
      SUPABASE_SERVICE_ROLE_KEY: "super-secret-key",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("super-secret-key");
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("postgresql");
  });
});
