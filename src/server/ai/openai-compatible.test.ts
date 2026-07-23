import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerEnv } from "../config/env";
import {
  AnalysisProviderError,
  GENERIC_ANALYSIS_FAILURE,
  MAX_RESPONSE_BYTES,
  analyzeStructured,
  completeConversationalChat,
  createOpenAiCompatibleProvider,
  redactSensitiveText,
} from "./openai-compatible";

const validHanoiAnalysis = {
  category: "pothole",
  matched_known_issue: true,
  observed_facts: ["A large pothole occupies part of one traffic lane."],
  inferences: ["The defect may materially impair mobility."],
  unknowns: ["Pothole depth is unknown."],
  severity: "medium",
  severity_reason:
    "The road defect materially impairs normal lane use without an explicit active hazard.",
  confidence: 0.9,
  handling_type: 2,
  handling_label: "TEMPORARY_SAFE_ACTION",
  allowed_actions: ["Report the exact location from a safe position."],
  prohibited_actions: ["Do not enter the traffic lane or repair the road."],
  recommended_action: "Inspect and schedule authorized road repair.",
  guidance_code: "report_road_damage",
  critical_alert: false,
  requires_human_review: true,
};

function testEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    SUPABASE_URL: "https://supabase.example.com",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    AI_BASE_URL: "https://ai.example.com/v1",
    AI_MODEL: "configured-model",
    AI_PROVIDER_LABEL: "third-party",
    THIRD_PARTY_API_KEY: "secret-api-key-value",
    AI_SUPPORTS_VISION: false,
    AI_TIMEOUT_MS: 30_000,
    ...overrides,
  };
}

function completionResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "req_test_123",
    model: "actual-response-model",
    choices: [
      {
        message: {
          content: JSON.stringify(validHanoiAnalysis),
        },
        finish_reason: "stop",
      },
    ],
    ...overrides,
  };
}

function mockFetchText(
  body: string,
  init: { ok?: boolean; status?: number } = {},
): typeof fetch {
  return vi.fn(async () => {
    return new Response(body, {
      status: init.status ?? (init.ok === false ? 500 : 200),
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof fetch;
}

function mockFetchJson(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(body), {
      status: init.status ?? (init.ok === false ? 500 : 200),
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("createOpenAiCompatibleProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses SSE chat completion bodies from OpenAI-compatible proxies", async () => {
    const sseBody = `data: ${JSON.stringify(completionResponse())}\n\ndata: [DONE]\n\n`;
    const provider = createOpenAiCompatibleProvider({
      env: testEnv(),
      fetchImpl: mockFetchText(sseBody),
    });

    const result = await provider.analyze({
      description: "Large pothole near a school entrance.",
    });

    expect(result.analysis.category).toBe("pothole");
    expect(result.lineage.responseModel).toBe("actual-response-model");
  });

  it("sends text-only requests to the configured fixed chat/completions path", async () => {
    const fetchImpl = mockFetchJson(completionResponse());
    const env = testEnv();
    const provider = createOpenAiCompatibleProvider({ env, fetchImpl });

    await provider.analyze({ description: "Large pothole near a school entrance." });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ai.example.com/v1/chat/completions");
    expect(request.redirect).toBe("error");
    expect(request.method).toBe("POST");

    const payload = JSON.parse(String(request.body));
    expect(payload.model).toBe("configured-model");
    expect(payload.stream).toBe(false);
    expect(payload.response_format.type).toBe("json_object");
    expect(payload.messages[1].content[0].text).toContain("Large pothole near a school entrance.");
    expect(payload.messages[1].content).toHaveLength(1);
  });

  it("omits image content when vision is disabled", async () => {
    const fetchImpl = mockFetchJson(completionResponse());
    const provider = createOpenAiCompatibleProvider({ env: testEnv(), fetchImpl });

    await provider.analyze({
      description: "Large pothole near a school entrance.",
      image: {
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        mimeType: "image/jpeg",
      },
    });

    const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));
    expect(payload.messages[1].content).toHaveLength(1);
    expect(payload.messages[1].content[0].type).toBe("text");
  });

  it("includes a validated image content part when vision is enabled", async () => {
    const fetchImpl = mockFetchJson(completionResponse());
    const provider = createOpenAiCompatibleProvider({
      env: testEnv({ AI_SUPPORTS_VISION: true }),
      fetchImpl,
    });

    await provider.analyze({
      description: "Large pothole near a school entrance.",
      image: {
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        mimeType: "image/jpeg",
      },
    });

    const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(request.body));
    expect(payload.messages[1].content).toHaveLength(2);
    expect(payload.messages[1].content[1].type).toBe("image_url");
    expect(payload.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("returns actual response lineage fields", async () => {
    const provider = createOpenAiCompatibleProvider({
      env: testEnv(),
      fetchImpl: mockFetchJson(completionResponse()),
    });

    const result = await provider.analyze({
      description: "Large pothole near a school entrance.",
    });

    expect(result.lineage.providerLabel).toBe("third-party");
    expect(result.lineage.responseModel).toBe("actual-response-model");
    expect(result.lineage.requestId).toBe("req_test_123");
    expect(result.lineage.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.analysis.category).toBe("pothole");
  });

  it("maps non-2xx responses to generic failures", async () => {
    const provider = createOpenAiCompatibleProvider({
      env: testEnv(),
      fetchImpl: mockFetchJson({ error: "upstream failure" }, { ok: false, status: 502 }),
    });

    await expect(provider.analyze({ description: "Valid incident report" })).rejects.toMatchObject({
      code: "http_error",
      message: GENERIC_ANALYSIS_FAILURE,
    });
  });

  it("maps refusal and empty content to invalid_response", async () => {
    const refusedProvider = createOpenAiCompatibleProvider({
      env: testEnv(),
      fetchImpl: mockFetchJson(
        completionResponse({
          choices: [{ message: { refusal: "policy" } }],
        }),
      ),
    });
    await expect(
      refusedProvider.analyze({ description: "Valid incident report" }),
    ).rejects.toMatchObject({ code: "invalid_response" });

    const emptyProvider = createOpenAiCompatibleProvider({
      env: testEnv(),
      fetchImpl: mockFetchJson(
        completionResponse({
          choices: [{ message: { content: "" } }],
        }),
      ),
    });
    await expect(
      emptyProvider.analyze({ description: "Valid incident report" }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("maps invalid JSON and schema violations to generic failures", async () => {
    const invalidJsonProvider = createOpenAiCompatibleProvider({
      env: testEnv(),
      fetchImpl: mockFetchJson(
        completionResponse({
          choices: [{ message: { content: "not-json" } }],
        }),
      ),
    });
    await expect(
      invalidJsonProvider.analyze({ description: "Valid incident report" }),
    ).rejects.toMatchObject({ code: "invalid_response" });

    const invalidSchemaProvider = createOpenAiCompatibleProvider({
      env: testEnv(),
      fetchImpl: mockFetchJson(
        completionResponse({
          choices: [{ message: { content: JSON.stringify({ category: "pothole" }) } }],
        }),
      ),
    });
    await expect(
      invalidSchemaProvider.analyze({ description: "Valid incident report" }),
    ).rejects.toMatchObject({ code: "schema_invalid" });
  });

  it("accepts Hanoi payloads with prompt-only metadata keys stripped", async () => {
    const result = await analyzeStructured(
      {
        env: testEnv(),
        fetchImpl: mockFetchJson(
          completionResponse({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ...validHanoiAnalysis,
                    output_language: "vi-VN",
                    priority: "medium",
                  }),
                },
              },
            ],
          }),
        ),
      },
      { description: "Valid incident report" },
    );

    expect(result.hanoiAnalysis.category).toBe("pothole");
  });

  it("rejects oversized responses", async () => {
    const hugePayload = "x".repeat(MAX_RESPONSE_BYTES + 1);
    const fetchImpl = vi.fn(async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(hugePayload));
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    }) as typeof fetch;

    const provider = createOpenAiCompatibleProvider({ env: testEnv(), fetchImpl });
    await expect(provider.analyze({ description: "Valid incident report" })).rejects.toMatchObject({
      code: "oversized_response",
    });
  });

  it("maps fetch timeouts to generic failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as typeof fetch;

    const provider = createOpenAiCompatibleProvider({ env: testEnv(), fetchImpl });
    await expect(provider.analyze({ description: "Valid incident report" })).rejects.toMatchObject(
      { code: "timeout" },
    );
  });

  it("never exposes secrets in generic error messages", async () => {
    const env = testEnv();
    const provider = createOpenAiCompatibleProvider({
      env,
      fetchImpl: mockFetchJson({ detail: env.THIRD_PARTY_API_KEY }, { ok: false, status: 500 }),
    });

    try {
      await provider.analyze({ description: "Valid incident report" });
      throw new Error("expected provider failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AnalysisProviderError);
      const message = (error as Error).message;
      expect(message).toBe(GENERIC_ANALYSIS_FAILURE);
      expect(message).not.toContain(env.THIRD_PARTY_API_KEY);
      expect(message).not.toContain(env.AI_BASE_URL);
    }
  });
});

describe("completeConversationalChat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests non-streaming chat completions", async () => {
    const fetchImpl = mockFetchJson({
      model: "configured-model",
      choices: [{ message: { content: "Severity measures impact." } }],
    });

    const result = await completeConversationalChat(
      { env: testEnv(), fetchImpl },
      [
        { role: "system", content: "Be brief." },
        { role: "user", content: "What is severity?" },
      ],
    );

    expect(result.content).toBe("Severity measures impact.");
    const payload = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(payload.stream).toBe(false);
  });

  it("aggregates SSE reasoning deltas when proxies stream anyway", async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"reasoning_content":"Severity measures impact."}}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      "data: [DONE]",
      "",
    ].join("\n");

    const result = await completeConversationalChat(
      { env: testEnv(), fetchImpl: mockFetchText(sseBody) },
      [{ role: "user", content: "What is severity?" }],
    );

    expect(result.content).toBe("Severity measures impact.");
  });
});

describe("analyzeStructured", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed Hanoi analysis for valid provider content", async () => {
    const result = await analyzeStructured(
      {
        env: testEnv(),
        fetchImpl: mockFetchJson(completionResponse()),
      },
      { description: "A large pothole occupies part of one traffic lane." },
    );

    expect(result.hanoiAnalysis.category).toBe("pothole");
    expect(result.hanoiAnalysis.severity).toBe("medium");
    expect(result.analysis.severity).toBe(2);
    expect(result.rawContent).toContain("report_road_damage");
  });

  it("rejects policy-invalid Hanoi output before returning", async () => {
    const policyInvalid = {
      ...validHanoiAnalysis,
      severity: "medium",
      handling_type: 1,
      handling_label: "SELF_GUIDANCE",
      guidance_code: "self_collect_safe_litter",
    };

    await expect(
      analyzeStructured(
        {
          env: testEnv(),
          fetchImpl: mockFetchJson(
            completionResponse({
              choices: [{ message: { content: JSON.stringify(policyInvalid) } }],
            }),
          ),
        },
        { description: "Valid incident report" },
      ),
    ).rejects.toMatchObject({ code: "policy_invalid" });
  });
});

describe("redactSensitiveText", () => {
  it("redacts API keys and endpoint URLs from diagnostic text", () => {
    const env = testEnv();
    const redacted = redactSensitiveText(
      `key=${env.THIRD_PARTY_API_KEY} url=${env.AI_BASE_URL}`,
      env,
    );
    expect(redacted).not.toContain(env.THIRD_PARTY_API_KEY);
    expect(redacted).not.toContain(env.AI_BASE_URL);
    expect(redacted).toContain("[REDACTED]");
  });
});
