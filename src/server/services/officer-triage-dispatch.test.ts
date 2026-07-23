import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  handleOfficerBulkTriageDispatchRequest,
  handleOfficerTriageDispatchRequest,
} from "./officer-triage-dispatch";

const dispatchTriage = vi.fn();
const requireOfficerContext = vi.fn();

vi.mock("@/server/triage/dispatch", () => ({
  dispatchTriage: (...args: unknown[]) => dispatchTriage(...args),
}));

vi.mock("@/server/officer/guard", () => ({
  requireOfficerContext: () => requireOfficerContext(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { report_id: "report-1", triage_status: "pending" },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe("officer triage dispatch", () => {
  beforeEach(() => {
    dispatchTriage.mockReset();
    requireOfficerContext.mockReset();
    requireOfficerContext.mockResolvedValue({
      ok: true,
      context: { session: { userId: "officer-1" }, client: {} },
    });
  });

  it("rejects unauthenticated requests", async () => {
    requireOfficerContext.mockResolvedValue({
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    });

    const response = await handleOfficerTriageDispatchRequest("report-1");
    expect(response.status).toBe(401);
  });

  it("accepts eligible pending reports", async () => {
    dispatchTriage.mockResolvedValue({
      accepted: true,
      reportId: "report-1",
      disposition: "accepted",
    });

    const response = await handleOfficerTriageDispatchRequest("report-1");
    expect(response.status).toBe(202);
    expect(dispatchTriage).toHaveBeenCalledWith("report-1", expect.any(Object));
  });

  it("bulk dispatch processes serially and reports skipped ids", async () => {
    dispatchTriage
      .mockResolvedValueOnce({
        accepted: true,
        reportId: "report-1",
        disposition: "accepted",
      })
      .mockResolvedValueOnce({
        accepted: false,
        reportId: "report-2",
        reason: "not_found",
      });

    const response = await handleOfficerBulkTriageDispatchRequest(
      new Request("http://localhost/api/officer/reports/triage/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_ids: ["report-1", "report-2"] }),
      }),
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload.accepted).toEqual(["report-1"]);
    expect(payload.skipped).toEqual([{ id: "report-2", reason: "not_found" }]);
    expect(dispatchTriage).toHaveBeenCalledTimes(2);
  });
});
