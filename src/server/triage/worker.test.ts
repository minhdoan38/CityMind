import { describe, expect, it, vi } from "vitest";

import { runWorkerTick } from "./worker";

function createPool(client: { query: ReturnType<typeof vi.fn> }) {
  return {
    connect: vi.fn(async () => client),
  } as never;
}

describe("runWorkerTick", () => {
  it("reclaims before claim and runs triage after commit", async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN") calls.push("begin");
      if (sql.includes("reclaim_stuck_triage_reports")) {
        calls.push("reclaim");
        return { rows: [{ reclaimed: 0 }] };
      }
      if (sql.includes("claim_triage_report")) {
        calls.push("claim");
        return { rows: [{ report_id: "rep-9" }] };
      }
      if (sql === "COMMIT") calls.push("commit");
      return { rows: [] };
    });
    const release = vi.fn();
    const pool = createPool({ query, release } as never);
    const runTriage = vi.fn(async () => {
      calls.push("triage");
    });

    await runWorkerTick(pool, { runTriage });

    expect(calls).toEqual(["begin", "reclaim", "claim", "commit", "triage"]);
    expect(runTriage).toHaveBeenCalledWith("rep-9");
    expect(release).toHaveBeenCalled();
  });

  it("skips triage when claim returns no row", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("reclaim_stuck_triage_reports")) return { rows: [{ reclaimed: 0 }] };
      if (sql.includes("claim_triage_report")) return { rows: [] };
      return { rows: [] };
    });
    const pool = createPool({ query, release: vi.fn() } as never);
    const runTriage = vi.fn();

    await runWorkerTick(pool, { runTriage });

    expect(runTriage).not.toHaveBeenCalled();
  });
});
