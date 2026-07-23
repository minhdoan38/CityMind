import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@/server/http/errors";
import { hashAccessToken } from "@/server/security/access-tokens";
import { resetRateLimiters } from "@/server/security/rate-limit";
import { listCoachMessages, sendCoachMessage } from "./citizen-coach";

const TEST_TOKEN = "coach-test-token";
const TEST_TOKEN_HASH = hashAccessToken(TEST_TOKEN);

const generateCoachReply = vi.fn();
const checkAiHealth = vi.fn();

vi.mock("@/server/ai/coach", async () => {
  const actual = await vi.importActual<typeof import("@/server/ai/coach")>("@/server/ai/coach");
  return {
    ...actual,
    generateCoachReply: (...args: unknown[]) => generateCoachReply(...args),
  };
});

vi.mock("@/server/health/ai-readiness", () => ({
  checkAiHealth: () => checkAiHealth(),
}));

function createClient(row: Record<string, unknown> | null) {
  const tokenRow = {
    token_hash: TEST_TOKEN_HASH,
    report_id: "report-1",
    expires_at: "2099-01-01T00:00:00.000Z",
  };
  const messages: Array<Record<string, unknown>> = [];

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
            maybeSingle: async () => ({ data: row, error: null }),
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

  return { from, messages };
}

const eligibleRow = {
  report_id: "report-1",
  triage_status: "completed",
  routing_destination: "self_help",
  category: "pothole",
  observed_facts: ["Pothole near curb."],
  recommended_action: "Mark the area and monitor.",
  severity_reason: "Pothole near curb.",
  priority_reason: "Minor localized inconvenience.",
  severity: 2,
  priority: "low",
  confidence: 0.7,
  summary: null,
  recommendation: null,
  estimated_impact: null,
  evidence: null,
  uncertainty: null,
  inferences: null,
  unknowns: null,
};

describe("citizen-coach", () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetRateLimiters();
    checkAiHealth.mockResolvedValue({
      body: { status: "up", model: "test", latency_ms: 10, checked_at: "now" },
      cacheHit: false,
    });
    generateCoachReply.mockResolvedValue({
      content: "Start by marking the area.",
      model: "test-model",
      latencyMs: 12,
    });
  });

  it("lists messages for eligible self-help reports", async () => {
    const client = createClient(eligibleRow);
    const payload = await listCoachMessages(
      { report_id: "report-1", token: TEST_TOKEN },
      client as never,
    );
    expect(payload.messages).toEqual([]);
  });

  it("rejects government-routed reports", async () => {
    const client = createClient({
      ...eligibleRow,
      routing_destination: "government",
    });

    await expect(
      listCoachMessages({ report_id: "report-1", token: TEST_TOKEN }, client as never),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("persists assistant replies for valid coach sends", async () => {
    const client = createClient(eligibleRow);
    const payload = await sendCoachMessage(
      { report_id: "report-1", token: TEST_TOKEN, message: "What should I do?" },
      client as never,
    );

    expect(payload.assistant_message.content).toBe("Start by marking the area.");
    expect(generateCoachReply).toHaveBeenCalled();
  });

  it("returns 503 when AI health is down", async () => {
    checkAiHealth.mockResolvedValueOnce({
      body: { status: "down", model: "test", latency_ms: 0, checked_at: "now" },
      cacheHit: false,
    });
    const client = createClient(eligibleRow);

    await expect(
      sendCoachMessage(
        { report_id: "report-1", token: TEST_TOKEN, message: "Hello" },
        client as never,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
