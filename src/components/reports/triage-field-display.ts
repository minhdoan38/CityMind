export type TriageFieldPlaceholderKey =
  | "pending"
  | "processing"
  | "failed"
  | "manualReview"
  | "empty";

export function triageFieldPlaceholderKey(
  triageStatus: string,
  value: string,
): TriageFieldPlaceholderKey | null {
  const trimmed = value.trim();
  if (triageStatus === "completed") {
    return trimmed ? null : "empty";
  }
  if (triageStatus === "processing") return "processing";
  if (triageStatus === "failed") return "failed";
  if (triageStatus === "manual_review") return "manualReview";
  return "pending";
}

export function formatReportIdForList(id: string): { display: string; full: string } {
  const full = id.trim();
  if (full.length <= 20) return { display: full, full };
  return { display: `${full.slice(0, 10)}…${full.slice(-8)}`, full };
}

/** Tail-only ID for dense table secondary lines — avoids double ellipsis with CSS truncate. */
export function formatReportIdTail(id: string): { display: string; full: string } {
  const full = id.trim();
  if (full.length <= 12) return { display: full, full };
  return { display: `…${full.slice(-8)}`, full };
}

export function formatCategoryLabel(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export type BulkSkipReason =
  | "already_completed"
  | "ineligible_status"
  | "not_found"
  | "lookup_failed"
  | "reset_failed"
  | "not_found_dispatch"
  | "skipped"
  | "other";

export function normalizeBulkSkipReason(reason: string): BulkSkipReason {
  switch (reason) {
    case "already_completed":
    case "ineligible_status":
    case "not_found":
    case "lookup_failed":
    case "reset_failed":
      return reason;
    default:
      if (reason === "skipped" || reason.startsWith("skip")) return "skipped";
      return "other";
  }
}

export type BulkTriageResult = {
  accepted: string[];
  skipped: Array<{ id: string; reason: string }>;
};

export function parseBulkTriageResult(payload: unknown): BulkTriageResult {
  if (!payload || typeof payload !== "object") {
    return { accepted: [], skipped: [] };
  }
  const record = payload as Record<string, unknown>;
  const accepted = Array.isArray(record.accepted)
    ? record.accepted.filter((id): id is string => typeof id === "string")
    : [];
  const skipped = Array.isArray(record.skipped)
    ? record.skipped
        .filter(
          (item): item is { id: string; reason: string } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { reason?: unknown }).reason === "string",
        )
        .map((item) => ({ id: item.id, reason: item.reason }))
    : [];
  return { accepted, skipped };
}

export async function readTriageErrorDetail(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail.trim();
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}
