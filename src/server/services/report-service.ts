import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "@/lib/supabase/admin";
import { createOpenAiCompatibleProvider } from "@/server/ai/openai-compatible";
import type { AnalysisProvider, SupportedImageMimeType } from "@/server/ai/provider";
import type { ReportAnalysis } from "@/server/domain/report-analysis";
import { getServerEnv } from "@/server/config/env";
import {
  HttpError,
  imageTooLarge,
  jsonErrorResponse,
  reportAnalysisFailed,
  reportSubmissionFailed,
  unsupportedImageType,
} from "@/server/http/errors";
import {
  createIntakeReportWithAccessToken,
  createReportWithAccessToken,
  getCitizenStatus,
} from "@/server/repositories/reports";
import { issueAccessToken } from "@/server/security/access-tokens";
import {
  dispatchTriageAndWait,
  enqueueTriageDispatch,
} from "@/server/triage/dispatch";
import {
  projectCitizenTriageView,
  type CitizenServiceStep,
} from "@/server/services/citizen-status";
import {
  enforceReportRateLimit,
  type RateLimitRequest,
} from "@/server/security/rate-limit";
import {
  deleteEvidenceByUri,
  EvidenceServiceError,
  resolveMaxEvidenceBytes,
  uploadEvidence,
  validateEvidenceBytes,
  formatEvidencePath,
  parseSupabaseEvidenceUri,
} from "./evidence-service";

export const EVIDENCE_BUCKET = "evidence";
export const MAX_DESCRIPTION_LENGTH = 3000;

export type AnalyzeResponse = {
  report_id: string;
  analysis: ReportAnalysis;
  persisted: boolean;
  access_token: string | null;
};

export type ReportSubmissionResponse = {
  report_id: string;
  access_token: string;
  intake_status: "received";
  triage_status: string;
  service_step?: CitizenServiceStep;
  routing_destination?: string | null;
  category?: string | null;
  severity?: number | null;
  priority?: string | null;
  summary?: string | null;
  recommendation?: string | null;
  playbook_id?: string | null;
  can_escalate?: boolean;
  guidance_script?: string | null;
  guidance_status?: "script_ready" | "generate_later" | null;
  allowed_actions?: string[];
  prohibited_actions?: string[];
};

export type ReportServiceDeps = {
  client: SupabaseClient;
  provider: AnalysisProvider;
  evidenceBucket?: string;
  maxEvidenceBytes?: number;
  dispatchTriageAndWait?: typeof dispatchTriageAndWait;
};

function parseOptionalCoordinate(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
): number | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new HttpError(422, "Invalid request body");
  }
  return parsed;
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && Boolean(value.name);
}

function mapEvidenceValidationError(
  code: "empty" | "oversized" | "invalid_type" | "spoofed_mime",
): HttpError {
  if (code === "oversized") {
    return imageTooLarge();
  }
  return unsupportedImageType("unknown");
}

type ParsedReportForm = {
  description: string;
  latitude: number | null;
  longitude: number | null;
  imageBytes: Uint8Array | null;
  imageMime: SupportedImageMimeType | null;
};

async function parseReportFormData(formData: FormData): Promise<ParsedReportForm> {
  const descriptionRaw = formData.get("description");
  const descriptionText = descriptionRaw == null ? "" : String(descriptionRaw);
  if (descriptionText.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(422, "Invalid request body");
  }
  const description = descriptionText;

  const latitude = parseOptionalCoordinate(formData.get("latitude"), -90, 90);
  const longitude = parseOptionalCoordinate(formData.get("longitude"), -180, 180);

  const imageField = formData.get("image");
  let imageBytes: Uint8Array | null = null;
  let imageMime: SupportedImageMimeType | null = null;
  let declaredMime: string | null = null;

  if (isUploadFile(imageField)) {
    declaredMime = imageField.type || null;
    const buffer = new Uint8Array(await imageField.arrayBuffer());
    const validation = await validateEvidenceBytes(buffer, {
      maxBytes: resolveMaxEvidenceBytes(),
      declaredContentLength: imageField.size,
      declaredMimeType: declaredMime,
    });
    if (!validation.ok) {
      throw mapEvidenceValidationError(validation.code);
    }
    imageBytes = buffer;
    imageMime = validation.mimeType as SupportedImageMimeType;
  }

  if (!description.trim() && !imageBytes) {
    throw new HttpError(422, "Provide description or image");
  }

  return { description, latitude, longitude, imageBytes, imageMime };
}

async function buildIntakeTriageOutcome(
  client: SupabaseClient,
  reportId: string,
): Promise<Omit<ReportSubmissionResponse, "report_id" | "access_token" | "intake_status">> {
  const raw = await getCitizenStatus(client, reportId);
  if (!raw) {
    return { triage_status: "pending" };
  }

  const view = projectCitizenTriageView(raw);
  return {
    triage_status: view.triage_status,
    service_step: view.service_step,
    routing_destination: raw.routing_destination,
    category: view.category,
    severity: view.severity,
    priority: view.priority,
    summary: view.summary,
    recommendation: view.recommendation,
    playbook_id: view.playbook_id ?? null,
    can_escalate: view.can_escalate ?? false,
    guidance_script: view.guidance_script ?? null,
    guidance_status: view.guidance_status ?? null,
    allowed_actions: view.allowed_actions ?? [],
    prohibited_actions: view.prohibited_actions ?? [],
  };
}

export async function submitReport(
  formData: FormData,
  deps: Pick<
    ReportServiceDeps,
    "client" | "evidenceBucket" | "maxEvidenceBytes" | "dispatchTriageAndWait"
  >,
): Promise<ReportSubmissionResponse> {
  const parsed = await parseReportFormData(formData);
  const { description, latitude, longitude, imageBytes, imageMime } = parsed;

  const reportId = randomUUID();
  let evidenceUri: string | null = null;

  try {
    if (imageBytes && imageMime) {
      evidenceUri = await uploadEvidence({
        client: deps.client,
        reportId,
        bytes: imageBytes,
        bucketName: deps.evidenceBucket ?? EVIDENCE_BUCKET,
        maxBytes: deps.maxEvidenceBytes ?? resolveMaxEvidenceBytes(),
        declaredContentLength: imageBytes.byteLength,
        declaredMimeType: imageMime,
      });
    }

    const { plaintext, tokenHash, expiresAt } = issueAccessToken();
    await createIntakeReportWithAccessToken(deps.client, {
      reportId,
      tokenHash,
      tokenExpiresAt: expiresAt,
      description: description.trim() || null,
      latitude,
      longitude,
      evidencePath: evidenceUri
        ? formatEvidencePath(
            deps.evidenceBucket ?? EVIDENCE_BUCKET,
            parseSupabaseEvidenceUri(evidenceUri).objectPath,
          )
        : null,
    });

    const runTriage = deps.dispatchTriageAndWait ?? dispatchTriageAndWait;
    try {
      await runTriage(reportId, { client: deps.client });
    } catch (triageError) {
      console.error(`submitReport: synchronous triage failed for ${reportId}`, triageError);
      enqueueTriageDispatch(reportId);
    }

    const outcome = await buildIntakeTriageOutcome(deps.client, reportId);

    return {
      report_id: reportId,
      access_token: plaintext,
      intake_status: "received",
      ...outcome,
    };
  } catch (error) {
    if (evidenceUri) {
      try {
        await deleteEvidenceByUri({ client: deps.client, uri: evidenceUri });
      } catch {
        // Compensation delete is best-effort; original failure still surfaces.
      }
    }

    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof EvidenceServiceError) {
      if (error.code === "oversized") {
        throw imageTooLarge();
      }
      if (
        error.code === "invalid_type" ||
        error.code === "spoofed_mime" ||
        error.code === "empty"
      ) {
        throw unsupportedImageType("unknown");
      }
    }

    throw reportSubmissionFailed();
  }
}

export async function analyzeReport(
  formData: FormData,
  deps: ReportServiceDeps,
): Promise<AnalyzeResponse> {
  const descriptionRaw = formData.get("description");
  const descriptionText = descriptionRaw == null ? "" : String(descriptionRaw);
  if (descriptionText.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(422, "Invalid request body");
  }
  const description = descriptionText;

  const latitude = parseOptionalCoordinate(formData.get("latitude"), -90, 90);
  const longitude = parseOptionalCoordinate(formData.get("longitude"), -180, 180);

  const imageField = formData.get("image");
  let imageBytes: Uint8Array | null = null;
  let imageMime: SupportedImageMimeType | null = null;
  let declaredMime: string | null = null;

  if (isUploadFile(imageField)) {
    declaredMime = imageField.type || null;
    const buffer = new Uint8Array(await imageField.arrayBuffer());
    const maxBytes = deps.maxEvidenceBytes ?? resolveMaxEvidenceBytes();
    const validation = await validateEvidenceBytes(buffer, {
      maxBytes,
      declaredContentLength: imageField.size,
      declaredMimeType: declaredMime,
    });
    if (!validation.ok) {
      throw mapEvidenceValidationError(validation.code);
    }
    imageBytes = buffer;
    imageMime = validation.mimeType as SupportedImageMimeType;
  }

  if (!description.trim() && !imageBytes) {
    throw new HttpError(422, "Provide description or image");
  }

  const reportId = randomUUID();
  let evidenceUri: string | null = null;

  try {
    if (imageBytes && imageMime) {
      evidenceUri = await uploadEvidence({
        client: deps.client,
        reportId,
        bytes: imageBytes,
        bucketName: deps.evidenceBucket ?? EVIDENCE_BUCKET,
        maxBytes: deps.maxEvidenceBytes ?? resolveMaxEvidenceBytes(),
        declaredContentLength: imageBytes.byteLength,
        declaredMimeType: imageMime,
      });
    }

    const analysisResult = await deps.provider.analyze({
      description: description.trim(),
      image: imageBytes && imageMime ? { bytes: imageBytes, mimeType: imageMime } : undefined,
    });

    const { plaintext, tokenHash, expiresAt } = issueAccessToken();
    await createReportWithAccessToken(deps.client, {
      reportId,
      tokenHash,
      tokenExpiresAt: expiresAt,
      description: description.trim() || null,
      latitude,
      longitude,
      analysis: analysisResult.analysis,
      urbanContext: null,
      evidencePath: evidenceUri
        ? formatEvidencePath(
            deps.evidenceBucket ?? EVIDENCE_BUCKET,
            parseSupabaseEvidenceUri(evidenceUri).objectPath,
          )
        : null,
    });

    return {
      report_id: reportId,
      analysis: analysisResult.analysis,
      persisted: true,
      access_token: plaintext,
    };
  } catch (error) {
    if (evidenceUri) {
      try {
        await deleteEvidenceByUri({ client: deps.client, uri: evidenceUri });
      } catch {
        // Compensation delete is best-effort; original failure still surfaces.
      }
    }

    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof EvidenceServiceError) {
      if (error.code === "oversized") {
        throw imageTooLarge();
      }
      if (
        error.code === "invalid_type" ||
        error.code === "spoofed_mime" ||
        error.code === "empty"
      ) {
        throw unsupportedImageType("unknown");
      }
    }

    throw reportAnalysisFailed();
  }
}

export async function handleSubmitReportRequest(
  request: Request,
  options: {
    client?: SupabaseClient;
    rateLimitRequest?: RateLimitRequest;
  } = {},
): Promise<Response> {
  const rateLimitRequest: RateLimitRequest = options.rateLimitRequest ?? {
    headers: request.headers,
  };
  const rateLimit = enforceReportRateLimit(rateLimitRequest);
  if (rateLimit) {
    return Response.json(
      { detail: rateLimit.detail },
      {
        status: rateLimit.status,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimit.retryAfter,
        },
      },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const deps = {
    client: options.client ?? getAdminClient(),
  };

  try {
    const payload = await submitReport(formData, deps);
    return Response.json(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonErrorResponse(error);
    }
    return jsonErrorResponse(reportSubmissionFailed());
  }
}

export async function handleAnalyzeReportRequest(
  request: Request,
  options: {
    client?: SupabaseClient;
    provider?: AnalysisProvider;
    rateLimitRequest?: RateLimitRequest;
  } = {},
): Promise<Response> {
  const rateLimitRequest: RateLimitRequest = options.rateLimitRequest ?? {
    headers: request.headers,
  };
  const rateLimit = enforceReportRateLimit(rateLimitRequest);
  if (rateLimit) {
    return Response.json(
      { detail: rateLimit.detail },
      {
        status: rateLimit.status,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": rateLimit.retryAfter,
        },
      },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const deps: ReportServiceDeps = {
    client: options.client ?? getAdminClient(),
    provider:
      options.provider ??
      createOpenAiCompatibleProvider({ env: getServerEnv() }),
  };

  try {
    const payload = await analyzeReport(formData, deps);
    return Response.json(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonErrorResponse(error);
    }
    return jsonErrorResponse(reportAnalysisFailed());
  }
}
