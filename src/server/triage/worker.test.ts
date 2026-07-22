import { afterEach, describe, expect, it, vi } from "vitest";

import { workerTick } from "./worker";

function createQueryMock(options: { claimRow?: { report_id: string } | null } = {}) {
  return vi.fn(async (sql: string) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [] };
    }
    if (sql.includes("reclaim_stuck_triage_reports")) {
      return { rows: [{ reclaimed: 1 }] };
    }
    if (sql.includes("claim_triage_report")) {
      return { rows: options.claimRow ? [options.claimRow] : [] };
    }
    return { rows: [] };
  });
}

describe("workerTick", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reclaims before claim and runs triage after commit", async () => {
    const callOrder: string[] = [];
    const query = createQueryMock({ claimRow: { report_id: "report-42" } });
    query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN") callOrder.push("begin");
      if (sql.includes("reclaim_stuck_triage_reports")) callOrder.push("reclaim");
      if (sql.includes("claim_triage_report")) callOrder.push("claim");
      if (sql === "COMMIT") callOrder.push("commit");
      return createQueryMock({ claimRow: { report_id: "report-42" } })(sql);
    });

    const client = { query };
    const runTriage = vi.fn(async () => {
      callOrder.push("runTriage");
      return { reportId: "report-42", disposition: "completed" };
    });

    const reportId = await workerTick(client as never, { runTriage });

    expect(reportId).toBe("report-42");
    expect(callOrder).toEqual(["begin", "reclaim", "claim", "commit", "runTriage"]);
    expect(runTriage).toHaveBeenCalledWith("report-42");
  });

  it("skips triage when no report is claimed", async () => {
    const client = { query: createQueryMock({ claimRow: null }) };
    const runTriage = vi.fn();

    const reportId = await workerTick(client as never, { runTriage });

    expect(reportId).toBeNull();
    expect(runTriage).not.toHaveBeenCalled();
  });
});
