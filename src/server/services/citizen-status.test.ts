import { afterEach, describe, expect, it, vi } from "vitest";

import { resetAdminClientCache } from "@/lib/supabase/admin";
import { CITIZEN_STATUS_UNAUTHORIZED_DETAIL } from "@/server/http/errors";
import { resetRateLimiters } from "@/server/security/rate-limit";
import {
  handleCitizenStatusRequest,
  lookupCitizenStatus,
  projectCitizenTriageView,
} from "./citizen-status";

function futureIso(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function createClient(overrides: {
  tokenRow?: Record<string, unknown> | null;
  reportRow?: Record<string, unknown> | null;
  events?: Record<string, unknown>[];
} = {}) {
  const tokenQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: overrides.tokenRow ?? null, error: null }),
  };
  const reportQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: overrides.reportRow ?? null, error: null }),
  };
  const eventsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: overrides.events ?? [], error: null }),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "access_tokens") return tokenQuery;
      if (table === "reports") return reportQuery;
      if (table === "status_events") return eventsQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("projectCitizenTriageView", () => {
  const base = {
    report_id: "rep-1",
    received_at: "2026-07-20T10:00:00+00:00",
    status: "new",
    category: "pothole",
    severity: 4,
    priority: "high",
    summary: "Pothole near the market.",
    recommendation: "Dispatch crew.",
    history: [],
    routing_destination: null as string | null,
  };

  it("returns summary null and service_step ai_review_pending when triage is pending", () => {
    const payload = projectCitizenTriageView({
      ...base,
      triage_status: "pending",
    });
    expect(payload.summary).toBeNull();
    expect(payload.service_step).toBe("ai_review_pending");
    expect(payload.category).toBeNull();
    expect(payload.recommendation).toBeNull();
  });

  it("returns service_step automated_review_unavailable for manual_review", () => {
    const payload = projectCitizenTriageView({
      ...base,
      triage_status: "manual_review",
    });
    expect(payload.service_step).toBe("automated_review_unavailable");
    expect(payload.summary).toBeNull();
    expect(payload).not.toHaveProperty("triage_error");
  });

  it("returns non-null summary when triage is completed and DB has summary", () => {
    const payload = projectCitizenTriageView({
      ...base,
      triage_status: "completed",
      status: "reviewing",
      routing_destination: "government",
    });
    expect(payload.summary).toBe("Pothole near the market.");
    expect(payload.category).toBe("pothole");
    expect(payload.service_step).toBe("officer_review");
  });

  it("returns self_help_guidance with null AI fields when routing_destination is self_help", () => {
    const payload = projectCitizenTriageView({
      ...base,
      triage_status: "completed",
      status: "new",
      routing_destination: "self_help",
      category: "pothole",
    });
    expect(payload.service_step).toBe("self_help_guidance");
    expect(payload.summary).toBeNull();
    expect(payload.category).toBeNull();
    expect(payload.playbook_id).toBe("pothole");
    expect(payload.can_escalate).toBe(true);
    expect(payload).not.toHaveProperty("routing_reason");
    expect(payload).not.toHaveProperty("routing_policy_version");
  });

  it("sets can_escalate only on active self_help path", () => {
    const resolved = projectCitizenTriageView({
      ...base,
      triage_status: "completed",
      status: "resolved",
      routing_destination: "self_help",
    });
    expect(resolved.service_step).toBe("resolved");
    expect(resolved.can_escalate).toBeUndefined();
  });
});

describe("lookupCitizenStatus", () => {
  it("returns citizen-safe payload for a valid token", async () => {
    const client = createClient({
      tokenRow: {
        token_hash: "hash",
        report_id: "rep-1",
        expires_at: futureIso(),
      },
      reportRow: {
        report_id: "rep-1",
        created_at: "2026-07-20T10:00:00+00:00",
        triage_status: "completed",
        current_status: "reviewing",
        category: "pothole",
        severity: 3,
        priority: "medium",
        summary: "Pothole near the market.",
        recommendation: "Inspect road.",
      },
      events: [
        {
          status: "reviewing",
          note: "Crew assigned",
          created_at: "2026-07-20T15:00:00+00:00",
        },
      ],
    });

    const payload = await lookupCitizenStatus(
      { report_id: "rep-1", token: "citizen-token" },
      client as never,
    );
    expect(payload.report_id).toBe("rep-1");
    expect(payload.triage_status).toBe("completed");
    expect(payload.service_step).toBe("officer_review");
    expect(payload.status).toBe("reviewing");
    expect(payload.summary).toBe("Pothole near the market.");
    expect(payload).not.toHaveProperty("triage_error");
  });

  it("throws the same unauthorized error for missing, expired, and mismatched tokens", async () => {
    const cases = [
      createClient({ tokenRow: null }),
      createClient({
        tokenRow: {
          token_hash: "hash",
          report_id: "rep-1",
          expires_at: new Date(Date.now() - 86_400_000).toISOString(),
        },
      }),
      createClient({
        tokenRow: {
          token_hash: "hash",
          report_id: "other-report",
          expires_at: futureIso(),
        },
      }),
    ];

    const details = await Promise.all(
      cases.map(async (client) => {
        try {
          await lookupCitizenStatus({ report_id: "rep-1", token: "token" }, client as never);
          return "ok";
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      }),
    );

    expect(new Set(details).size).toBe(1);
    expect(details[0]).toBe(CITIZEN_STATUS_UNAUTHORIZED_DETAIL);
  });
});

describe("handleCitizenStatusRequest", () => {
  afterEach(() => {
    resetRateLimiters();
    resetAdminClientCache();
    vi.unstubAllEnvs();
  });

  it("returns 422 for invalid bodies", async () => {
    const response = await handleCitizenStatusRequest(
      new Request("http://localhost/api/v1/reports/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: "", token: "" }),
      }),
    );
    expect(response.status).toBe(422);
  });

  it("returns uniform 401 verification failures", async () => {
    const client = createClient({ tokenRow: null });
    const response = await handleCitizenStatusRequest(
      new Request("http://localhost/api/v1/reports/status", {
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

  it("returns 429 with Retry-After for status limiter violations", async () => {
    vi.stubEnv("STATUS_RATE_LIMIT_PER_MINUTE", "1");
    const client = createClient({
      tokenRow: {
        token_hash: "hash",
        report_id: "rep-1",
        expires_at: futureIso(),
      },
      reportRow: {
        report_id: "rep-1",
        created_at: "2026-07-20T10:00:00+00:00",
        triage_status: "completed",
        current_status: "new",
        summary: "Summary",
      },
      events: [],
    });

    const requestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.50",
      },
      body: JSON.stringify({ report_id: "rep-1", token: "token" }),
    } as const;

    const first = await handleCitizenStatusRequest(
      new Request("http://localhost/api/v1/reports/status", requestInit),
      { client: client as never },
    );
    const second = await handleCitizenStatusRequest(
      new Request("http://localhost/api/v1/reports/status", requestInit),
      { client: client as never },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("60");
  });
});
