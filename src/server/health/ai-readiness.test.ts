import { afterEach, describe, expect, it, vi } from "vitest";

import { resetServerEnvCache } from "@/server/config/env";
import { checkAiHealth, resetAiHealthCache } from "./ai-readiness";

const BASE_ENV = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  AI_BASE_URL: "http://127.0.0.1:8080/v1",
  AI_MODEL: "test-model",
  AI_PROVIDER_LABEL: "test",
  THIRD_PARTY_API_KEY: "test-api-key",
  AI_SUPPORTS_VISION: false,
  AI_TIMEOUT_MS: 10_000,
  TRIAGE_SHADOW_MODE: "off" as const,
};

function okResponse() {
  return new Response(
    JSON.stringify({
      model: "test-model",
      choices: [{ message: { content: '{"ok":true}' } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("checkAiHealth", () => {
  afterEach(() => {
    resetAiHealthCache();
    resetServerEnvCache();
    vi.restoreAllMocks();
  });

  it("returns down when AI env is missing", async () => {
    const result = await checkAiHealth({
      ...BASE_ENV,
      THIRD_PARTY_API_KEY: "",
    });

    expect(result.body.status).toBe("down");
    expect(result.body.latency_ms).toBe(0);
    expect(result.cacheHit).toBe(false);
  });

  it("returns up for a fast successful probe", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const result = await checkAiHealth(BASE_ENV, { fetchImpl, now: 1_000 });

    expect(result.body.status).toBe("up");
    expect(result.body.model).toBe("test-model");
    expect(result.body.checked_at).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns degraded for slow successful probes", async () => {
    const fetchImpl = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return okResponse();
    });

    const result = await checkAiHealth(BASE_ENV, {
      fetchImpl,
      now: 2_000,
    });

    expect(["up", "degraded"]).toContain(result.body.status);
    expect(result.body.model).toBe("test-model");
  });

  it("returns down when the provider responds with an error", async () => {
    const fetchImpl = vi.fn(async () => new Response("error", { status: 500 }));
    const result = await checkAiHealth(BASE_ENV, { fetchImpl, now: 3_000 });

    expect(result.body.status).toBe("down");
  });

  it("serves cached responses within the TTL", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const first = await checkAiHealth(BASE_ENV, { fetchImpl, now: 4_000 });
    const second = await checkAiHealth(BASE_ENV, { fetchImpl, now: 10_000 });

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(second.body).toEqual(first.body);
  });
});
