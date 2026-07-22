import { afterEach, describe, expect, it, vi } from "vitest";

import { claimNextTriageReport, reclaimStuckTriageReports } from "./claim";

describe("claim wrappers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls reclaim RPC with parameterized interval", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ reclaimed: 2 }] });
    const client = { query } as never;

    const reclaimed = await reclaimStuckTriageReports(client, "15 minutes");

    expect(reclaimed).toBe(2);
    expect(query).toHaveBeenCalledWith(
      "SELECT public.reclaim_stuck_triage_reports($1::interval) AS reclaimed",
      ["15 minutes"],
    );
  });

  it("returns claimed report_id from claim RPC", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ report_id: "report-123" }],
    });
    const client = { query } as never;

    const claimed = await claimNextTriageReport(client);

    expect(claimed).toEqual({ report_id: "report-123" });
    expect(query).toHaveBeenCalledWith("SELECT * FROM public.claim_triage_report()");
  });

  it("returns null when claim RPC is empty", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query } as never;

    const claimed = await claimNextTriageReport(client);
    expect(claimed).toBeNull();
  });
});
