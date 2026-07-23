import { afterEach, describe, expect, it, vi } from "vitest";

import { hashAccessToken } from "@/server/security/access-tokens";
import { resetRateLimiters } from "@/server/security/rate-limit";
import {
  finalizeIntakeSubmit,
  listIntakeMessages,
  sendIntakeMessage,
  startIntakeSession,
} from "./citizen-chat-intake";

const TEST_TOKEN = "intake-test-token";
const TEST_TOKEN_HASH = hashAccessToken(TEST_TOKEN);
const WRONG_TOKEN = "wrong-token";
const REPORT_ID = "report-1";

const generateFacilitatorReply = vi.fn();
const checkAiHealth = vi.fn();
const dispatchTriageAndWait = vi.fn();
const getCitizenStatus = vi.fn();
const createIntakeReportWithAccessToken = vi.fn();

vi.mock("@/server/ai/intake-facilitator", () => ({
  INTAKE_FACILITATOR_SYSTEM_PROMPT: "test prompt",
  generateFacilitatorReply: (...args: unknown[]) => generateFacilitatorReply(...args),
}));

vi.mock("@/server/health/ai-readiness", () => ({
  checkAiHealth: () => checkAiHealth(),
}));

vi.mock("@/server/triage/dispatch", () => ({
  dispatchTriageAndWait: (...args: unknown[]) => dispatchTriageAndWait(...args),
  enqueueTriageDispatch: vi.fn(),
}));

vi.mock("@/server/repositories/reports", async () => {
  const actual = await vi.importActual<typeof import("@/server/repositories/reports")>(
    "@/server/repositories/reports",
  );
  return {
    ...actual,
    getCitizenStatus: (...args: unknown[]) => getCitizenStatus(...args),
    createIntakeReportWithAccessToken: (...args: unknown[]) =>
      createIntakeReportWithAccessToken(...args),
  };
});

function createClient(options: {
  row?: Record<string, unknown> | null;
  tokenReportId?: string;
  tokenValid?: boolean;
} = {}) {
  const {
    row = { report_id: REPORT_ID, triage_status: "pending" },
    tokenReportId = REPORT_ID,
    tokenValid = true,
  } = options;

  const tokenRow = tokenValid
    ? {
        token_hash: TEST_TOKEN_HASH,
        report_id: tokenReportId,
        expires_at: "2099-01-01T00:00:00.000Z",
      }
    : null;

  const messages: Array<Record<string, unknown>> = [];
  let reportData = row ? { ...row } : null;

  const from = vi.fn((table: string) => {
    if (table === "access_tokens") {
      return {
        select: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: tokenRow, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "reports") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: reportData, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (_col: string, _val: string) => ({
            eq: async () => {
              if (reportData) {
                reportData = { ...reportData, ...payload };
              }
              return { error: null };
            },
          }),
        }),
      };
    }
    if (table === "chat_messages") {
      return {
        select: (_columns: string, options?: { count?: string; head?: boolean }) => {
          if (options?.head) {
            return {
              eq: () => ({
                gte: async () => ({ count: messages.length, error: null }),
              }),
            };
          }
          return {
            eq: () => ({
              order: async () => ({ data: [...messages], error: null }),
            }),
          };
        },
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const record = {
                message_id: `msg-${messages.length + 1}`,
                report_id: payload.report_id,
                role: payload.role,
                content: payload.content,
                created_at: new Date().toISOString(),
                model: payload.model ?? null,
                latency_ms: payload.latency_ms ?? null,
              };
              messages.push(record);
              return { data: record, error: null };
            },
          }),
        }),
      };
    }
    return {};
  });

  return { from, messages, getReportData: () => reportData };
}

describe("citizen-chat-intake", () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetRateLimiters();
    checkAiHealth.mockResolvedValue({
      body: { status: "up", model: "test", latency_ms: 10, checked_at: "now" },
      cacheHit: false,
    });
    generateFacilitatorReply.mockResolvedValue({
      content: "Thanks — can you tell me where this happened?",
      model: "test-model",
      latencyMs: 12,
    });
    dispatchTriageAndWait.mockResolvedValue(undefined);
    createIntakeReportWithAccessToken.mockResolvedValue(undefined);
    getCitizenStatus.mockResolvedValue({
      report_id: REPORT_ID,
      received_at: "2026-07-23T00:00:00.000Z",
      triage_status: "completed",
      status: "new",
      category: "pothole",
      severity: 2,
      priority: "low",
      summary: "Pothole near curb.",
      recommendation: "Monitor the area.",
      routing_destination: "self_help",
      history: [],
    });
  });

  it("starts intake and returns report_id, access_token, and welcome message", async () => {
    const client = createClient();
    const payload = await startIntakeSession({ locale: "en" }, client as never);

    expect(payload.report_id).toBeTruthy();
    expect(payload.access_token).toBeTruthy();
    expect(payload.welcome_message.role).toBe("assistant");
    expect(payload.welcome_message.content).toContain("community issue");
    expect(client.messages).toHaveLength(1);
    expect(createIntakeReportWithAccessToken).toHaveBeenCalled();
  });

  it("rejects wrong token with 401", async () => {
    const client = createClient({ tokenValid: false });

    await expect(
      listIntakeMessages({ report_id: REPORT_ID, token: WRONG_TOKEN }, client as never),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("lists messages for authorized pending reports", async () => {
    const client = createClient();

    const payload = await listIntakeMessages(
      { report_id: REPORT_ID, token: TEST_TOKEN },
      client as never,
    );
    expect(payload.messages).toEqual([]);
  });

  it("persists user and assistant messages on POST", async () => {
    const client = createClient();
    const payload = await sendIntakeMessage(
      {
        report_id: REPORT_ID,
        token: TEST_TOKEN,
        message: "There is a pothole on my street.",
      },
      client as never,
    );

    expect(payload.assistant_message.content).toBe(
      "Thanks — can you tell me where this happened?",
    );
    expect(generateFacilitatorReply).toHaveBeenCalled();
    expect(client.messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(client.messages.filter((m) => m.role === "assistant")).toHaveLength(1);
  });

  it("returns 503 when AI health is down", async () => {
    checkAiHealth.mockResolvedValueOnce({
      body: { status: "down", model: "test", latency_ms: 0, checked_at: "now" },
      cacheHit: false,
    });
    const client = createClient();

    await expect(
      sendIntakeMessage(
        { report_id: REPORT_ID, token: TEST_TOKEN, message: "Hello" },
        client as never,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("submit returns report_id, access_token, triage_status, and service_step", async () => {
    const client = createClient();
    const payload = await finalizeIntakeSubmit(
      {
        auth: { report_id: REPORT_ID, token: TEST_TOKEN },
        description: "Large pothole near the school gate.",
      },
      client as never,
      { dispatchTriageAndWait },
    );

    expect(payload.report_id).toBe(REPORT_ID);
    expect(payload.access_token).toBe(TEST_TOKEN);
    expect(payload.triage_status).toBe("completed");
    expect(payload.service_step).toBeTruthy();
    expect(dispatchTriageAndWait).toHaveBeenCalledWith(REPORT_ID, expect.any(Object));
  });

  it("rejects submit when description is too short", async () => {
    const client = createClient();

    await expect(
      finalizeIntakeSubmit(
        {
          auth: { report_id: REPORT_ID, token: TEST_TOKEN },
          description: "hi",
        },
        client as never,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});
