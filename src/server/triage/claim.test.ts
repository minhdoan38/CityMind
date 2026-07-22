import { describe, expect, it, vi } from "vitest";

import { claimNextTriageReport, reclaimStuckTriageReports } from "./claim";

function createClient(queryResults: unknown[] = []) {
  const query = vi.fn();
  for (const result of queryResults) {
    query.mockResolvedValueOnce(result);
  }
  return { query } as never;
}

describe("claimNextTriageReport", () => {
  it("returns report_id when claim RPC returns a row", async () => {
    const client = createClient([{ rows: [{ report_id: "rep-42" }] }]);
    const claimed = await claimNextTriageReport(client);
    expect(claimed).toEqual({ report_id: "rep-42" });
    expect(client.query).toHaveBeenCalledWith(
      "SELECT report_id FROM public.claim_triage_report() LIMIT 1",
    );
  });

  it("returns null when claim RPC returns no rows", async () => {
    const client = createClient([{ rows: [] }]);
    const claimed = await claimNextTriageReport(client);
    expect(claimed).toBeNull();
  });
});

describe("reclaimStuckTriageReports", () => {
  it("calls reclaim RPC with parameterized interval", async () => {
    const client = createClient([{ rows: [{ reclaimed: 2 }] }]);
    const count = await reclaimStuckTriageReports(client, "15 minutes");
    expect(count).toBe(2);
    expect(client.query).toHaveBeenCalledWith(
      "SELECT public.reclaim_stuck_triage_reports($1::interval) AS reclaimed",
      ["15 minutes"],
    );
  });
});
