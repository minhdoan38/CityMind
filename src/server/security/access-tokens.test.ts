import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  hashAccessToken,
  tokenBindsReport,
  type AccessTokenRow,
} from "./access-tokens";

function futureIso(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso(days = 1): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function tokenRow(overrides: Partial<AccessTokenRow> = {}): AccessTokenRow {
  return {
    token_hash: "abc123",
    report_id: "rep-citizen-1",
    expires_at: futureIso(),
    ...overrides,
  };
}

describe("hashAccessToken", () => {
  it("uses SHA-256 hex and never stores plaintext semantics", () => {
    const plaintext = randomBytes(24).toString("base64url");
    const digest = hashAccessToken(plaintext);
    expect(digest).toBe(createHash("sha256").update(plaintext, "utf8").digest("hex"));
    expect(digest).not.toBe(plaintext);
  });
});

describe("tokenBindsReport", () => {
  it("accepts a matching unexpired row", () => {
    const row = tokenRow({ report_id: "rep-1" });
    expect(tokenBindsReport(row, "rep-1")).toBe(true);
  });

  it("rejects missing rows", () => {
    expect(tokenBindsReport(null, "rep-1")).toBe(false);
  });

  it("rejects expired tokens", () => {
    const row = tokenRow({ expires_at: pastIso() });
    expect(tokenBindsReport(row, "rep-citizen-1")).toBe(false);
  });

  it("rejects cross-report binding without leaking which check failed", () => {
    const row = tokenRow({ report_id: "other-report" });
    expect(tokenBindsReport(row, "rep-citizen-1")).toBe(false);
  });

  it("treats wrong, expired, and mismatched rows uniformly as false", () => {
    const reportId = "rep-citizen-2";
    const outcomes = [
      tokenBindsReport(null, reportId),
      tokenBindsReport(tokenRow({ expires_at: pastIso() }), reportId),
      tokenBindsReport(tokenRow({ report_id: "other-report" }), reportId),
    ];
    expect(outcomes).toEqual([false, false, false]);
    expect(new Set(outcomes).size).toBe(1);
  });
});
