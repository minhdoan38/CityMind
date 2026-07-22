import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "@/server/health/readiness";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

describe("checkReadiness", () => {
  it("returns not_ready when Supabase env is missing", async () => {
    const result = await checkReadiness({});
    expect(result.status).toBe("not_ready");
    expect(result.dependencies[0]).toMatchObject({
      name: "supabase",
      status: "down",
    });
  });

  it("returns ready when Supabase probe succeeds", async () => {
    const result = await checkReadiness({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(result.status).toBe("ready");
    expect(result.dependencies[0].name).toBe("supabase");
    expect(result.dependencies[0].status).toBe("up");
    expect(result.dependencies[0].latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("does not expose secrets or connection details", async () => {
    const result = await checkReadiness({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "super-secret-key",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("super-secret-key");
    expect(serialized).not.toContain("127.0.0.1");
    expect(serialized).not.toContain("postgresql");
  });
});
