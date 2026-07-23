import { describe, expect, it, vi } from "vitest";

import {
  buildOfficerReportContext,
  generateOfficerAssistantReply,
  OFFICER_ASSISTANT_SYSTEM_PROMPT,
} from "./officer-assistant";

describe("officer-assistant AI", () => {
  it("builds report context with triage fields from officer report", () => {
    const context = buildOfficerReportContext({
      report_id: "rep-1",
      created_at: "2026-07-22T00:00:00.000Z",
      status: "reviewing",
      triage_status: "completed",
      routing_destination: "government",
      category: "flooding",
      severity: 4,
      priority: "high",
      confidence: 0.8,
      summary: "Standing water blocks crosswalk.",
      recommendation: "Inspect drainage.",
      evidence: ["Standing water blocks crosswalk."],
      uncertainty: [],
    });

    expect(context.reportId).toBe("rep-1");
    expect(context.triageStatus).toBe("completed");
    expect(context.severity).toBe(4);
    expect(context.observedFacts.length).toBeGreaterThan(0);
  });

  it("includes report_id and triage_status in system message when report attached", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        model: "test-model",
        choices: [{ message: { content: "Review evidence on the detail page." } }],
      }),
    );

    await generateOfficerAssistantReply(
      {
        AI_BASE_URL: "http://127.0.0.1:8080/v1",
        AI_MODEL: "test-model",
        THIRD_PARTY_API_KEY: "secret",
        AI_PROVIDER_LABEL: "test",
        AI_TIMEOUT_MS: 10_000,
        AI_SUPPORTS_VISION: false,
        TRIAGE_SHADOW_MODE: "off",
      } as never,
      {
        message: "What is the priority?",
        history: [],
        reportContext: {
          reportId: "rep-1",
          status: "new",
          triageStatus: "completed",
          routingDestination: "government",
          category: "flooding",
          severity: 4,
          priority: "high",
          observedFacts: ["Standing water blocks crosswalk."],
        },
      },
      { fetchImpl },
    );

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      stream?: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.stream).toBe(false);
    const system = body.messages.find((message) => message.role === "system")?.content ?? "";
    expect(system).toContain(OFFICER_ASSISTANT_SYSTEM_PROMPT);
    expect(system).toContain("report_id: rep-1");
    expect(system).toContain("triage_status: completed");
    expect(system).toContain("officers retain final authority");
  });
});
