import "server-only";

import { HttpError, jsonErrorResponse } from "@/server/http/errors";
import { requireOfficerContext } from "@/server/officer/guard";
import {
  parseBbox,
  parseOptionalInt,
  parseReportFilters,
  SORT_COLUMNS,
  validateReportFilters,
  type SortColumn,
} from "@/server/officer/filters";
import {
  getOfficerEvidenceReference,
  getOfficerReport,
  getOfficerStatusHistory,
  getReportsSummary,
  listGeoPins,
  listRecentReports,
} from "@/server/repositories/reports";
import {
  downloadEvidenceLocation,
} from "@/server/services/evidence-service";

function queryErrorResponse(message: string, status = 502): Response {
  return Response.json({ detail: message }, { status });
}

export async function handleRecentReportsRequest(request: Request): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const limit = Number.parseInt(searchParams.get("limit") ?? "25", 10);
  const sort = (searchParams.get("sort") ?? "triage_bucket") as SortColumn;
  const order = (searchParams.get("order") ?? "asc") as "asc" | "desc";
  const cursor = searchParams.get("cursor");
  const filters = parseReportFilters(searchParams);

  if (limit < 1 || limit > 100) {
    return Response.json(
      { detail: "limit must be between 1 and 100" },
      { status: 422 },
    );
  }
  if (!(sort in SORT_COLUMNS)) {
    return Response.json({ detail: "Invalid sort" }, { status: 422 });
  }
  if (order !== "asc" && order !== "desc") {
    return Response.json({ detail: "Invalid order" }, { status: 422 });
  }

  try {
    validateReportFilters(filters);
    const { items, nextCursor } = await listRecentReports(auth.context.client, {
      limit,
      sort,
      order,
      cursor,
      filters,
    });
    return Response.json({
      items,
      count: items.length,
      next_cursor: nextCursor,
      sort,
      order,
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonErrorResponse(error);
    if (error instanceof Error && error.message.includes("Cursor")) {
      return Response.json({ detail: error.message }, { status: 422 });
    }
    return queryErrorResponse(`Database query failed: ${String(error)}`);
  }
}

export async function handleReportsSummaryRequest(request: Request): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const filters = parseReportFilters(searchParams);
  const bbox = searchParams.get("bbox");

  try {
    validateReportFilters(filters);
    if (bbox) parseBbox(bbox);
    const summary = await getReportsSummary(auth.context.client, filters, bbox);
    return Response.json(summary);
  } catch (error) {
    if (error instanceof HttpError) return jsonErrorResponse(error);
    return queryErrorResponse(`Database summary failed: ${String(error)}`);
  }
}

export async function handleGeoPinsRequest(request: Request): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const west = Number(searchParams.get("west"));
  const south = Number(searchParams.get("south"));
  const east = Number(searchParams.get("east"));
  const north = Number(searchParams.get("north"));
  const filters = parseReportFilters(searchParams);
  const filterBbox = searchParams.get("filter_bbox");

  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }
  if (west >= east || south >= north) {
    return Response.json(
      {
        detail:
          "Enter a valid bounding box (west < east; latitude between -90 and 90).",
      },
      { status: 422 },
    );
  }

  let filterWest: number | null = null;
  let filterSouth: number | null = null;
  let filterEast: number | null = null;
  let filterNorth: number | null = null;
  if (filterBbox) {
    try {
      [filterWest, filterSouth, filterEast, filterNorth] = parseBbox(filterBbox);
    } catch (error) {
      if (error instanceof HttpError) return jsonErrorResponse(error);
      return Response.json({ detail: "Invalid bbox" }, { status: 422 });
    }
  }

  try {
    validateReportFilters(filters);
    const { pins, unlocatedCount } = await listGeoPins(auth.context.client, {
      west,
      south,
      east,
      north,
      filterWest,
      filterSouth,
      filterEast,
      filterNorth,
      filters,
    });
    return Response.json(
      { pins, unlocated_count: unlocatedCount },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof HttpError) return jsonErrorResponse(error);
    return queryErrorResponse(`Geo pins query failed: ${String(error)}`);
  }
}

export async function handleReportDetailRequest(
  _request: Request,
  reportId: string,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  try {
    const report = await getOfficerReport(auth.context.client, reportId);
    if (!report) {
      return Response.json({ detail: "Report not found" }, { status: 404 });
    }
    return Response.json(report);
  } catch (error) {
    return queryErrorResponse(`Report query failed: ${String(error)}`);
  }
}

export async function handleStatusHistoryRequest(
  _request: Request,
  reportId: string,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  try {
    const report = await getOfficerReport(auth.context.client, reportId);
    if (!report) {
      return Response.json({ detail: "Report not found" }, { status: 404 });
    }
    const items = await getOfficerStatusHistory(auth.context.client, reportId);
    return Response.json({ items, count: items.length });
  } catch (error) {
    return queryErrorResponse(`Status history query failed: ${String(error)}`);
  }
}

export async function handleReportImageRequest(
  _request: Request,
  reportId: string,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  try {
    const reference = await getOfficerEvidenceReference(auth.context.client, reportId);
    if (!reference?.evidencePath) {
      return Response.json(
        { detail: "No image found for this report" },
        { status: 404 },
      );
    }

    const { bytes, mimeType } = await downloadEvidenceLocation({
      client: auth.context.client,
      evidencePath: reference.evidencePath,
    });
  return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unsupported evidence URI")) {
      return Response.json(
        { detail: "No image found for this report" },
        { status: 404 },
      );
    }
    return queryErrorResponse(`Image fetch failed: ${String(error)}`);
  }
}

export function parseRecentListOptions(searchParams: URLSearchParams) {
  const limit = Number.parseInt(searchParams.get("limit") ?? "25", 10);
  const sort = (searchParams.get("sort") ?? "triage_bucket") as SortColumn;
  const order = (searchParams.get("order") ?? "asc") as "asc" | "desc";
  const cursor = searchParams.get("cursor");
  const filters = parseReportFilters(searchParams);
  return { limit, sort, order, cursor, filters };
}

export { parseOptionalInt, parseReportFilters };
