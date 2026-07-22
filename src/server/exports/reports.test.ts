import { describe, expect, it } from "vitest";

import {
  EXPORT_FIELDS,
  mapReportToExportRow,
  neutralizeSpreadsheetValue,
} from "./reports";

describe("neutralizeSpreadsheetValue", () => {
  it("prefixes formula-leading values", () => {
    expect(neutralizeSpreadsheetValue("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(neutralizeSpreadsheetValue("+1234")).toBe("'+1234");
    expect(neutralizeSpreadsheetValue("-alert")).toBe("'-alert");
    expect(neutralizeSpreadsheetValue("@cmd")).toBe("'@cmd");
  });

  it("leaves safe text unchanged", () => {
    expect(neutralizeSpreadsheetValue("Pothole near school")).toBe(
      "Pothole near school",
    );
  });
});

describe("mapReportToExportRow", () => {
  it("neutralizes citizen-controlled summary and recommendation fields", () => {
    const row = mapReportToExportRow({
      report_id: "rep-1",
      created_at: "2026-07-21T10:00:00.000Z",
      category: "pothole",
      priority: "high",
      status: "new",
      summary: "=HYPERLINK(\"evil\")",
      recommendation: "+cmd",
      severity: 4,
      status_note: "@note",
    });

    expect(row.summary).toBe("'=HYPERLINK(\"evil\")");
    expect(row.recommendation).toBe("'+cmd");
    expect(row.status_note).toBe("'@note");
    expect(EXPORT_FIELDS).toContain("report_id");
  });
});
