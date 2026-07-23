import { describe, expect, it, vi } from "vitest";

import { COACH_SYSTEM_PROMPT, buildCoachReportContext, generateCoachReply } from "./coach";

describe("coach", () => {
  it("builds report context from evaluator columns", () => {
    const context = buildCoachReportContext({
      report_id: "report-1",
      routing_destination: "self_help",
      category: "pothole",
      observed_facts: ["Pothole near curb."],
      recommended_action: "Mark the area and monitor.",
      severity_reason: "Pothole near curb.",
      priority_reason: "Minor localized inconvenience.",
      severity: 2,
      priority: "low",
      confidence: 0.7,
    });

    expect(context.playbookId).toBe("pothole");
    expect(context.observedFacts).toContain("Pothole near curb.");
  });

  it("injects guardrails and playbook context into provider messages", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        model: "test-model",
        choices: [{ message: { content: "Try marking the area with chalk." } }],
      }),
    );

    await generateCoachReply(
      {
        context: {
          reportId: "report-1",
          routingDestination: "self_help",
          category: "pothole",
          observedFacts: ["Pothole near curb."],
          recommendedAction: "Mark the area and monitor.",
          playbookId: "pothole",
        },
        history: [],
        userMessage: "What should I do first?",
      },
      {
        env: {
          SUPABASE_URL: "http://127.0.0.1:54321",
          SUPABASE_SERVICE_ROLE_KEY: "key",
          AI_BASE_URL: "http://127.0.0.1:8080/v1",
          AI_MODEL: "test-model",
          AI_PROVIDER_LABEL: "test",
          THIRD_PARTY_API_KEY: "secret",
          AI_SUPPORTS_VISION: false,
          AI_TIMEOUT_MS: 10_000,
          TRIAGE_SHADOW_MODE: "off",
        },
        fetchImpl,
      },
    );

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };
    const system = body.messages.find((message) => message.role === "system")?.content ?? "";
    expect(system).toContain(COACH_SYSTEM_PROMPT);
    expect(system).toContain("playbook_id: pothole");
    expect(system).toContain("cannot change report status");
  });
});
