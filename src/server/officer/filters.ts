import { HttpError } from "@/server/http/errors";

export const SORT_COLUMNS = {
  created_at: "created_at",
  priority: "priority",
  status: "current_status",
  category: "category",
  triage_bucket: "triage_bucket",
} as const;

export type SortColumn = keyof typeof SORT_COLUMNS;

export const VALID_STATUSES = new Set([
  "new",
  "reviewing",
  "resolved",
  "rejected",
]);

export const VALID_CATEGORIES = new Set([
  "pothole",
  "flooding",
  "waste",
  "streetlight",
  "graffiti",
  "obstruction",
  "other",
]);

export const VALID_PRIORITIES = new Set(["low", "medium", "high", "critical"]);

export const VALID_TRIAGE_STATUSES = new Set([
  "pending",
  "processing",
  "completed",
  "manual_review",
  "failed",
]);

export type ReportFilters = {
  status?: string | null;
  category?: string | null;
  priority?: string | null;
  triage_status?: string[] | null;
  min_severity?: number | null;
  max_severity?: number | null;
  created_after?: string | null;
  created_before?: string | null;
};

export function parseBbox(bbox: string): [number, number, number, number] {
  const parts = bbox.split(",").map((part) => part.trim());
  if (parts.length !== 4) {
    throw new HttpError(422, "bbox must be west,south,east,north");
  }
  const west = Number(parts[0]);
  const south = Number(parts[1]);
  const east = Number(parts[2]);
  const north = Number(parts[3]);
  if ([west, south, east, north].some((value) => !Number.isFinite(value))) {
    throw new HttpError(422, "bbox must be west,south,east,north");
  }
  if (west >= east || south >= north) {
    throw new HttpError(422, "Invalid bbox");
  }
  if (south < -90 || north > 90 || west < -180 || east > 180) {
    throw new HttpError(422, "Invalid bbox coordinates");
  }
  return [west, south, east, north];
}

export function coordsInBbox(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  west: number,
  south: number,
  east: number,
  north: number,
): boolean {
  if (latitude == null || longitude == null) return false;
  return south <= latitude && latitude <= north && west <= longitude && longitude <= east;
}

export function validateReportFilters(filters: ReportFilters): void {
  if (filters.status != null && !VALID_STATUSES.has(filters.status)) {
    throw new HttpError(422, "Invalid status filter");
  }
  if (filters.category != null && !VALID_CATEGORIES.has(filters.category)) {
    throw new HttpError(422, "Invalid category filter");
  }
  if (filters.priority != null && !VALID_PRIORITIES.has(filters.priority)) {
    throw new HttpError(422, "Invalid priority filter");
  }
  if (filters.triage_status?.length) {
    for (const status of filters.triage_status) {
      if (!VALID_TRIAGE_STATUSES.has(status)) {
        throw new HttpError(422, "Invalid triage_status filter");
      }
    }
  }
  if (
    filters.min_severity != null &&
    filters.max_severity != null &&
    filters.min_severity > filters.max_severity
  ) {
    throw new HttpError(422, "min_severity cannot exceed max_severity");
  }
}

export function parseOptionalInt(
  value: string | null,
  options: { min?: number; max?: number } = {},
): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (options.min != null && parsed < options.min) return null;
  if (options.max != null && parsed > options.max) return null;
  return parsed;
}

export function parseTriageStatusFilter(value: string | null): string[] | null {
  if (value == null || value.trim() === "") return null;
  const statuses = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return statuses.length ? statuses : null;
}

export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  const minSeverity = parseOptionalInt(searchParams.get("min_severity"), {
    min: 1,
    max: 5,
  });
  const maxSeverity = parseOptionalInt(searchParams.get("max_severity"), {
    min: 1,
    max: 5,
  });
  return {
    status: searchParams.get("status"),
    category: searchParams.get("category"),
    priority: searchParams.get("priority"),
    triage_status: parseTriageStatusFilter(searchParams.get("triage_status")),
    min_severity: minSeverity,
    max_severity: maxSeverity,
    created_after: searchParams.get("created_after"),
    created_before: searchParams.get("created_before"),
  };
}
