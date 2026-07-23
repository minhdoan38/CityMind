import "server-only";

import { pingClamav, isClamavEnabled } from "@/server/services/clamav-client";

export type ClamavHealthStatus = "up" | "down";

export type ClamavHealthResponse = {
  status: ClamavHealthStatus;
  latency_ms: number;
  checked_at: string;
  reason?: string;
};

export type ClamavHealthResult = {
  body: ClamavHealthResponse;
  cacheHit: boolean;
};

const CLAMAV_HEALTH_TTL_MS = 45_000;

let cache: { at: number; body: ClamavHealthResponse } | null = null;

export function resetClamavHealthCache(): void {
  cache = null;
}

export async function checkClamavHealth(
  options: { now?: number } = {},
): Promise<ClamavHealthResult> {
  const now = options.now ?? Date.now();
  if (cache && now - cache.at < CLAMAV_HEALTH_TTL_MS) {
    return { body: cache.body, cacheHit: true };
  }

  const checkedAt = new Date(now).toISOString();

  if (!isClamavEnabled()) {
    const body: ClamavHealthResponse = {
      status: "down",
      latency_ms: 0,
      checked_at: checkedAt,
      reason: "disabled",
    };
    cache = { at: now, body };
    return { body, cacheHit: false };
  }

  const started = Date.now();
  try {
    await pingClamav();
    const body: ClamavHealthResponse = {
      status: "up",
      latency_ms: Date.now() - started,
      checked_at: checkedAt,
    };
    cache = { at: now, body };
    return { body, cacheHit: false };
  } catch {
    const body: ClamavHealthResponse = {
      status: "down",
      latency_ms: Date.now() - started,
      checked_at: checkedAt,
      reason: "unreachable",
    };
    cache = { at: now, body };
    return { body, cacheHit: false };
  }
}
