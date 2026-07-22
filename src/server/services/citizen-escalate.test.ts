import { afterEach, describe, expect, it, vi } from "vitest";

import { resetAdminClientCache } from "@/lib/supabase/admin";
import { CITIZEN_STATUS_UNAUTHORIZED_DETAIL } from "@/server/http/errors";
import { resetRateLimiters } from "@/server/security/rate-limit";
import {
  escalateCitizenReport,
  handleCitizenEscalateRequest,
} from "./citizen-escalate";

function futureIso(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function createClient(overrides: {
  tokenRow?: Record<string, unknown> | null;
  rpcResult?: Record<string, unknown>;
  rpcError?: Error | null;
} = {}) {
  const tokenQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: overrides.tokenRow ?? null, error: null }),
  };
  const rpc = vi.fn().mockResolvedValue({
    data: overrides.rpcResult ?? { routing_destination: "government", updated: true },
    error: overrides.rpcError ?? null,
  });
  return {
    from: vi.fn((table: string) => {
      if (table === "access_tokens") return tokenQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc,
  };
}

describe("escalateCitizenReport", () => {
  it("returns government destination for valid token on self_help report", async () => {
    const client = createClient({
      tokenRow: {
        token_hash: "hash",
        report_id: "rep-1",
        expires_at: futureIso(),
      },
    });

    const result = await escalateCitizenReport(
      { report_id: "rep-1", token: "citizen-token" },
      client as never,
    );

    expect(result).toEqual({ ok: true, routing_destination: "government" });
    expect(client.rpc).toHaveBeenCalledWith("escalate_report_to_government", {
      p_report_id: "rep-1",
      p_token_hash: expect.any(String),
      p_reason: "citizen_escalated",
    });
  });

  it("throws uniform unauthorized for invalid token", async () => {
    const client = createClient({ tokenRow: null });

    await expect(
      escalateCitizenReport({ report_id: "rep-1", token: "wrong" }, client as never),
    ).rejects.toThrow(CITIZEN_STATUS_UNAUTHORIZED_DETAIL);
  });
});

describe("handleCitizenEscalateRequest", () => {
  afterEach(() => {
    resetRateLimiters();
    resetAdminClientCache();
    vi.unstubAllEnvs();
  });

  it("returns 401 with same shape as status unauthorized", async () => {
    const client = createClient({ tokenRow: null });
    const response = await handleCitizenEscalateRequest(
      new Request("http://localhost/api/public/reports/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: "rep-1", token: "wrong-token" }),
      }),
      { client: client as never },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      detail: CITIZEN_STATUS_UNAUTHORIZED_DETAIL,
    });
  });

  it("returns 429 with Retry-After for rate limit violations", async () => {
    vi.stubEnv("STATUS_RATE_LIMIT_PER_MINUTE", "1");
    const client = createClient({
      tokenRow: {
        token_hash: "hash",
        report_id: "rep-1",
        expires_at: futureIso(),
      },
    });

    const requestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.99",
      },
      body: JSON.stringify({ report_id: "rep-1", token: "token" }),
    } as const;

    const first = await handleCitizenEscalateRequest(
      new Request("http://localhost/api/public/reports/escalate", requestInit),
      { client: client as never },
    );
    const second = await handleCitizenEscalateRequest(
      new Request("http://localhost/api/public/reports/escalate", requestInit),
      { client: client as never },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("60");
  });
});
