import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getAdminClient } from "@/lib/supabase/admin";
import { buildCoachReportContext, generateCoachReply } from "@/server/ai/coach";
import { checkAiHealth } from "@/server/health/ai-readiness";
import {
  citizenStatusUnauthorized,
  genericServiceFailure,
  HttpError,
  jsonErrorResponse,
} from "@/server/http/errors";
import {
  countChatMessagesLast24h,
  insertChatMessage,
  listChatMessagesByReportId,
  type ChatMessageRow,
} from "@/server/repositories/chat-messages";
import { getAccessTokenByHash } from "@/server/repositories/reports";
import { hashAccessToken, tokenBindsReport } from "@/server/security/access-tokens";
import {
  enforceCoachRateLimit,
  type RateLimitRequest,
} from "@/server/security/rate-limit";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_MESSAGES_PER_DAY = 50;

const CoachAuthSchema = z.object({
  report_id: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
});

const CoachSendSchema = CoachAuthSchema.extend({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

type CoachReportRow = {
  report_id: string;
  triage_status: string;
  routing_destination: string | null;
  category: string | null;
  severity: number | null;
  confidence: number | null;
  summary: string | null;
  recommendation: string | null;
  priority: string | null;
  estimated_impact: string | null;
  evidence: string[] | null;
  uncertainty: string[] | null;
  observed_facts: string[] | null;
  inferences: string[] | null;
  unknowns: string[] | null;
  severity_reason: string | null;
  priority_reason: string | null;
  recommended_action: string | null;
};

function serializeMessage(row: ChatMessageRow) {
  return {
    message_id: row.message_id,
    role: row.role,
    content: row.content,
    created_at: row.created_at,
  };
}

async function authorizeCoachRequest(
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

async function loadCoachReportRow(
  client: SupabaseClient,
  reportId: string,
): Promise<CoachReportRow | null> {
  const { data, error } = await client
    .from("reports")
    .select(
      "report_id, triage_status, routing_destination, category, severity, confidence, summary, recommendation, priority, estimated_impact, evidence, uncertainty, observed_facts, inferences, unknowns, severity_reason, priority_reason, recommended_action",
    )
    .eq("report_id", reportId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return data as CoachReportRow;
}

function assertCoachEligible(row: CoachReportRow): void {
  if (row.triage_status !== "completed") {
    throw new HttpError(403, "Coach is not available until triage completes.");
  }
  if (row.routing_destination !== "self_help") {
    throw new HttpError(403, "Coach is only available for self-help reports.");
  }
}

export async function listCoachMessages(
  body: z.infer<typeof CoachAuthSchema>,
  client: SupabaseClient = getAdminClient(),
): Promise<{ messages: ReturnType<typeof serializeMessage>[] }> {
  await authorizeCoachRequest(client, body.report_id, body.token);
  const row = await loadCoachReportRow(client, body.report_id);
  if (!row) {
    throw citizenStatusUnauthorized();
  }
  assertCoachEligible(row);

  const messages = await listChatMessagesByReportId(client, body.report_id);
  return { messages: messages.map(serializeMessage) };
}

export async function sendCoachMessage(
  body: z.infer<typeof CoachSendSchema>,
  client: SupabaseClient = getAdminClient(),
): Promise<{
  assistant_message: ReturnType<typeof serializeMessage>;
  messages: ReturnType<typeof serializeMessage>[];
}> {
  const health = await checkAiHealth();
  if (health.body.status === "down") {
    throw new HttpError(503, "Coach is temporarily unavailable.");
  }

  await authorizeCoachRequest(client, body.report_id, body.token);
  const row = await loadCoachReportRow(client, body.report_id);
  if (!row) {
    throw citizenStatusUnauthorized();
  }
  assertCoachEligible(row);

  const count = await countChatMessagesLast24h(client, body.report_id);
  if (count >= MAX_MESSAGES_PER_DAY) {
    throw new HttpError(429, "Coach message limit reached for this report.");
  }

  const history = await listChatMessagesByReportId(client, body.report_id);
  await insertChatMessage(client, {
    reportId: body.report_id,
    role: "user",
    content: body.message.trim(),
  });

  const reply = await generateCoachReply({
    context: buildCoachReportContext(row),
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

export async function handleCitizenCoachRequest(
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
    const parsed = CoachAuthSchema.safeParse({
      report_id: url.searchParams.get("report_id"),
      token: url.searchParams.get("token"),
    });
    if (!parsed.success) {
      return Response.json({ detail: "Invalid request" }, { status: 422 });
    }

    const rateLimit = enforceCoachRateLimit(rateLimitRequest, parsed.data.report_id);
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
      const payload = await listCoachMessages(parsed.data, options.client);
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
  const rateLimit = enforceCoachRateLimit(rateLimitRequest, reportId);
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

  const parsed = CoachSendSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  try {
    const payload = await sendCoachMessage(parsed.data, options.client);
    return Response.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonErrorResponse(error);
    }
    return jsonErrorResponse(genericServiceFailure());
  }
}
