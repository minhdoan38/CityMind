import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getAdminClient } from "@/lib/supabase/admin";
import {
  citizenStatusUnauthorized,
  genericServiceFailure,
  HttpError,
  jsonErrorResponse,
} from "@/server/http/errors";
import {
  getAccessTokenByHash,
  getCitizenStatus,
  type CitizenStatusHistoryItem,
  type CitizenStatusRawPayload,
} from "@/server/repositories/reports";
import { hashAccessToken, tokenBindsReport } from "@/server/security/access-tokens";
import {
  enforceStatusRateLimit,
  type RateLimitRequest,
} from "@/server/security/rate-limit";

const CitizenStatusRequestSchema = z.object({
  report_id: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
});

export type CitizenStatusRequest = z.infer<typeof CitizenStatusRequestSchema>;

export type CitizenServiceStep =
  | "received"
  | "ai_review_pending"
  | "officer_review"
  | "resolved"
  | "rejected"
  | "automated_review_unavailable";

export type CitizenStatusResponse = {
  report_id: string;
  received_at: string;
  triage_status: string;
  service_step: CitizenServiceStep;
  status: string;
  category: string | null;
  severity: number | null;
  priority: string | null;
  summary: string | null;
  recommendation: string | null;
  history: CitizenStatusHistoryItem[];
};

export function projectCitizenTriageView(
  row: CitizenStatusRawPayload,
): CitizenStatusResponse {
  const history = row.history.map((item) => ({
    status: item.status,
    note: item.note,
    created_at: item.created_at,
  }));

  const base = {
    report_id: row.report_id,
    received_at: row.received_at,
    triage_status: row.triage_status,
    status: row.status,
    history,
  };

  if (row.triage_status === "pending" || row.triage_status === "processing") {
    return {
      ...base,
      service_step: "ai_review_pending",
      category: null,
      severity: null,
      priority: null,
      summary: null,
      recommendation: null,
    };
  }

  if (row.triage_status === "failed" || row.triage_status === "manual_review") {
    return {
      ...base,
      service_step: "automated_review_unavailable",
      category: null,
      severity: null,
      priority: null,
      summary: null,
      recommendation: null,
    };
  }

  const serviceStep: CitizenServiceStep =
    row.status === "resolved"
      ? "resolved"
      : row.status === "rejected"
        ? "rejected"
        : "officer_review";

  return {
    ...base,
    service_step: serviceStep,
    category: row.category,
    severity: row.severity,
    priority: row.priority,
    summary: row.summary,
    recommendation: row.recommendation,
  };
}

export async function lookupCitizenStatus(
  body: CitizenStatusRequest,
  client: SupabaseClient = getAdminClient(),
): Promise<CitizenStatusResponse> {
  const tokenHash = hashAccessToken(body.token);
  const tokenRow = await getAccessTokenByHash(client, tokenHash);
  if (!tokenBindsReport(tokenRow, body.report_id)) {
    throw citizenStatusUnauthorized();
  }

  const payload = await getCitizenStatus(client, body.report_id);
  if (!payload) {
    throw citizenStatusUnauthorized();
  }

  return projectCitizenTriageView(payload);
}

export async function handleCitizenStatusRequest(
  request: Request,
  options: {
    client?: SupabaseClient;
    rateLimitRequest?: RateLimitRequest;
  } = {},
): Promise<Response> {
  const rateLimitRequest: RateLimitRequest = options.rateLimitRequest ?? {
    headers: request.headers,
  };
  const rateLimit = enforceStatusRateLimit(rateLimitRequest);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const parsed = CitizenStatusRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  try {
    const payload = await lookupCitizenStatus(parsed.data, options.client);
    return Response.json(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonErrorResponse(error);
    }
    return jsonErrorResponse(genericServiceFailure());
  }
}
