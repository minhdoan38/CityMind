import "server-only";

import { probeChatCompletion } from "@/server/ai/openai-compatible";
import type { ServerEnv } from "@/server/config/env";
import { getServerEnv } from "@/server/config/env";

export type AiHealthStatus = "up" | "degraded" | "down";

export type AiHealthResponse = {
  status: AiHealthStatus;
  model: string;
  latency_ms: number;
  checked_at: string;
};

export type AiHealthResult = {
  body: AiHealthResponse;
  cacheHit: boolean;
};

const AI_HEALTH_TTL_MS = 45_000;

let cache: { at: number; body: AiHealthResponse } | null = null;

export function resetAiHealthCache(): void {
  cache = null;
}

function hasAiEnv(env: ServerEnv): boolean {
  return Boolean(
    env.AI_BASE_URL?.trim() &&
      env.AI_MODEL?.trim() &&
      env.THIRD_PARTY_API_KEY?.trim(),
  );
}

function classifyStatus(latencyMs: number, ok: boolean): AiHealthStatus {
  if (!ok) {
    return "down";
  }
  if (latencyMs < 5_000) {
    return "up";
  }
  if (latencyMs <= 15_000) {
    return "degraded";
  }
  return "down";
}

export async function checkAiHealth(
  env: ServerEnv = getServerEnv(),
  options: {
    now?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<AiHealthResult> {
  const now = options.now ?? Date.now();
  if (cache && now - cache.at < AI_HEALTH_TTL_MS) {
    return { body: cache.body, cacheHit: true };
  }

  const checkedAt = new Date(now).toISOString();
  if (!hasAiEnv(env)) {
    const body: AiHealthResponse = {
      status: "down",
      model: env.AI_MODEL ?? "unknown",
      latency_ms: 0,
      checked_at: checkedAt,
    };
    cache = { at: now, body };
    return { body, cacheHit: false };
  }

  const probe = await probeChatCompletion({
    env,
    fetchImpl: options.fetchImpl,
  });
  const body: AiHealthResponse = {
    status: classifyStatus(probe.latencyMs, probe.ok),
    model: probe.model,
    latency_ms: probe.latencyMs,
    checked_at: checkedAt,
  };
  cache = { at: now, body };
  return { body, cacheHit: false };
}
