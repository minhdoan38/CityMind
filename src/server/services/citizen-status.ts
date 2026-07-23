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
import { resolvePlaybookId } from "@/server/routing/playbooks";
import { resolveGuidanceStatusForReport } from "@/server/routing/apply-routing";
import { resolveGuidanceScript } from "@/server/domain/guidance-resolver";
import type { HanoiSeverity } from "@/server/domain/hanoi-analysis";

const CitizenStatusRequestSchema = z.object({
  report_id: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
});

export type CitizenStatusRequest = z.infer<typeof CitizenStatusRequestSchema>;

export type CitizenServiceStep =
  | "received"
  | "ai_review_pending"
  | "self_help_guidance"
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
  playbook_id?: string | null;
  can_escalate?: boolean;
  guidance_script?: string | null;
  guidance_status?: "script_ready" | "generate_later" | null;
  allowed_actions?: string[];
  prohibited_actions?: string[];
};

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function projectCitizenGuidanceFields(row: CitizenStatusRawPayload): {
  guidance_script: string | null;
  guidance_status: "script_ready" | "generate_later" | null;
  allowed_actions: string[];
  prohibited_actions: string[];
} {
  const guidanceStatus = resolveGuidanceStatusForReport({
    handling_type: row.handling_type ?? null,
    guidance_code: row.guidance_code ?? null,
    severity_label: row.severity_label ?? null,
    description: row.description ?? null,
  });

  if (guidanceStatus !== "script_ready") {
    return {
      guidance_script: null,
      guidance_status: guidanceStatus,
      allowed_actions: [],
      prohibited_actions: [],
    };
  }

  if (
    row.handling_type !== 1 &&
    row.handling_type !== 2 &&
    row.handling_type !== 3
  ) {
    return {
      guidance_script: null,
      guidance_status: guidanceStatus,
      allowed_actions: [],
      prohibited_actions: [],
    };
  }

  const resolution = resolveGuidanceScript({
    guidance_code: row.guidance_code ?? "",
    handling_type: row.handling_type,
    severity: (row.severity_label ?? "low") as HanoiSeverity,
    report_text: row.description ?? "",
  });

  if (resolution.status !== "script_ready") {
    return {
      guidance_script: null,
      guidance_status: "generate_later",
      allowed_actions: [],
      prohibited_actions: [],
    };
  }

  return {
    guidance_script: resolution.text,
    guidance_status: "script_ready",
    allowed_actions: parseStringArray(row.allowed_actions),
    prohibited_actions: parseStringArray(row.prohibited_actions),
  };
}

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

  if (
    row.triage_status === "pending" ||
    row.triage_status === "processing" ||
    row.triage_status === "retry"
  ) {
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

  if (
    row.routing_destination === "self_help" &&
    row.status !== "resolved" &&
    row.status !== "rejected"
  ) {
    const guidance = projectCitizenGuidanceFields(row);
    return {
      ...base,
      service_step: "self_help_guidance",
      category: row.category,
      severity: row.severity,
      priority: row.priority,
      summary: row.summary,
      recommendation: row.recommendation,
      playbook_id: resolvePlaybookId(row.category),
      can_escalate: true,
      ...guidance,
    };
  }

  const guidance = projectCitizenGuidanceFields(row);

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
    ...guidance,
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
