import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOfficerContext = vi.fn();
const checkAiHealth = vi.fn();
const generateOfficerAssistantReply = vi.fn();
const listOfficerAssistantMessages = vi.fn();
const insertOfficerAssistantMessage = vi.fn();
const getOfficerReport = vi.fn();
const getAdminClient = vi.fn();

vi.mock("@/server/officer/guard", () => ({
  requireOfficerContext: () => requireOfficerContext(),
}));

vi.mock("@/server/health/ai-readiness", () => ({
  checkAiHealth: (...args: unknown[]) => checkAiHealth(...args),
}));

vi.mock("@/server/ai/officer-assistant", () => ({
  buildOfficerReportContext: vi.fn((report: { report_id: string }) => ({
    reportId: report.report_id,
    status: "new",
    triageStatus: "completed",
    routingDestination: "government",
    category: "flooding",
    severity: 4,
    priority: "high",
    observedFacts: ["Standing water."],
  })),
  generateOfficerAssistantReply: (...args: unknown[]) =>
    generateOfficerAssistantReply(...args),
}));

vi.mock("@/server/repositories/officer-assistant-messages", () => ({
  listOfficerAssistantMessages: (...args: unknown[]) =>
    listOfficerAssistantMessages(...args),
  insertOfficerAssistantMessage: (...args: unknown[]) =>
    insertOfficerAssistantMessage(...args),
}));

vi.mock("@/server/repositories/reports", () => ({
  getOfficerReport: (...args: unknown[]) => getOfficerReport(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => getAdminClient(),
}));

vi.mock("@/server/config/env", () => ({
  getServerEnv: () => ({
    AI_BASE_URL: "http://127.0.0.1:8080/v1",
    AI_MODEL: "test-model",
    THIRD_PARTY_API_KEY: "test-key",
    AI_PROVIDER_LABEL: "test",
    AI_TIMEOUT_MS: 60_000,
    AI_SUPPORTS_VISION: false,
    TRIAGE_SHADOW_MODE: "off",
  }),
}));

import {
  handleOfficerAssistantListRequest,
  handleOfficerAssistantMessageRequest,
  resetOfficerAssistantLimiter,
} from "@/server/services/officer-assistant";

const officerContext = {
  ok: true as const,
  context: {
    session: { userId: "officer-1", role: "officer" as const },
    client: { from: vi.fn() },
  },
};

describe("handleOfficerAssistantMessageRequest", () => {
  beforeEach(() => {
    resetOfficerAssistantLimiter();
    requireOfficerContext.mockReset();
    checkAiHealth.mockReset();
    generateOfficerAssistantReply.mockReset();
    listOfficerAssistantMessages.mockReset();
    insertOfficerAssistantMessage.mockReset();
    getOfficerReport.mockReset();
    getAdminClient.mockReturnValue({ from: vi.fn() });

    requireOfficerContext.mockResolvedValue(officerContext);
    checkAiHealth.mockResolvedValue({
      body: { status: "up", model: "test-model", latency_ms: 100, checked_at: "" },
      cacheHit: false,
    });
    listOfficerAssistantMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          message_id: "msg-user",
          officer_user_id: "officer-1",
          report_id: null,
          role: "user",
          content: "What does priority mean?",
          created_at: "2026-07-22T00:00:00.000Z",
          model: null,
          latency_ms: null,
        },
        {
          message_id: "msg-assistant",
          officer_user_id: "officer-1",
          report_id: null,
          role: "assistant",
          content: "Open report detail for structured analysis.",
          created_at: "2026-07-22T00:01:00.000Z",
          model: "test-model",
          latency_ms: 42,
        },
      ]);
    insertOfficerAssistantMessage.mockImplementation(async (_client, input) => ({
      message_id: input.role === "user" ? "msg-user" : "msg-assistant",
      officer_user_id: "officer-1",
      report_id: input.reportId ?? null,
      role: input.role,
      content: input.content,
      created_at: "2026-07-22T00:00:00.000Z",
      model: input.model ?? null,
      latency_ms: input.latencyMs ?? null,
    }));
    generateOfficerAssistantReply.mockResolvedValue({
      content: "Open report detail for structured analysis.",
      model: "test-model",
      latencyMs: 42,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    requireOfficerContext.mockResolvedValue({
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    });

    const response = await handleOfficerAssistantMessageRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "POST",
        body: JSON.stringify({ message: "How do I read severity?" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 503 when AI health is down", async () => {
    checkAiHealth.mockResolvedValue({
      body: { status: "down", model: "test-model", latency_ms: 0, checked_at: "" },
      cacheHit: false,
    });

    const response = await handleOfficerAssistantMessageRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "POST",
        body: JSON.stringify({ message: "Hello" }),
      }),
    );

    expect(response.status).toBe(503);
  });

  it("returns assistant reply using persisted history", async () => {
    listOfficerAssistantMessages.mockReset();
    listOfficerAssistantMessages
      .mockResolvedValueOnce([
        {
          message_id: "msg-prev",
          officer_user_id: "officer-1",
          report_id: null,
          role: "assistant",
          content: "Prior reply.",
          created_at: "2026-07-22T00:00:00.000Z",
          model: null,
          latency_ms: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          message_id: "msg-prev",
          officer_user_id: "officer-1",
          report_id: null,
          role: "assistant",
          content: "Prior reply.",
          created_at: "2026-07-22T00:00:00.000Z",
          model: null,
          latency_ms: null,
        },
        {
          message_id: "msg-user",
          officer_user_id: "officer-1",
          report_id: null,
          role: "user",
          content: "What does priority mean?",
          created_at: "2026-07-22T00:01:00.000Z",
          model: null,
          latency_ms: null,
        },
        {
          message_id: "msg-assistant",
          officer_user_id: "officer-1",
          report_id: null,
          role: "assistant",
          content: "Open report detail for structured analysis.",
          created_at: "2026-07-22T00:02:00.000Z",
          model: "test-model",
          latency_ms: 42,
        },
      ]);

    const response = await handleOfficerAssistantMessageRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "POST",
        body: JSON.stringify({
          message: "What does priority mean?",
          history: [{ role: "user", content: "Ignored client history" }],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assistant_message.content).toContain("structured analysis");
    expect(body.messages).toHaveLength(3);
    expect(generateOfficerAssistantReply).toHaveBeenCalledWith(
      expect.any(Object),
      {
        message: "What does priority mean?",
        history: [{ role: "assistant", content: "Prior reply." }],
        reportContext: null,
      },
    );
    expect(insertOfficerAssistantMessage).toHaveBeenCalledTimes(2);
    expect(listOfficerAssistantMessages).toHaveBeenCalledWith(
      expect.anything(),
      "officer-1",
    );
  });

  it("returns 422 for empty message", async () => {
    const response = await handleOfficerAssistantMessageRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "POST",
        body: JSON.stringify({ message: "   " }),
      }),
    );

    expect(response.status).toBe(422);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const limiterSettings = await import("@/server/security/rate-limit");
    vi.spyOn(limiterSettings, "loadRateLimitSettings").mockReturnValue({
      reportRateLimitPerMinute: 1,
      statusRateLimitPerMinute: 30,
      analyzeRateLimitPerMinute: 10,
      coachRateLimitPerMinute: 20,
    });

    const first = await handleOfficerAssistantMessageRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "POST",
        body: JSON.stringify({ message: "First" }),
      }),
    );
    expect(first.status).toBe(200);

    const second = await handleOfficerAssistantMessageRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "POST",
        body: JSON.stringify({ message: "Second" }),
      }),
    );

    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("60");
  });

  it("returns 404 when report attach is invalid", async () => {
    getOfficerReport.mockResolvedValue(null);

    const response = await handleOfficerAssistantMessageRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "POST",
        body: JSON.stringify({
          message: "Summarize this report",
          report_id: "missing-report",
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(generateOfficerAssistantReply).not.toHaveBeenCalled();
  });
});

describe("handleOfficerAssistantListRequest", () => {
  beforeEach(() => {
    resetOfficerAssistantLimiter();
    requireOfficerContext.mockReset();
    listOfficerAssistantMessages.mockReset();
    getAdminClient.mockReturnValue({ from: vi.fn() });
    requireOfficerContext.mockResolvedValue(officerContext);
    listOfficerAssistantMessages.mockResolvedValue([
      {
        message_id: "msg-1",
        officer_user_id: "officer-1",
        report_id: null,
        role: "assistant",
        content: "Hello",
        created_at: "2026-07-22T00:00:00.000Z",
        model: null,
        latency_ms: null,
      },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    requireOfficerContext.mockResolvedValue({
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    });

    const response = await handleOfficerAssistantListRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns persisted messages for officer", async () => {
    const response = await handleOfficerAssistantListRequest(
      new Request("http://localhost/api/officer/assistant/messages", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.messages).toHaveLength(1);
    expect(listOfficerAssistantMessages).toHaveBeenCalledWith(
      expect.anything(),
      "officer-1",
    );
  });
});
