import { decodeCursor, encodeCursor } from "@/server/officer/cursor";

const TRIAGE_BUCKET_SORT = "triage_bucket";

/** Legacy placeholder cursor from an earlier implementation. */
const LEGACY_TRIAGE_MORE = "triage_bucket:more";

export function parseTriageBucketOffset(
  cursor: string | null | undefined,
): number {
  const trimmed = cursor?.trim();
  if (!trimmed || trimmed === LEGACY_TRIAGE_MORE) return 0;
  try {
    const [sort, , value] = decodeCursor(trimmed);
    if (sort !== TRIAGE_BUCKET_SORT) return 0;
    const offset = Number.parseInt(value, 10);
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

export function encodeTriageBucketCursor(
  offset: number,
  order: string,
  anchorReportId: string,
): string {
  return encodeCursor(
    TRIAGE_BUCKET_SORT,
    order,
    String(Math.max(0, offset)),
    anchorReportId,
  );
}
