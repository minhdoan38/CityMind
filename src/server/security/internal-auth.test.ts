import { describe, expect, it } from "vitest";

import { verifyInternalTriageRequest } from "./internal-auth";

const SECRET = "a".repeat(32);

function requestWithKey(key: string | null): Request {
  const headers = new Headers();
  if (key !== null) {
    headers.set("x-citymind-internal-key", key);
  }
  return new Request("http://localhost/api/internal/triage/report-1", {
    method: "POST",
    headers,
  });
}

describe("verifyInternalTriageRequest", () => {
  it("accepts a matching secret with timing-safe compare", () => {
    expect(
      verifyInternalTriageRequest(requestWithKey(SECRET), {
        INTERNAL_TRIAGE_SECRET: SECRET,
      }),
    ).toBe(true);
  });

  it("rejects missing secret configuration", () => {
    expect(verifyInternalTriageRequest(requestWithKey(SECRET), {})).toBe(false);
  });

  it("rejects missing header", () => {
    expect(
      verifyInternalTriageRequest(requestWithKey(null), {
        INTERNAL_TRIAGE_SECRET: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects wrong secret length without throwing", () => {
    expect(
      verifyInternalTriageRequest(requestWithKey("short"), {
        INTERNAL_TRIAGE_SECRET: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects incorrect secret value", () => {
    expect(
      verifyInternalTriageRequest(requestWithKey("b".repeat(32)), {
        INTERNAL_TRIAGE_SECRET: SECRET,
      }),
    ).toBe(false);
  });
});
