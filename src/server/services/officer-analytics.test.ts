import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetAdminClientCache } from "@/lib/supabase/admin";
import { resetRateLimiters } from "@/server/security/rate-limit";
import {
  handleOfficerAnalyticsRequest,
  handlePublicStatsRequest,
} from "@/server/services/officer-analytics";

vi.mock("@/server/officer/guard", () => ({
  requireOfficerContext: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase/admin")>(
    "@/lib/supabase/admin",
  );
  return {
    ...actual,
    getAdminClient: vi.fn(),
  };
});

vi.mock("@/server/repositories/analytics", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/repositories/analytics")
  >("@/server/repositories/analytics");
  return {
    ...actual,
    fetchOfficerAnalytics: vi.fn(),
    fetchPublicStats: vi.fn(),
  };
});

import { getAdminClient } from "@/lib/supabase/admin";
import { requireOfficerContext } from "@/server/officer/guard";
import {
  fetchOfficerAnalytics,
  fetchPublicStats,
} from "@/server/repositories/analytics";

describe("handleOfficerAnalyticsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without officer context", async () => {
    vi.mocked(requireOfficerContext).mockResolvedValue({
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    });

    const response = await handleOfficerAnalyticsRequest(
      new Request("http://localhost/api/v1/analytics?from=2026-06-01&to=2026-06-30"),
    );
    expect(response.status).toBe(401);
  });

  it("returns 422 for invalid ranges", async () => {
    vi.mocked(requireOfficerContext).mockResolvedValue({
      ok: true,
      context: {
        session: {
          userId: "officer-1",
          email: "officer@example.com",
          role: "officer",
        },
        client: {} as never,
      },
    });

    const response = await handleOfficerAnalyticsRequest(
      new Request("http://localhost/api/v1/analytics?from=2026-07-02&to=2026-07-01"),
    );
    expect(response.status).toBe(422);
  });

  it("returns analytics payload for valid officer requests", async () => {
    vi.mocked(requireOfficerContext).mockResolvedValue({
      ok: true,
      context: {
        session: {
          userId: "officer-1",
          email: "officer@example.com",
          role: "officer",
        },
        client: {} as never,
      },
    });
    vi.mocked(fetchOfficerAnalytics).mockResolvedValue({
      from: "2026-06-01",
      to: "2026-06-30",
      empty: true,
      volume: [],
      category_mix: [],
      sla: { closed_count: 0, median_days: null, avg_days: null, histogram: [] },
      hotspots: [],
    });

    const response = await handleOfficerAnalyticsRequest(
      new Request("http://localhost/api/v1/analytics?from=2026-06-01&to=2026-06-30"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ empty: true });
  });
});

describe("handlePublicStatsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimiters();
    resetAdminClientCache();
    process.env.PUBLIC_STATS_RATE_LIMIT_PER_MINUTE = "0";
    vi.mocked(getAdminClient).mockReturnValue({} as never);
  });

  it("returns allowlisted public stats payload", async () => {
    vi.mocked(fetchPublicStats).mockResolvedValue({
      total_last_30d: 42,
      top_categories: [{ category: "pothole", count: 10 }],
    });

    const response = await handlePublicStatsRequest(
      new Request("http://localhost/api/v1/public/stats"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      total_last_30d: 42,
      top_categories: [{ category: "pothole", count: 10 }],
    });
  });

  it("enforces public stats rate limits separately", async () => {
    process.env.PUBLIC_STATS_RATE_LIMIT_PER_MINUTE = "1";
    vi.mocked(fetchPublicStats).mockResolvedValue({
      total_last_30d: 0,
      top_categories: [],
    });

    const request = new Request("http://localhost/api/v1/public/stats", {
      headers: { "x-forwarded-for": "203.0.113.99" },
    });
    const first = await handlePublicStatsRequest(request);
    const second = await handlePublicStatsRequest(request);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("60");
  });
});
