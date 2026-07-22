import "server-only";

import { z } from "zod";

import { getAdminClient } from "@/lib/supabase/admin";
import {
  buildOfficerReportContext,
  generateOfficerAssistantReply,
} from "@/server/ai/officer-assistant";
import { AnalysisProviderError } from "@/server/ai/openai-compatible";
import { getServerEnv } from "@/server/config/env";
import { checkAiHealth } from "@/server/health/ai-readiness";
import { requireOfficerContext } from "@/server/officer/guard";
import {
  insertOfficerAssistantMessage,
  listOfficerAssistantMessages,
  type OfficerAssistantMessageRow,
} from "@/server/repositories/officer-assistant-messages";
import { getOfficerReport } from "@/server/repositories/reports";
import {
  loadRateLimitSettings,
  SlidingWindowLimiter,
  type RateLimitRequest,
} from "@/server/security/rate-limit";

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_TURNS = 12;
const OFFICER_ASSISTANT_RATE_LIMIT = 20;

const OfficerAssistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  report_id: z.string().min(1).max(64).optional(),
});

export const officerAssistantLimiter = new SlidingWindowLimiter();

export function resetOfficerAssistantLimiter(): void {
  officerAssistantLimiter.clear();
}

function enforceOfficerAssistantRateLimit(
  request: RateLimitRequest,
  officerId: string,
): Response | null {
  const settings = loadRateLimitSettings();
  const limit = settings.reportRateLimitPerMinute > 0
    ? Math.min(settings.reportRateLimitPerMinute, OFFICER_ASSISTANT_RATE_LIMIT)
    : OFFICER_ASSISTANT_RATE_LIMIT;

  const key = `officer-assistant:${officerId}`;
  if (!officerAssistantLimiter.allow(key, limit)) {
    return Response.json(
      { detail: "Too many assistant requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  return null;
}

function serializeMessage(row: OfficerAssistantMessageRow) {
  return {
    message_id: row.message_id,
    role: row.role,
    content: row.content,
    created_at: row.created_at,
  };
}

function toAssistantTurns(rows: OfficerAssistantMessageRow[]) {
  return rows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .slice(-MAX_HISTORY_TURNS)
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));
}

export async function handleOfficerAssistantListRequest(
  request: Request,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) {
    return auth.response;
  }

  const rateLimited = enforceOfficerAssistantRateLimit(
    { headers: request.headers },
    auth.context.session.userId,
  );
  if (rateLimited) {
    return rateLimited;
  }

  const admin = getAdminClient();
  const messages = await listOfficerAssistantMessages(
    admin,
    auth.context.session.userId,
  );

  return Response.json({
    messages: messages.map(serializeMessage),
  });
}

export async function handleOfficerAssistantMessageRequest(
  request: Request,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) {
    return auth.response;
  }

  const rateLimited = enforceOfficerAssistantRateLimit(
    { headers: request.headers },
    auth.context.session.userId,
  );
  if (rateLimited) {
    return rateLimited;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const parsed = OfficerAssistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const env = getServerEnv();
  const health = await checkAiHealth(env);
  if (health.body.status === "down") {
    return Response.json(
      { detail: "AI assistant is temporarily unavailable." },
      { status: 503 },
    );
  }

  const officerUserId = auth.context.session.userId;
  const admin = getAdminClient();
  const persisted = await listOfficerAssistantMessages(admin, officerUserId);
  const history = toAssistantTurns(persisted);

  let reportContext = null;
  const reportId = parsed.data.report_id?.trim();
  if (reportId) {
    const report = await getOfficerReport(auth.context.client, reportId);
    if (!report) {
      return Response.json({ detail: "Report not found." }, { status: 404 });
    }
    reportContext = buildOfficerReportContext(report);
  }

  try {
    await insertOfficerAssistantMessage(admin, {
      officerUserId,
      role: "user",
      content: parsed.data.message,
      reportId: reportId ?? null,
    });

    const reply = await generateOfficerAssistantReply(env, {
      message: parsed.data.message,
      history,
      reportContext,
    });

    await insertOfficerAssistantMessage(admin, {
      officerUserId,
      role: "assistant",
      content: reply.content,
      reportId: reportId ?? null,
      model: reply.model,
      latencyMs: reply.latencyMs,
    });

    const messages = await listOfficerAssistantMessages(admin, officerUserId);
    const assistantMessage = messages.at(-1);

    return Response.json({
      assistant_message: assistantMessage
        ? serializeMessage(assistantMessage)
        : {
            role: "assistant" as const,
            content: reply.content,
            message_id: "",
            created_at: new Date().toISOString(),
          },
      messages: messages.map(serializeMessage),
    });
  } catch (error) {
    if (error instanceof AnalysisProviderError) {
      return Response.json(
        { detail: "Assistant request failed. Try again later." },
        { status: 502 },
      );
    }
    return Response.json({ detail: "Assistant request failed." }, { status: 502 });
  }
}
