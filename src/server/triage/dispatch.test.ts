import { afterEach, describe, expect, it, vi } from "vitest";

import { dispatchTriage, dispatchTriageAndWait } from "./dispatch";

function createClient(row: Record<string, unknown> | null) {
  const selectMaybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const updateMaybeSingle = vi.fn().mockResolvedValue({
    data:
      row &&
      ["pending", "failed", "retry"].includes(String(row.triage_status))
        ? { report_id: row.report_id }
        : null,
    error: null,
  });

  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: selectMaybeSingle,
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: updateMaybeSingle,
          })),
        })),
      })),
    })),
  }));

  return { from, selectMaybeSingle, updateMaybeSingle };
}

describe("dispatchTriage", () => {
  it("dispatches eligible pending reports", async () => {
    const client = createClient({
      report_id: "report-1",
      triage_status: "pending",
      triage_next_attempt_at: null,
    });
    const runTriage = vi.fn(async () => ({ reportId: "report-1", disposition: "completed" }));

    const result = await dispatchTriage("report-1", {
      client: client as never,
      runTriage,
    });

    expect(result).toEqual({
      accepted: true,
      reportId: "report-1",
      disposition: "accepted",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runTriage).toHaveBeenCalledWith("report-1", {
      client: client,
    });
  });

  it("returns idempotent acceptance for completed reports", async () => {
    const client = createClient({
      report_id: "report-1",
      triage_status: "completed",
      triage_next_attempt_at: null,
    });
    const runTriage = vi.fn();

    const result = await dispatchTriage("report-1", {
      client: client as never,
      runTriage,
    });

    expect(result).toEqual({
      accepted: true,
      reportId: "report-1",
      disposition: "already_running_or_done",
    });
    expect(runTriage).not.toHaveBeenCalled();
  });

  it("returns idempotent acceptance for processing reports", async () => {
    const client = createClient({
      report_id: "report-1",
      triage_status: "processing",
      triage_next_attempt_at: null,
    });
    const runTriage = vi.fn();

    const result = await dispatchTriage("report-1", {
      client: client as never,
      runTriage,
    });

    expect(result.accepted).toBe(true);
    expect(runTriage).not.toHaveBeenCalled();
  });

  it("rejects ineligible manual_review reports", async () => {
    const client = createClient({
      report_id: "report-1",
      triage_status: "manual_review",
      triage_next_attempt_at: null,
    });

    const result = await dispatchTriage("report-1", {
      client: client as never,
      runTriage: vi.fn(),
    });

    expect(result).toEqual({
      accepted: false,
      reportId: "report-1",
      reason: "ineligible_status",
    });
  });

  it("returns not_found for missing reports", async () => {
    const client = createClient(null);

    const result = await dispatchTriage("missing", {
      client: client as never,
      runTriage: vi.fn(),
    });

    expect(result).toEqual({
      accepted: false,
      reportId: "missing",
      reason: "not_found",
    });
  });

  it("awaits runTriage before returning when wait:true", async () => {
    const client = createClient({
      report_id: "report-1",
      triage_status: "pending",
      triage_next_attempt_at: null,
    });
    let resolveTriage: (() => void) | undefined;
    const triagePromise = new Promise<void>((resolve) => {
      resolveTriage = resolve;
    });
    const runTriage = vi.fn(() => triagePromise);

    const dispatchPromise = dispatchTriage("report-1", {
      client: client as never,
      runTriage,
      wait: true,
    });

    let settled = false;
    void dispatchPromise.then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    expect(runTriage).toHaveBeenCalledWith("report-1", { client });

    resolveTriage?.();
    const result = await dispatchPromise;
    expect(result).toEqual({
      accepted: true,
      reportId: "report-1",
      disposition: "accepted",
    });
  });

  it("returns before runTriage resolves when wait is false", async () => {
    const client = createClient({
      report_id: "report-1",
      triage_status: "pending",
      triage_next_attempt_at: null,
    });
    let resolveTriage: (() => void) | undefined;
    const triagePromise = new Promise<void>((resolve) => {
      resolveTriage = resolve;
    });
    const runTriage = vi.fn(() => triagePromise);

    const dispatchPromise = dispatchTriage("report-1", {
      client: client as never,
      runTriage,
    });

    let dispatchSettled = false;
    void dispatchPromise.then(() => {
      dispatchSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runTriage).toHaveBeenCalledWith("report-1", { client });
    expect(dispatchSettled).toBe(true);

    let triageSettled = false;
    void triagePromise.then(() => {
      triageSettled = true;
    });
    expect(triageSettled).toBe(false);

    resolveTriage?.();
    await triagePromise;
  });

  it("returns accepted when wait:true and runTriage throws", async () => {
    const client = createClient({
      report_id: "report-1",
      triage_status: "pending",
      triage_next_attempt_at: null,
    });
    const runTriage = vi.fn(async () => {
      throw new Error("triage failed");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await dispatchTriage("report-1", {
      client: client as never,
      runTriage,
      wait: true,
    });

    expect(result).toEqual({
      accepted: true,
      reportId: "report-1",
      disposition: "accepted",
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("dispatchTriageAndWait", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes dispatch with force:true and wait:true (bypasses retry backoff)", async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    const client = createClient({
      report_id: "report-retry",
      triage_status: "retry",
      triage_next_attempt_at: futureDate,
    });
    const runTriage = vi.fn(async () => ({ reportId: "report-retry", disposition: "completed" }));

    const blocked = await dispatchTriage("report-retry", {
      client: client as never,
      runTriage,
    });
    expect(blocked).toEqual({
      accepted: false,
      reportId: "report-retry",
      reason: "not_due",
    });
    expect(runTriage).not.toHaveBeenCalled();

    runTriage.mockClear();
    await dispatchTriageAndWait("report-retry", {
      client: client as never,
      runTriage,
    });

    expect(runTriage).toHaveBeenCalledWith("report-retry", { client });
  });
});
