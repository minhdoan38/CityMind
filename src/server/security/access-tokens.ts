import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type AccessTokenRow = {
  token_hash: string;
  report_id: string;
  expires_at: string;
};

/** SHA-256 hex digest — plaintext is never persisted. */
export function hashAccessToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function parseExpiresAt(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const text = String(value).replace("Z", "+00:00");
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function reportIdsMatch(boundId: string, reportId: string): boolean {
  const left = Buffer.from(boundId, "utf8");
  const right = Buffer.from(reportId, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/** True only when row exists, report_id matches (constant-time), and not expired. */
export function tokenBindsReport(
  row: AccessTokenRow | null | undefined,
  reportId: string,
  now: Date = new Date(),
): boolean {
  if (!row) return false;
  const boundId = row.report_id;
  if (typeof boundId !== "string" || !reportId) return false;
  if (!reportIdsMatch(boundId, reportId)) return false;

  const expiresAt = parseExpiresAt(row.expires_at);
  if (!expiresAt) return false;

  return expiresAt.getTime() > now.getTime();
}

const DEFAULT_TOKEN_TTL_DAYS = 365;

/** Issue a one-time plaintext token with SHA-256 hash and ISO expires_at (UTC). */
export function issueAccessToken(
  ttlDays = DEFAULT_TOKEN_TTL_DAYS,
  now: Date = new Date(),
): { plaintext: string; tokenHash: string; expiresAt: string } {
  const plaintext = randomBytes(32).toString("base64url");
  const tokenHash = hashAccessToken(plaintext);
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  return {
    plaintext,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
  };
}
