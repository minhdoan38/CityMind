import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/server/http/errors";

import { decodeCursor, encodeCursor } from "@/server/officer/cursor";
import {
  parseReportFilters,
  validateReportFilters,
} from "@/server/officer/filters";
import {
  getOfficerReport,
  listRecentReports,
  mapOfficerReportRow,
  updateReportStatus,
} from "@/server/repositories/reports";

describe("officer cursor helpers", () => {
  it("round-trips sort/order/value/report_id", () => {
    const encoded = encodeCursor(
      "created_at",
      "desc",
      "2026-07-21T10:00:00.000Z",
      "rep-123",
    );
    expect(decodeCursor(encoded)).toEqual([
      "created_at",
      "desc",
      "2026-07-21T10:00:00.000Z",
      "rep-123",
    ]);
  });
});

describe("officer filter validation", () => {
  it("rejects invalid status filters", () => {
    expect(() => validateReportFilters({ status: "archived" })).toThrow(HttpError);
  });

  it("parses severity filters from query params", () => {
    const params = new URLSearchParams({
      status: "new",
      min_severity: "3",
      max_severity: "5",
    });
    expect(parseReportFilters(params)).toEqual({
      status: "new",
      category: null,
      priority: null,
      triage_status: null,
      routing_destination: "government_default",
      shadow_disagreement: false,
      min_severity: 3,
      max_severity: 5,
      created_after: null,
      created_before: null,
    });
  });

  it("parses triage_status comma list from URL", () => {
    const params = new URLSearchParams({
      triage_status: "pending,processing",
    });
    expect(parseReportFilters(params)).toEqual({
      status: null,
      category: null,
      priority: null,
      triage_status: ["pending", "processing"],
      routing_destination: "government_default",
      shadow_disagreement: false,
      min_severity: null,
      max_severity: null,
      created_after: null,
      created_before: null,
    });
  });
});

describe("officer report mapping", () => {
  it("maps current_status and latest status note", () => {
    const mapped = mapOfficerReportRow({
      report_id: "rep-1",
      created_at: "2026-07-21T10:00:00.000Z",
      current_status: "reviewing",
      summary: "Summary",
      status_events: [
        { status: "new", note: null, created_at: "2026-07-21T09:00:00.000Z" },
        {
          status: "reviewing",
          note: "Assigned",
          created_at: "2026-07-21T10:00:00.000Z",
        },
      ],
    });
    expect(mapped.status).toBe("reviewing");
    expect(mapped.status_note).toBe("Assigned");
  });
});

describe("listRecentReports", () => {
  it("queries reports through injected client", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      or: vi.fn(),
      limit: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.lte.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.limit.mockResolvedValue({
      data: [
        {
          report_id: "rep-1",
          created_at: "2026-07-21T10:00:00.000Z",
          current_status: "new",
          triage_status: "completed",
          summary: "Test",
          status_events: [],
        },
      ],
      error: null,
    });
    const client = { from: vi.fn(() => chain) };

    const { items } = await listRecentReports(client as never, {
      limit: 25,
      sort: "created_at",
      order: "desc",
      filters: {},
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.report_id).toBe("rep-1");
    expect(client.from).toHaveBeenCalledWith("reports");
  });

  it("applies default government routing filter including NULL destinations", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      or: vi.fn(),
      limit: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.lte.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.limit.mockResolvedValue({ data: [], error: null });
    const client = { from: vi.fn(() => chain) };

    await listRecentReports(client as never, {
      limit: 25,
      sort: "created_at",
      order: "desc",
      filters: { routing_destination: "government_default" },
    });

    expect(chain.or).toHaveBeenCalledWith(
      "routing_destination.is.null,routing_destination.eq.government",
    );
  });

  it("returns manual_review before pending when sort is triage_bucket", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      or: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.lte.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.order.mockResolvedValue({
      data: [
        {
          report_id: "rep-pending",
          created_at: "2026-07-21T09:00:00.000Z",
          current_status: "new",
          triage_status: "pending",
          status_events: [],
        },
        {
          report_id: "rep-manual",
          created_at: "2026-07-21T11:00:00.000Z",
          current_status: "new",
          triage_status: "manual_review",
          status_events: [],
        },
        {
          report_id: "rep-complete",
          created_at: "2026-07-21T12:00:00.000Z",
          current_status: "resolved",
          triage_status: "completed",
          status_events: [],
        },
      ],
      error: null,
    });
    const client = { from: vi.fn(() => chain) };

    const { items } = await listRecentReports(client as never, {
      limit: 25,
      sort: "triage_bucket",
      order: "asc",
      filters: {},
    });

    expect(items.map((item) => item.report_id)).toEqual([
      "rep-manual",
      "rep-pending",
      "rep-complete",
    ]);
  });

  it("applies default government routing filter with OR clause", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      or: vi.fn(),
      limit: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.lte.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.limit.mockResolvedValue({ data: [], error: null });
    const client = { from: vi.fn(() => chain) };

    await listRecentReports(client as never, {
      limit: 25,
      sort: "created_at",
      order: "desc",
      filters: { routing_destination: "government_default" },
    });

    expect(chain.or).toHaveBeenCalledWith(
      "routing_destination.is.null,routing_destination.eq.government",
    );
  });

  it("applies self_help routing filter with eq clause", async () => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      or: vi.fn(),
      limit: vi.fn(),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.lte.mockReturnValue(chain);
    chain.in.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.limit.mockResolvedValue({ data: [], error: null });
    const client = { from: vi.fn(() => chain) };

    await listRecentReports(client as never, {
      limit: 25,
      sort: "created_at",
      order: "desc",
      filters: { routing_destination: "self_help" },
    });

    expect(chain.eq).toHaveBeenCalledWith("routing_destination", "self_help");
  });
});

describe("officer read modules avoid admin client", () => {
  it("officer-read service does not import admin client", async () => {
    const source = await import.meta.glob(
      "@/server/services/officer-read.ts",
      { eager: true, query: "?raw", import: "default" },
    );
    const file = Object.values(source)[0] as string;
    expect(file).not.toContain("@/lib/supabase/admin");
    expect(file).not.toContain("getAdminClient");
  });

  it("officer guard uses cookie-scoped createClient", async () => {
    const source = await import.meta.glob("@/server/officer/guard.ts", {
      eager: true,
      query: "?raw",
      import: "default",
    });
    const file = Object.values(source)[0] as string;
    expect(file).toContain("@/lib/supabase/server");
    expect(file).not.toContain("getAdminClient");
  });
});

describe("getOfficerReport", () => {
  it("returns null when report is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };

    const report = await getOfficerReport(client as never, "missing");
    expect(report).toBeNull();
  });
});

describe("updateReportStatus", () => {
  it("calls the atomic status RPC with JWT actor id", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { report_id: "rep-1", status: "resolved", updated: true },
      error: null,
    });
    const client = { rpc };

    const result = await updateReportStatus(client as never, {
      reportId: "rep-1",
      status: "resolved",
      note: "Synthetic closure note.",
      actorId: "officer-sub",
    });

    expect(result.updated).toBe(true);
    expect(rpc).toHaveBeenCalledWith("update_report_with_status_event", {
      p_report_id: "rep-1",
      p_status: "resolved",
      p_note: "Synthetic closure note.",
      p_actor_id: "officer-sub",
    });
  });
});
