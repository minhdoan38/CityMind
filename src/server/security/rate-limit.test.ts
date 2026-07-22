import { afterEach, describe, expect, it } from "vitest";

import {
  clientIp,
  enforceReportRateLimit,
  enforceStatusRateLimit,
  loadRateLimitSettings,
  reportLimiter,
  resetRateLimiters,
  statusLimiter,
  type RateLimitRequest,
} from "./rate-limit";

function request(
  headers: Record<string, string> = {},
  clientAddress = "127.0.0.1",
): RateLimitRequest {
  return {
    headers: new Headers(headers),
    clientAddress,
  };
}

describe("clientIp", () => {
  it("uses the rightmost trusted XFF hop by default", () => {
    const settings = loadRateLimitSettings({ TRUSTED_PROXY_COUNT: "1" });
    const ip = clientIp(
      request({ "x-forwarded-for": "9.9.9.9, 203.0.113.10, 10.0.0.1" }),
      settings,
    );
    expect(ip).toBe("10.0.0.1");
    expect(ip).not.toBe("9.9.9.9");
  });

  it("peels additional hops when trusted_proxy_count is higher", () => {
    const settings = loadRateLimitSettings({ TRUSTED_PROXY_COUNT: "2" });
    const ip = clientIp(
      request({ "x-forwarded-for": "9.9.9.9, 203.0.113.10, 10.0.0.1, 10.0.0.2" }),
      settings,
    );
    expect(ip).toBe("10.0.0.1");
  });

  it("falls back to the socket address without XFF", () => {
    expect(clientIp(request({}, "192.0.2.44"))).toBe("192.0.2.44");
  });
});

describe("status rate limiter", () => {
  afterEach(() => {
    resetRateLimiters();
  });

  it("uses a separate status: keyspace and returns Retry-After 60", () => {
    const settings = {
      ...loadRateLimitSettings(),
      statusRateLimitPerMinute: 1,
      reportRateLimitPerMinute: 0,
    };
    const req = request({ "x-forwarded-for": "203.0.113.50" });

    expect(enforceStatusRateLimit(req, settings)).toBeNull();
    const blocked = enforceStatusRateLimit(req, settings);
    expect(blocked).toEqual({
      status: 429,
      detail: "Status lookup rate limit exceeded",
      retryAfter: "60",
    });
    expect(reportLimiter.allow("203.0.113.50", 1)).toBe(true);
  });

  it("keeps analyze and status limiters isolated", () => {
    const settings = {
      ...loadRateLimitSettings(),
      reportRateLimitPerMinute: 1,
      statusRateLimitPerMinute: 1,
    };
    const req = request({ "x-forwarded-for": "198.51.100.10" });

    expect(enforceReportRateLimit(req, settings)).toBeNull();
    expect(enforceStatusRateLimit(req, settings)).toBeNull();
    expect(enforceReportRateLimit(req, settings)?.status).toBe(429);
    expect(enforceStatusRateLimit(req, settings)?.status).toBe(429);
    expect(statusLimiter.allow("status:198.51.100.10", 1)).toBe(false);
  });
});
