import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

import type { ReportFilters } from "@/server/officer/filters";
import {
  listRecentReports,
  type OfficerReport,
} from "@/server/repositories/reports";

export const EXPORT_SOFT_ROW_CAP = 10_000;

export const EXPORT_FIELDS = [
  "report_id",
  "created_at",
  "category",
  "priority",
  "status",
  "summary",
  "severity",
  "recommendation",
  "status_note",
] as const;

export type ExportField = (typeof EXPORT_FIELDS)[number];
export type ExportRow = Record<ExportField, string | number | null>;

const FORMULA_PREFIX = /^[=+\-@]/;

export function neutralizeSpreadsheetValue(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (!text) return "";
  if (FORMULA_PREFIX.test(text)) {
    return `'${text}`;
  }
  return text;
}

export function mapReportToExportRow(report: OfficerReport): ExportRow {
  return {
    report_id: report.report_id,
    created_at: report.created_at,
    category: report.category ?? "",
    priority: report.priority ?? "",
    status: report.status,
    summary: neutralizeSpreadsheetValue(report.summary),
    severity: report.severity ?? null,
    recommendation: neutralizeSpreadsheetValue(report.recommendation),
    status_note: neutralizeSpreadsheetValue(report.status_note),
  };
}

function escapeCsvCell(value: unknown): string {
  const text = neutralizeSpreadsheetValue(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export async function* iterateExportRows(
  client: SupabaseClient,
  filters: ReportFilters,
  options: { softCap?: number; bbox?: string | null } = {},
): AsyncGenerator<ExportRow> {
  const softCap = options.softCap ?? EXPORT_SOFT_ROW_CAP;
  let cursor: string | null = null;
  let yielded = 0;

  while (yielded < softCap) {
    const batchLimit = Math.min(100, softCap - yielded);
    const { items, nextCursor } = await listRecentReports(client, {
      limit: batchLimit,
      sort: "created_at",
      order: "desc",
      cursor,
      filters,
    });

    if (!items.length) break;

    for (const item of items) {
      if (options.bbox) {
        const parts = options.bbox.split(",").map((part) => Number(part.trim()));
        if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
          const [west, south, east, north] = parts;
          const lat = item.latitude;
          const lng = item.longitude;
          if (
            lat == null ||
            lng == null ||
            lat < south ||
            lat > north ||
            lng < west ||
            lng > east
          ) {
            continue;
          }
        }
      }

      yield mapReportToExportRow(item);
      yielded += 1;
      if (yielded >= softCap) return;
    }

    if (!nextCursor) break;
    cursor = nextCursor;
  }
}

export async function buildCsvExport(
  client: SupabaseClient,
  filters: ReportFilters,
  options: { softCap?: number; bbox?: string | null } = {},
): Promise<string> {
  const lines = [EXPORT_FIELDS.join(",")];
  for await (const row of iterateExportRows(client, filters, options)) {
    lines.push(
      EXPORT_FIELDS.map((field) => escapeCsvCell(row[field])).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function buildXlsxExport(
  client: SupabaseClient,
  filters: ReportFilters,
  options: { softCap?: number; bbox?: string | null } = {},
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("reports");
  worksheet.addRow([...EXPORT_FIELDS]);

  for await (const row of iterateExportRows(client, filters, options)) {
    worksheet.addRow(
      EXPORT_FIELDS.map((field) => neutralizeSpreadsheetValue(row[field])),
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}
