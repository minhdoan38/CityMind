import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetAdminClientCache } from "@/lib/supabase/admin";
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { resetServerEnvCache } from "@/server/config/env";
import type { AnalysisProvider } from "@/server/ai/provider";
import { resetRateLimiters } from "@/server/security/rate-limit";
import {
  analyzeReport,
  handleAnalyzeReportRequest,
  handleSubmitReportRequest,
  MAX_DESCRIPTION_LENGTH,
  submitReport,
} from "./report-service";

const dispatchTriageAndWait = vi.fn();
const enqueueTriageDispatch = vi.fn();
const getCitizenStatus = vi.fn();

vi.mock("@/server/triage/dispatch", () => ({
  dispatchTriageAndWait: (...args: unknown[]) => dispatchTriageAndWait(...args),
  enqueueTriageDispatch: (...args: unknown[]) => enqueueTriageDispatch(...args),
}));

vi.mock("@/server/repositories/reports", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/server/repositories/reports")>();
  return {
    ...mod,
    getCitizenStatus: (...args: unknown[]) => getCitizenStatus(...args),
  };
});

const validAnalysis: ReportAnalysis = {
  category: "pothole",
  severity: 4,
  confidence: 0.82,
  summary: "Large pothole near a school entrance.",
  recommendation: "Inspect the road and secure the affected lane.",
  priority: "high",
  estimated_impact: "Safety risk for students and road users.",
  evidence: ["Citizen description identifies a large pothole."],
  uncertainty: ["Exact dimensions are not verified."],
};

const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const JPEG_BYTES = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
  0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

function createProvider(
  overrides: Partial<AnalysisProvider> = {},
): AnalysisProvider {
  return {
    analyze: vi.fn(async () => ({
      analysis: validAnalysis,
      lineage: {
        providerLabel: "test",
        responseModel: "test-model",
        requestId: "req-1",
        latencyMs: 12,
      },
    })),
    ...overrides,
  };
}

function createClient(options: { rpcError?: Error | null } = {}) {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: options.rpcError ?? null });
  const bucketApi = { upload, remove };

  return {
    rpc,
    storage: {
      from: vi.fn(() => bucketApi),
    },
    bucketApi,
  };
}

function formWith(fields: Record<string, string>, file?: File): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  if (file) {
    form.append("image", file);
  }
  return form;
}

describe("analyzeReport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetRateLimiters();
    resetAdminClientCache();
    resetServerEnvCache();
  });

  it("returns report_id, analysis, persisted, and issue-once access_token", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith({
      description: "Synthetic incident description for contract capture.",
    });

    const result = await analyzeReport(form, { client: client as never, provider });

    expect(result.report_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.analysis).toEqual(validAnalysis);
    expect(result.persisted).toBe(true);
    expect(result.access_token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(client.rpc).toHaveBeenCalledTimes(1);
    const rpcArgs = client.rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rpcArgs.p_token_hash).not.toBe(result.access_token);
  });

  it("rejects empty description and empty image with 422", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith(
      { description: "" },
      new File([], "empty.png", { type: "image/png" }),
    );

    await expect(
      analyzeReport(form, { client: client as never, provider }),
    ).rejects.toMatchObject({ status: 422, message: "Provide description or image" });
  });

  it("rejects unsupported mime types with 415", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith(
      { description: "Synthetic evidence note." },
      new File([new TextEncoder().encode("not-an-image")], "evidence.txt", {
        type: "text/plain",
      }),
    );

    await expect(
      analyzeReport(form, { client: client as never, provider }),
    ).rejects.toMatchObject({
      status: 415,
      message: expect.stringContaining("Only JPEG, PNG, or WebP"),
    });
  });

  it("rejects forged content types using magic bytes", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith(
      { description: "Synthetic evidence note." },
      new File([new TextEncoder().encode("GIF89a-not-really-jpeg")], "fake.jpg", {
        type: "image/jpeg",
      }),
    );

    await expect(
      analyzeReport(form, { client: client as never, provider }),
    ).rejects.toMatchObject({ status: 415 });
  });

  it("rejects oversized images with 413", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith(
      { description: "Synthetic evidence note." },
      new File([PNG_BYTES], "evidence.png", { type: "image/png" }),
    );

    await expect(
      analyzeReport(form, {
        client: client as never,
        provider,
        maxEvidenceBytes: 3,
      }),
    ).rejects.toMatchObject({
      status: 413,
      message: "Image exceeds configured size limit",
    });
  });

  it("rejects out-of-range coordinates with 422", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith({ description: "Valid report", latitude: "91" });

    await expect(
      analyzeReport(form, { client: client as never, provider }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("returns 502 when persistence fails after upload and compensates storage", async () => {
    const client = createClient({ rpcError: new Error("db failed") });
    const provider = createProvider();
    const form = formWith(
      { description: "Synthetic valid incident report." },
      new File([PNG_BYTES], "evidence.png", { type: "image/png" }),
    );

    await expect(
      analyzeReport(form, { client: client as never, provider }),
    ).rejects.toMatchObject({
      status: 502,
      message: "Report analysis failed",
    });

    expect(client.bucketApi.remove).toHaveBeenCalled();
  });

  it("returns 502 when analysis provider fails", async () => {
    const client = createClient();
    const provider = createProvider({
      analyze: vi.fn(async () => {
        throw new Error("provider down");
      }),
    });
    const form = formWith({ description: "Synthetic valid incident report." });

    await expect(
      analyzeReport(form, { client: client as never, provider }),
    ).rejects.toMatchObject({
      status: 502,
      message: "Report analysis failed",
    });
  });
});

describe("submitReport", () => {
  beforeEach(() => {
    dispatchTriageAndWait.mockReset();
    dispatchTriageAndWait.mockResolvedValue(undefined);
    enqueueTriageDispatch.mockReset();
    getCitizenStatus.mockReset();
    getCitizenStatus.mockResolvedValue({
      report_id: "rep-1",
      received_at: "2026-07-22T10:00:00+00:00",
      triage_status: "completed",
      status: "new",
      category: "waste",
      severity: 2,
      priority: "low",
      summary: "Overflowing bin near the park.",
      recommendation: "Secure the lid and schedule pickup.",
      routing_destination: "self_help",
      history: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRateLimiters();
    resetAdminClientCache();
    resetServerEnvCache();
  });

  it("accepts JPEG uploads declared as image/jpg", async () => {
    const client = createClient();
    const form = formWith(
      { description: "Pothole with photo evidence attached." },
      new File([JPEG_BYTES], "photo.jpg", { type: "image/jpg" }),
    );

    const result = await submitReport(form, { client: client as never });

    expect(result.intake_status).toBe("received");
    expect(client.bucketApi.upload).toHaveBeenCalled();
  });

  it("returns government intake outcome with officer_review and no self-help coach fields", async () => {
    getCitizenStatus.mockResolvedValue({
      report_id: "rep-gov",
      received_at: "2026-07-22T10:00:00+00:00",
      triage_status: "completed",
      status: "new",
      category: "pothole",
      severity: 5,
      priority: "high",
      summary: "Large pothole blocking traffic near school.",
      recommendation: "Dispatch road crew for immediate repair.",
      routing_destination: "government",
      history: [],
    });

    const client = createClient();
    const provider = createProvider();
    const form = formWith({
      description: "Major pothole on Main Street.",
    });

    const result = await submitReport(form, { client: client as never });

    expect(result.service_step).toBe("officer_review");
    expect(result.routing_destination).toBe("government");
    expect(result.service_step).not.toBe("self_help_guidance");
    expect(result.can_escalate).toBe(false);
    expect(result.playbook_id).toBeNull();
    expect(result.severity).toBe(5);
    expect(result.category).toBe("pothole");
    expect(dispatchTriageAndWait).toHaveBeenCalled();
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it("returns intake response with synchronous triage outcome without calling provider.analyze", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith({
      description: "Synthetic incident description for intake.",
    });

    const result = await submitReport(form, { client: client as never });

    expect(result).toEqual({
      report_id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      ),
      access_token: expect.stringMatching(/^[A-Za-z0-9_-]+$/),
      intake_status: "received",
      triage_status: "completed",
      service_step: "self_help_guidance",
      routing_destination: "self_help",
      category: "waste",
      severity: 2,
      priority: "low",
      summary: "Overflowing bin near the park.",
      recommendation: "Secure the lid and schedule pickup.",
      playbook_id: "waste",
      can_escalate: true,
      guidance_script: null,
      guidance_status: null,
      allowed_actions: [],
      prohibited_actions: [],
    });
    expect(dispatchTriageAndWait).toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      "create_intake_report_with_access_token",
      expect.objectContaining({
        p_description: "Synthetic incident description for intake.",
      }),
    );
    const rpcArgs = client.rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rpcArgs.p_token_hash).not.toBe(result.access_token);
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it("persists intake when triage provider is unavailable (outage contract)", async () => {
    const client = createClient();
    const provider = createProvider({
      analyze: vi.fn(async () => {
        throw new Error("provider outage");
      }),
    });
    const form = formWith({
      description: "Synthetic outage scenario incident report.",
    });

    const result = await submitReport(form, { client: client as never });

    expect(result.report_id).toBeDefined();
    expect(result.access_token).toBeDefined();
    expect(result.intake_status).toBe("received");
    expect(result.triage_status).toBe("completed");
    expect(dispatchTriageAndWait).toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      "create_intake_report_with_access_token",
      expect.objectContaining({
        p_description: "Synthetic outage scenario incident report.",
      }),
    );
  });

  it("falls back to async dispatch when synchronous triage throws", async () => {
    process.env.INTERNAL_TRIAGE_SECRET = "a".repeat(32);
    process.env.APP_URL = "http://127.0.0.1:3000";
    dispatchTriageAndWait.mockRejectedValueOnce(new Error("triage failed"));

    const client = createClient();
    const form = formWith({
      description: "Synthetic incident description for intake dispatch.",
    });

    const result = await submitReport(form, { client: client as never });

    expect(result.triage_status).toBe("completed");
    expect(enqueueTriageDispatch).toHaveBeenCalledWith(result.report_id);
  });

  it("still returns intake response when synchronous triage fails", async () => {
    process.env.INTERNAL_TRIAGE_SECRET = "a".repeat(32);
    process.env.APP_URL = "http://127.0.0.1:3000";
    dispatchTriageAndWait.mockRejectedValueOnce(new Error("network down"));
    getCitizenStatus.mockResolvedValueOnce({
      report_id: "rep-1",
      received_at: "2026-07-22T10:00:00+00:00",
      triage_status: "pending",
      status: "new",
      category: null,
      severity: null,
      priority: null,
      summary: null,
      recommendation: null,
      routing_destination: null,
      history: [],
    });

    const client = createClient();
    const form = formWith({
      description: "Synthetic incident description for intake outage.",
    });

    const result = await submitReport(form, { client: client as never });
    expect(result.intake_status).toBe("received");
    expect(result.triage_status).toBe("pending");
    expect(enqueueTriageDispatch).toHaveBeenCalledWith(result.report_id);
  });

  it("returns 502 when intake persistence fails and compensates storage", async () => {
    const client = createClient({ rpcError: new Error("db failed") });
    const form = formWith(
      { description: "Synthetic valid incident report." },
      new File([PNG_BYTES], "evidence.png", { type: "image/png" }),
    );

    await expect(submitReport(form, { client: client as never })).rejects.toMatchObject({
      status: 502,
      message: "Report submission failed",
    });

    expect(client.bucketApi.remove).toHaveBeenCalled();
  });
});

describe("handleSubmitReportRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetRateLimiters();
  });

  it("enforces report rate limits on intake", async () => {
    process.env.REPORT_RATE_LIMIT_PER_MINUTE = "1";
    resetRateLimiters();

    const client = createClient();
    const form = formWith({ description: "Synthetic report for rate-limit contract." });
    const request = new Request("http://localhost/api/v1/reports", {
      method: "POST",
      body: form,
    });

    const first = await handleSubmitReportRequest(request, { client: client as never });
    expect(first.status).toBe(200);

    const secondRequest = new Request("http://localhost/api/v1/reports", {
      method: "POST",
      body: formWith({ description: "Synthetic report for rate-limit contract." }),
    });
    const second = await handleSubmitReportRequest(secondRequest, {
      client: client as never,
    });
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("handleAnalyzeReportRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetRateLimiters();
  });

  it("enforces report rate limits separately from status", async () => {
    process.env.REPORT_RATE_LIMIT_PER_MINUTE = "1";
    resetRateLimiters();

    const client = createClient();
    const provider = createProvider();
    const form = formWith({ description: "Synthetic report for rate-limit contract." });
    const request = new Request("http://localhost/api/v1/reports/analyze", {
      method: "POST",
      body: form,
    });

    const first = await handleAnalyzeReportRequest(request, {
      client: client as never,
      provider,
    });
    expect(first.status).toBe(200);

    const secondRequest = new Request("http://localhost/api/v1/reports/analyze", {
      method: "POST",
      body: formWith({ description: "Synthetic report for rate-limit contract." }),
    });
    const second = await handleAnalyzeReportRequest(secondRequest, {
      client: client as never,
      provider,
    });
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBeTruthy();
  });

  it("rejects descriptions longer than the FastAPI-compatible limit", async () => {
    const client = createClient();
    const provider = createProvider();
    const form = formWith({ description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1) });
    const request = new Request("http://localhost/api/v1/reports/analyze", {
      method: "POST",
      body: form,
    });

    const response = await handleAnalyzeReportRequest(request, {
      client: client as never,
      provider,
    });
    expect(response.status).toBe(422);
  });
});
