import { timingSafeEqual } from "node:crypto";

export function verifyInternalTriageRequest(
  request: Request,
  env: { INTERNAL_TRIAGE_SECRET?: string },
): boolean {
  const expected = env.INTERNAL_TRIAGE_SECRET?.trim();
  if (!expected) {
    return false;
  }

  const provided = request.headers.get("x-citymind-internal-key") ?? "";
  if (!provided) {
    return false;
  }

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
