import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleOfficerRoutingOverrideRequest,
  handleUpdateReportStatusRequest,
} from "./officer-write";

const mockRequireOfficerContext = vi.fn();
const mockGetOfficerReport = vi.fn();
const mockUpdateOfficerReportRouting = vi.fn();
const mockUpdateReportStatus = vi.fn();

vi.mock("@/server/officer/guard", () => ({
  requireOfficerContext: () => mockRequireOfficerContext(),
}));

vi.mock("@/server/repositories/reports", () => ({
  getOfficerReport: (...args: unknown[]) => mockGetOfficerReport(...args),
  updateOfficerReportRouting: (...args: unknown[]) =>
    mockUpdateOfficerReportRouting(...args),
  updateReportStatus: (...args: unknown[]) => mockUpdateReportStatus(...args),
}));

describe("handleOfficerRoutingOverrideRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOfficerContext.mockResolvedValue({
      ok: true,
      context: {
        client: {},
        session: { userId: "officer-1" },
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOfficerContext.mockResolvedValue({
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    });

    const response = await handleOfficerRoutingOverrideRequest(
      new Request("http://localhost/api/officer/reports/rep-1/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escalate_to_government" }),
      }),
      "rep-1",
    );

    expect(response.status).toBe(401);
  });

  it("escalate_to_government sets routing_destination government on self_help report", async () => {
    mockGetOfficerReport.mockResolvedValue({
      report_id: "rep-1",
      status: "new",
      routing_destination: "self_help",
    });
    mockUpdateOfficerReportRouting.mockResolvedValue(undefined);

    const response = await handleOfficerRoutingOverrideRequest(
      new Request("http://localhost/api/officer/reports/rep-1/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escalate_to_government" }),
      }),
      "rep-1",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      routing_destination: "government",
    });
    expect(mockUpdateOfficerReportRouting).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        reportId: "rep-1",
        routingDestination: "government",
        routingReason: "officer_escalated",
      }),
    );
  });

  it("mark_resolved requires non-empty note and sets status resolved", async () => {
    mockGetOfficerReport.mockResolvedValue({
      report_id: "rep-1",
      status: "new",
      routing_destination: "self_help",
    });
    mockUpdateReportStatus.mockResolvedValue({
      report_id: "rep-1",
      status: "resolved",
      updated: true,
    });

    const missingNote = await handleOfficerRoutingOverrideRequest(
      new Request("http://localhost/api/officer/reports/rep-1/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_resolved" }),
      }),
      "rep-1",
    );
    expect(missingNote.status).toBe(422);

    const response = await handleOfficerRoutingOverrideRequest(
      new Request("http://localhost/api/officer/reports/rep-1/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_resolved",
          note: "Citizen guidance was sufficient.",
        }),
      }),
      "rep-1",
    );

    expect(response.status).toBe(200);
    expect(mockUpdateReportStatus).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        reportId: "rep-1",
        status: "resolved",
        note: "Citizen guidance was sufficient.",
      }),
    );
  });
});

describe("handleUpdateReportStatusRequest auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOfficerContext.mockResolvedValue({
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    });

    const response = await handleUpdateReportStatusRequest(
      new Request("http://localhost/api/officer/reports/rep-1/status?status=reviewing"),
      "rep-1",
    );

    expect(response.status).toBe(401);
  });
});
