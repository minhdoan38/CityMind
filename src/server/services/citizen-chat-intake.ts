import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getAdminClient } from "@/lib/supabase/admin";
import { generateFacilitatorReply } from "@/server/ai/intake-facilitator";
import { checkAiHealth } from "@/server/health/ai-readiness";
import {
  citizenStatusUnauthorized,
  evidenceScanningUnavailable,
  genericServiceFailure,
  HttpError,
  imageTooLarge,
  jsonErrorResponse,
  unsupportedImageType,
} from "@/server/http/errors";
import {
  countChatMessagesLast24h,
  insertChatMessage,
  listChatMessagesByReportId,
  type ChatMessageRow,
} from "@/server/repositories/chat-messages";
import {
  createIntakeReportWithAccessToken,
  getAccessTokenByHash,
  getCitizenStatus,
} from "@/server/repositories/reports";
import { issueAccessToken } from "@/server/security/access-tokens";
import { hashAccessToken, tokenBindsReport } from "@/server/security/access-tokens";
import {
  enforceIntakeRateLimit,
  type RateLimitRequest,
} from "@/server/security/rate-limit";
import {
  projectCitizenTriageView,
  type CitizenServiceStep,
} from "@/server/services/citizen-status";
import {
  deleteEvidenceByUri,
  EvidenceServiceError,
  formatEvidencePath,
  parseSupabaseEvidenceUri,
  resolveMaxEvidenceBytes,
  validateEvidenceBytes,
} from "@/server/services/evidence-service";
import { processAndStoreEvidence } from "@/server/services/evidence-image-pipeline";
import {
  dispatchTriageAndWait,
  enqueueTriageDispatch,
} from "@/server/triage/dispatch";

export { INTAKE_FACILITATOR_SYSTEM_PROMPT } from "@/server/ai/intake-facilitator";

const INTAKE_WELCOME_EN =
  "Hi! I'm here to help you report a community issue. Tell me what happened, where it is, and share a photo if you have one. I'll help gather the details — your report is submitted separately when you're ready.";
const INTAKE_WELCOME_VI =
  "Xin chào! Tôi ở đây để giúp bạn báo cáo sự cố cộng đồng. Hãy mô tả điều gì đã xảy ra, vị trí, và đính kèm ảnh nếu có. Tôi sẽ giúp thu thập thông tin — báo cáo được gửi riêng khi bạn sẵn sàng.";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES_PER_DAY = 50;
const MIN_DESCRIPTION_LENGTH = 5;
const MAX_DESCRIPTION_LENGTH = 3000;
const EVIDENCE_BUCKET = "evidence";

const IntakeStartSchema = z.object({
  locale: z.enum(["en", "vi"]).optional(),
});

export const IntakeAuthSchema = z.object({
  report_id: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
});

const IntakeSendSchema = IntakeAuthSchema.extend({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

const IntakeSubmitJsonSchema = IntakeAuthSchema.extend({
  description: z.string().min(MIN_DESCRIPTION_LENGTH).max(MAX_DESCRIPTION_LENGTH),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

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

type IntakeReportRow = {
  report_id: string;
  triage_status: string;
};

function serializeMessage(row: ChatMessageRow) {
  return {
    message_id: row.message_id,
    role: row.role,
    content: row.content,
    created_at: row.created_at,
  };
}

function welcomeForLocale(locale?: string): string {
  return locale === "vi" ? INTAKE_WELCOME_VI : INTAKE_WELCOME_EN;
}

async function authorizeIntakeRequest(
  client: SupabaseClient,
  reportId: string,
  token: string,
): Promise<void> {
  const tokenHash = hashAccessToken(token);
  const tokenRow = await getAccessTokenByHash(client, tokenHash);
  if (!tokenBindsReport(tokenRow, reportId)) {
    throw citizenStatusUnauthorized();
  }
}

async function loadIntakeReportRow(
  client: SupabaseClient,
  reportId: string,
): Promise<IntakeReportRow | null> {
  const { data, error } = await client
    .from("reports")
    .select("report_id, triage_status")
    .eq("report_id", reportId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return data as IntakeReportRow;
}

function assertIntakeEligible(row: IntakeReportRow): void {
  if (row.triage_status !== "pending") {
    throw new HttpError(403, "Intake chat is not available for this report.");
  }
}

export async function startIntakeSession(
  body: z.infer<typeof IntakeStartSchema> = {},
  client: SupabaseClient = getAdminClient(),
): Promise<{
  report_id: string;
  access_token: string;
  welcome_message: ReturnType<typeof serializeMessage>;
}> {
  const reportId = randomUUID();
  const { plaintext, tokenHash, expiresAt } = issueAccessToken();

  await createIntakeReportWithAccessToken(client, {
    reportId,
    tokenHash,
    tokenExpiresAt: expiresAt,
    description: null,
    latitude: null,
    longitude: null,
    evidencePath: null,
  });

  const welcome = await insertChatMessage(client, {
    reportId,
    role: "assistant",
    content: welcomeForLocale(body.locale),
  });

  return {
    report_id: reportId,
    access_token: plaintext,
    welcome_message: serializeMessage(welcome),
  };
}

export async function listIntakeMessages(
  body: z.infer<typeof IntakeAuthSchema>,
  client: SupabaseClient = getAdminClient(),
): Promise<{ messages: ReturnType<typeof serializeMessage>[] }> {
  await authorizeIntakeRequest(client, body.report_id, body.token);
  const row = await loadIntakeReportRow(client, body.report_id);
  if (!row) {
    throw citizenStatusUnauthorized();
  }
  assertIntakeEligible(row);

  const messages = await listChatMessagesByReportId(client, body.report_id);
  return { messages: messages.map(serializeMessage) };
}

export async function sendIntakeMessage(
  body: z.infer<typeof IntakeSendSchema>,
  client: SupabaseClient = getAdminClient(),
): Promise<{
  assistant_message: ReturnType<typeof serializeMessage>;
  messages: ReturnType<typeof serializeMessage>[];
}> {
  const health = await checkAiHealth();
  if (health.body.status === "down") {
    throw new HttpError(503, "Intake chat is temporarily unavailable.");
  }

  await authorizeIntakeRequest(client, body.report_id, body.token);
  const row = await loadIntakeReportRow(client, body.report_id);
  if (!row) {
    throw citizenStatusUnauthorized();
  }
  assertIntakeEligible(row);

  const count = await countChatMessagesLast24h(client, body.report_id);
  if (count >= MAX_MESSAGES_PER_DAY) {
    throw new HttpError(429, "Intake message limit reached for this report.");
  }

  const history = await listChatMessagesByReportId(client, body.report_id);
  await insertChatMessage(client, {
    reportId: body.report_id,
    role: "user",
    content: body.message.trim(),
  });

  const reply = await generateFacilitatorReply({
    history,
    userMessage: body.message.trim(),
  });

  const assistant = await insertChatMessage(client, {
    reportId: body.report_id,
    role: "assistant",
    content: reply.content,
    model: reply.model,
    latencyMs: reply.latencyMs,
  });

  const messages = await listChatMessagesByReportId(client, body.report_id);
  return {
    assistant_message: serializeMessage(assistant),
    messages: messages.map(serializeMessage),
  };
}

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

function mapEvidenceServiceError(error: EvidenceServiceError): HttpError {
  if (error.code === "oversized") {
    return imageTooLarge();
  }
  if (error.code === "scanner_unavailable") {
    return evidenceScanningUnavailable();
  }
  if (
    error.code === "invalid_type" ||
    error.code === "spoofed_mime" ||
    error.code === "empty" ||
    error.code === "infected" ||
    error.code === "transform_failed"
  ) {
    return unsupportedImageType("unknown");
  }
  throw error;
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

async function parseIntakeSubmitFormData(formData: FormData): Promise<{
  auth: z.infer<typeof IntakeAuthSchema>;
  description: string;
  latitude: number | null;
  longitude: number | null;
  imageBytes: Uint8Array | null;
  imageMime: string | null;
}> {
  const reportId = String(formData.get("report_id") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const authParsed = IntakeAuthSchema.safeParse({ report_id: reportId, token });
  if (!authParsed.success) {
    throw new HttpError(422, "Invalid request body");
  }

  const descriptionRaw = formData.get("description");
  const description = descriptionRaw == null ? "" : String(descriptionRaw).trim();
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    throw new HttpError(422, "Description must be at least 5 characters");
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(422, "Invalid request body");
  }

  const latitude = parseOptionalCoordinate(formData.get("latitude"), -90, 90);
  const longitude = parseOptionalCoordinate(formData.get("longitude"), -180, 180);

  const imageField = formData.get("image");
  let imageBytes: Uint8Array | null = null;
  let imageMime: string | null = null;

  if (isUploadFile(imageField)) {
    const buffer = new Uint8Array(await imageField.arrayBuffer());
    const validation = await validateEvidenceBytes(buffer, {
      maxBytes: resolveMaxEvidenceBytes(),
      declaredContentLength: imageField.size,
      declaredMimeType: imageField.type || null,
    });
    if (!validation.ok) {
      throw mapEvidenceValidationError(validation.code);
    }
    imageBytes = buffer;
    imageMime = validation.mimeType;
  }

  return {
    auth: authParsed.data,
    description,
    latitude,
    longitude,
    imageBytes,
    imageMime,
  };
}

export async function finalizeIntakeSubmit(
  input: {
    auth: z.infer<typeof IntakeAuthSchema>;
    description: string;
    latitude?: number | null;
    longitude?: number | null;
    imageBytes?: Uint8Array | null;
    imageMime?: string | null;
  },
  client: SupabaseClient = getAdminClient(),
  deps: {
    dispatchTriageAndWait?: typeof dispatchTriageAndWait;
  } = {},
): Promise<ReportSubmissionResponse> {
  await authorizeIntakeRequest(client, input.auth.report_id, input.auth.token);
  const row = await loadIntakeReportRow(client, input.auth.report_id);
  if (!row) {
    throw citizenStatusUnauthorized();
  }
  assertIntakeEligible(row);

  const description = input.description.trim();
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    throw new HttpError(422, "Description must be at least 5 characters");
  }

  let evidenceUri: string | null = null;
  const latitude = input.latitude ?? null;
  const longitude = input.longitude ?? null;

  try {
    if (input.imageBytes && input.imageMime) {
      const pipelineResult = await processAndStoreEvidence({
        client,
        reportId: input.auth.report_id,
        bytes: input.imageBytes,
        bucketName: EVIDENCE_BUCKET,
        maxBytes: resolveMaxEvidenceBytes(),
        declaredContentLength: input.imageBytes.byteLength,
        declaredMimeType: input.imageMime,
      });
      evidenceUri = pipelineResult.evidenceUri;
    }

    const evidencePath = evidenceUri
      ? formatEvidencePath(
          EVIDENCE_BUCKET,
          parseSupabaseEvidenceUri(evidenceUri).objectPath,
        )
      : null;

    const { error: updateError } = await client
      .from("reports")
      .update({
        description,
        latitude,
        longitude,
        evidence_path: evidencePath,
      })
      .eq("report_id", input.auth.report_id)
      .eq("triage_status", "pending");

    if (updateError) {
      throw updateError;
    }

    const runTriage = deps.dispatchTriageAndWait ?? dispatchTriageAndWait;
    try {
      await runTriage(input.auth.report_id, { client });
    } catch (triageError) {
      console.error(
        `finalizeIntakeSubmit: synchronous triage failed for ${input.auth.report_id}`,
        triageError,
      );
      enqueueTriageDispatch(input.auth.report_id);
    }

    const outcome = await buildIntakeTriageOutcome(client, input.auth.report_id);

    return {
      report_id: input.auth.report_id,
      access_token: input.auth.token,
      intake_status: "received",
      ...outcome,
    };
  } catch (error) {
    if (evidenceUri) {
      try {
        await deleteEvidenceByUri({ client, uri: evidenceUri });
      } catch {
        // Compensation delete is best-effort.
      }
    }

    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof EvidenceServiceError) {
      throw mapEvidenceServiceError(error);
    }

    throw new HttpError(502, "Report submission failed");
  }
}

export async function handleIntakeStartRequest(
  request: Request,
  options: {
    client?: SupabaseClient;
    rateLimitRequest?: RateLimitRequest;
  } = {},
): Promise<Response> {
  const rateLimitRequest: RateLimitRequest = options.rateLimitRequest ?? {
    headers: request.headers,
  };
  const rateLimit = enforceIntakeRateLimit(rateLimitRequest, "start");
  if (rateLimit) {
    return Response.json(
      { detail: rateLimit.detail },
      {
        status: rateLimit.status,
        headers: { "Retry-After": rateLimit.retryAfter },
      },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = IntakeStartSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  try {
    const payload = await startIntakeSession(parsed.data, options.client);
    return Response.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonErrorResponse(error);
    }
    return jsonErrorResponse(genericServiceFailure());
  }
}

export async function handleIntakeMessagesRequest(
  request: Request,
  options: {
    client?: SupabaseClient;
    rateLimitRequest?: RateLimitRequest;
  } = {},
): Promise<Response> {
  const rateLimitRequest: RateLimitRequest = options.rateLimitRequest ?? {
    headers: request.headers,
  };

  if (request.method === "GET") {
    const url = new URL(request.url);
    const parsed = IntakeAuthSchema.safeParse({
      report_id: url.searchParams.get("report_id"),
      token: url.searchParams.get("token"),
    });
    if (!parsed.success) {
      return Response.json({ detail: "Invalid request" }, { status: 422 });
    }

    const rateLimit = enforceIntakeRateLimit(rateLimitRequest, parsed.data.report_id);
    if (rateLimit) {
      return Response.json(
        { detail: rateLimit.detail },
        {
          status: rateLimit.status,
          headers: { "Retry-After": rateLimit.retryAfter },
        },
      );
    }

    try {
      const payload = await listIntakeMessages(parsed.data, options.client);
      return Response.json(payload, { status: 200 });
    } catch (error) {
      if (error instanceof HttpError) return jsonErrorResponse(error);
      return jsonErrorResponse(genericServiceFailure());
    }
  }

  const rateLimitBody = await request.clone().json().catch(() => null);
  const reportId =
    rateLimitBody && typeof rateLimitBody === "object" && "report_id" in rateLimitBody
      ? String((rateLimitBody as { report_id?: unknown }).report_id ?? "")
      : "";
  const rateLimit = enforceIntakeRateLimit(rateLimitRequest, reportId);
  if (rateLimit) {
    return Response.json(
      { detail: rateLimit.detail },
      {
        status: rateLimit.status,
        headers: { "Retry-After": rateLimit.retryAfter },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const parsed = IntakeSendSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  try {
    const payload = await sendIntakeMessage(parsed.data, options.client);
    return Response.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonErrorResponse(error);
    }
    return jsonErrorResponse(genericServiceFailure());
  }
}

export async function handleIntakeSubmitRequest(
  request: Request,
  options: {
    client?: SupabaseClient;
    rateLimitRequest?: RateLimitRequest;
  } = {},
): Promise<Response> {
  const rateLimitRequest: RateLimitRequest = options.rateLimitRequest ?? {
    headers: request.headers,
  };
  const rateLimit = enforceIntakeRateLimit(rateLimitRequest, "submit");
  if (rateLimit) {
    return Response.json(
      { detail: rateLimit.detail },
      {
        status: rateLimit.status,
        headers: { "Retry-After": rateLimit.retryAfter },
      },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return Response.json({ detail: "Invalid request body" }, { status: 422 });
      }

      const parsed = await parseIntakeSubmitFormData(formData);
      const payload = await finalizeIntakeSubmit(
        {
          auth: parsed.auth,
          description: parsed.description,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          imageBytes: parsed.imageBytes,
          imageMime: parsed.imageMime,
        },
        options.client,
      );
      return Response.json(payload, { status: 200 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ detail: "Invalid request body" }, { status: 422 });
    }

    const parsed = IntakeSubmitJsonSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ detail: "Invalid request body" }, { status: 422 });
    }

    const payload = await finalizeIntakeSubmit(
      {
        auth: { report_id: parsed.data.report_id, token: parsed.data.token },
        description: parsed.data.description,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
      },
      options.client,
    );
    return Response.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonErrorResponse(error);
    }
    return jsonErrorResponse(genericServiceFailure());
  }
}
