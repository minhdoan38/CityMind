import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.restoreAllMocks();
    resetRateLimiters();
    resetAdminClientCache();
    resetServerEnvCache();
  });

  it("returns intake response without calling provider.analyze", async () => {
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
      triage_status: "pending",
    });
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
