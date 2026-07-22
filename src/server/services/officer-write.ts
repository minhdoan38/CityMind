import "server-only";

import { HttpError, jsonErrorResponse } from "@/server/http/errors";
import { VALID_STATUSES, parseBbox, parseReportFilters, validateReportFilters } from "@/server/officer/filters";
import { requireOfficerContext } from "@/server/officer/guard";
import {
  buildCsvExport,
  buildXlsxExport,
} from "@/server/exports/reports";
import {
  getOfficerReport,
  updateReportStatus,
} from "@/server/repositories/reports";

function queryErrorResponse(message: string): Response {
  return Response.json({ detail: message }, { status: 502 });
}

export async function handleUpdateReportStatusRequest(
  request: Request,
  reportId: string,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const status = searchParams.get("status");
  const note = searchParams.get("note");

  if (!status || !VALID_STATUSES.has(status)) {
    return Response.json({ detail: "Invalid status" }, { status: 422 });
  }
  if (
    (status === "resolved" || status === "rejected") &&
    !(note ?? "").trim()
  ) {
    return Response.json(
      { detail: "Note is required for resolved/rejected" },
      { status: 422 },
    );
  }

  try {
    const report = await getOfficerReport(auth.context.client, reportId);
    if (!report) {
      return Response.json({ detail: "Report not found" }, { status: 404 });
    }

    const payload = await updateReportStatus(auth.context.client, {
      reportId,
      status,
      note: note ?? null,
      actorId: auth.context.session.userId,
    });

    return Response.json(payload);
  } catch (error) {
    if (error instanceof HttpError) return jsonErrorResponse(error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Note is required")) {
      return Response.json(
        { detail: "Note is required for resolved/rejected" },
        { status: 422 },
      );
    }
    if (message.includes("Report not found")) {
      return Response.json({ detail: "Report not found" }, { status: 404 });
    }
    return queryErrorResponse("Status update failed");
  }
}

export async function handleReportsExportRequest(request: Request): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const format = (searchParams.get("format") ?? "csv").toLowerCase();
  const filters = parseReportFilters(searchParams);
  const bbox = searchParams.get("bbox");

  if (format !== "csv" && format !== "xlsx") {
    return Response.json({ detail: "Invalid export format" }, { status: 422 });
  }

  try {
    validateReportFilters(filters);
    if (bbox) parseBbox(bbox);

    if (format === "csv") {
      const body = await buildCsvExport(auth.context.client, filters, { bbox });
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="reports.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }

    const body = await buildXlsxExport(auth.context.client, filters, { bbox });
    return new Response(Buffer.from(body), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="reports.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof HttpError) return jsonErrorResponse(error);
    return queryErrorResponse("Export failed");
  }
}
