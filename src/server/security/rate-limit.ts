export type RateLimitRequest = {
  headers: Headers;
  clientAddress?: string | null;
};

export type RateLimitSettings = {
  reportRateLimitPerMinute: number;
  statusRateLimitPerMinute: number;
  publicStatsRateLimitPerMinute: number;
  trustedProxyCount: number;
};

const WINDOW_MS = 60_000;
const RETRY_AFTER_SECONDS = "60";

export function loadRateLimitSettings(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitSettings {
  return {
    reportRateLimitPerMinute: parseLimit(env.REPORT_RATE_LIMIT_PER_MINUTE),
    statusRateLimitPerMinute: parseLimit(env.STATUS_RATE_LIMIT_PER_MINUTE),
    publicStatsRateLimitPerMinute: parseLimit(env.PUBLIC_STATS_RATE_LIMIT_PER_MINUTE),
    trustedProxyCount: parseTrustedProxyCount(env.TRUSTED_PROXY_COUNT),
  };
}

function parseLimit(value: string | undefined): number {
  const parsed = Number(value ?? "0");
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function parseTrustedProxyCount(value: string | undefined): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export class SlidingWindowLimiter {
  private readonly events = new Map<string, number[]>();

  allow(key: string, limit: number, now = Date.now()): boolean {
    if (limit <= 0) return true;
    const cutoff = now - WINDOW_MS;
    const bucket = this.events.get(key) ?? [];
    while (bucket.length > 0 && bucket[0] <= cutoff) {
      bucket.shift();
    }
    if (bucket.length >= limit) {
      this.events.set(key, bucket);
      return false;
    }
    bucket.push(now);
    this.events.set(key, bucket);
    return true;
  }

  clear(): void {
    this.events.clear();
  }
}

export const reportLimiter = new SlidingWindowLimiter();
export const statusLimiter = new SlidingWindowLimiter();
export const publicStatsLimiter = new SlidingWindowLimiter();
export const coachLimiter = new SlidingWindowLimiter();
export const intakeLimiter = new SlidingWindowLimiter();

export function resetRateLimiters(): void {
  reportLimiter.clear();
  statusLimiter.clear();
  publicStatsLimiter.clear();
  coachLimiter.clear();
  intakeLimiter.clear();
}

/** Trusted client hop for rate limiting (rightmost platform hop by default). */
export function clientIp(
  request: RateLimitRequest,
  settings: Pick<RateLimitSettings, "trustedProxyCount"> = loadRateLimitSettings(),
): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      const count = settings.trustedProxyCount < 1 ? 1 : settings.trustedProxyCount;
      if (count >= hops.length) {
        return hops[0];
      }
      return hops[hops.length - count];
    }
  }
  return request.clientAddress?.trim() || "unknown";
}

export type RateLimitViolation = {
  status: 429;
  detail: string;
  retryAfter: string;
};

export function enforceReportRateLimit(
  request: RateLimitRequest,
  settings: RateLimitSettings = loadRateLimitSettings(),
): RateLimitViolation | null {
  const limit = settings.reportRateLimitPerMinute;
  const key = clientIp(request, settings);
  if (!reportLimiter.allow(key, limit)) {
    return {
      status: 429,
      detail: "Report submission rate limit exceeded",
      retryAfter: RETRY_AFTER_SECONDS,
    };
  }
  return null;
}

export function enforceStatusRateLimit(
  request: RateLimitRequest,
  settings: RateLimitSettings = loadRateLimitSettings(),
): RateLimitViolation | null {
  const limit = settings.statusRateLimitPerMinute;
  const key = `status:${clientIp(request, settings)}`;
  if (!statusLimiter.allow(key, limit)) {
    return {
      status: 429,
      detail: "Status lookup rate limit exceeded",
      retryAfter: RETRY_AFTER_SECONDS,
    };
  }
  return null;
}

export function enforcePublicStatsRateLimit(
  request: RateLimitRequest,
  settings: RateLimitSettings = loadRateLimitSettings(),
): RateLimitViolation | null {
  const limit = settings.publicStatsRateLimitPerMinute;
  const key = `stats:${clientIp(request, settings)}`;
  if (!publicStatsLimiter.allow(key, limit)) {
    return {
      status: 429,
      detail: "Public stats rate limit exceeded",
      retryAfter: RETRY_AFTER_SECONDS,
    };
  }
  return null;
}

const COACH_RATE_LIMIT_PER_MINUTE = 10;

export function enforceCoachRateLimit(
  request: RateLimitRequest,
  reportId: string,
): RateLimitViolation | null {
  const ip = clientIp(request);
  const key = `coach:${reportId}:${ip}`;
  if (!coachLimiter.allow(key, COACH_RATE_LIMIT_PER_MINUTE)) {
    return {
      status: 429,
      detail: "Coach message rate limit exceeded",
      retryAfter: RETRY_AFTER_SECONDS,
    };
  }
  return null;
}

const INTAKE_RATE_LIMIT_PER_MINUTE = 10;

export function enforceIntakeRateLimit(
  request: RateLimitRequest,
  reportId: string,
): RateLimitViolation | null {
  const ip = clientIp(request);
  const key = `intake:${reportId}:${ip}`;
  if (!intakeLimiter.allow(key, INTAKE_RATE_LIMIT_PER_MINUTE)) {
    return {
      status: 429,
      detail: "Intake message rate limit exceeded",
      retryAfter: RETRY_AFTER_SECONDS,
    };
  }
  return null;
}
