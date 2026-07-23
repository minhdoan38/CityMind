import { describe, expect, it, vi } from "vitest";

import { listTriageConsoleCases } from "./triage-console";

describe("listTriageConsoleCases", () => {
  it("groups runs and attempts by report case", async () => {
    const runs = [
      {
        run_id: "run-1",
        report_id: "case-a",
        started_at: "2026-07-22T10:00:00Z",
        finished_at: "2026-07-22T10:00:05Z",
        final_disposition: "completed",
        prompt_version: "1.0.0",
      },
      {
        run_id: "run-2",
        report_id: "case-b",
        started_at: "2026-07-22T09:00:00Z",
        finished_at: null,
        final_disposition: null,
        prompt_version: "1.0.0",
      },
    ];

    const attempts = [
      {
        attempt_id: "att-1",
        run_id: "run-1",
        attempt_number: 1,
        model: "test-model",
        prompt_version: "1.0.0",
        raw_output: '{"category":"waste"}',
        latency_ms: 42,
        validation_errors: [],
        disposition: "completed",
        created_at: "2026-07-22T10:00:04Z",
      },
    ];

    const reports = [
      {
        report_id: "case-a",
        description: "Overflowing bin",
        triage_status: "completed",
        category: "waste",
      },
      {
        report_id: "case-b",
        description: "Broken light",
        triage_status: "processing",
        category: null,
      },
    ];

    const client = {
      from: vi.fn((table: string) => {
        if (table === "triage_runs") {
          const chain = {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: runs, error: null }),
            eq: vi.fn().mockReturnThis(),
          };
          return chain;
        }
        if (table === "triage_attempts") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: attempts, error: null }),
          };
        }
        if (table === "reports") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: reports, error: null }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const cases = await listTriageConsoleCases(client as never);

    expect(cases).toHaveLength(2);
    expect(cases[0]?.report_id).toBe("case-a");
    expect(cases[0]?.runs[0]?.attempts).toHaveLength(1);
    expect(cases[1]?.report_id).toBe("case-b");
    expect(cases[1]?.runs[0]?.attempts).toEqual([]);
  });

  it("returns empty array when no triage runs exist", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnThis(),
      })),
    };

    const cases = await listTriageConsoleCases(client as never);
    expect(cases).toEqual([]);
  });

  it("applies report_id filter and 50-run limit", async () => {
    const limit = vi.fn();
    const eq = vi.fn();
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
      eq,
      then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    };
    limit.mockReturnValue(chain);
    eq.mockReturnValue(chain);

    const client = {
      from: vi.fn((table: string) => {
        if (table === "triage_runs") return chain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await listTriageConsoleCases(client as never, { reportId: "case-filtered" });

    expect(eq).toHaveBeenCalledWith("report_id", "case-filtered");
    expect(limit).toHaveBeenCalledWith(50);
  });
});
