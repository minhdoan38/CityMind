import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOfficerContext = vi.fn();
const listTriageConsoleCases = vi.fn();

vi.mock("@/server/officer/guard", () => ({
  requireOfficerContext: () => requireOfficerContext(),
}));

vi.mock("@/server/repositories/triage-console", () => ({
  listTriageConsoleCases: (...args: unknown[]) => listTriageConsoleCases(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({}),
}));

import { handleOfficerTriageConsoleRequest } from "@/server/services/officer-triage-console";

const sampleCase = {
  report_id: "case-a",
  description: "Overflowing bin",
  triage_status: "completed",
  category: "waste",
  runs: [],
};

describe("handleOfficerTriageConsoleRequest", () => {
  beforeEach(() => {
    requireOfficerContext.mockReset();
    listTriageConsoleCases.mockReset();
    requireOfficerContext.mockResolvedValue({
      ok: true,
      context: {
        session: { userId: "officer-1", role: "officer" as const },
        client: {},
      },
    });
    listTriageConsoleCases.mockResolvedValue([sampleCase]);
  });

  it("returns 401 when unauthenticated", async () => {
    requireOfficerContext.mockResolvedValue({
      ok: false,
      response: Response.json({ detail: "Unauthorized" }, { status: 401 }),
    });

    const response = await handleOfficerTriageConsoleRequest(
      new Request("http://localhost/api/officer/triage-console", { method: "GET" }),
    );

    expect(response.status).toBe(401);
    expect(listTriageConsoleCases).not.toHaveBeenCalled();
  });

  it("returns 200 with cases envelope and forwards report_id filter", async () => {
    const response = await handleOfficerTriageConsoleRequest(
      new Request("http://localhost/api/officer/triage-console?report_id=case-a", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      cases: typeof sampleCase[];
      generated_at: string;
    };
    expect(body.cases).toHaveLength(1);
    expect(body.cases[0]?.report_id).toBe("case-a");
    expect(body.generated_at).toBeTruthy();
    expect(listTriageConsoleCases).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reportId: "case-a" }),
    );
  });

  it("returns 502 when repository lookup fails", async () => {
    listTriageConsoleCases.mockRejectedValue(new Error("db down"));

    const response = await handleOfficerTriageConsoleRequest(
      new Request("http://localhost/api/officer/triage-console", { method: "GET" }),
    );

    expect(response.status).toBe(502);
    const body = (await response.json()) as { detail: string };
    expect(body.detail).toBe("Triage console lookup failed");
  });
});
