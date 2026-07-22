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
  escalateReportToGovernment,
  getAccessTokenByHash,
} from "@/server/repositories/reports";
import { hashAccessToken, tokenBindsReport } from "@/server/security/access-tokens";
import {
  enforceStatusRateLimit,
  type RateLimitRequest,
} from "@/server/security/rate-limit";

const CitizenEscalateRequestSchema = z.object({
  report_id: z.string().min(1).max(64),
  token: z.string().min(1).max(128),
});

export type CitizenEscalateRequest = z.infer<typeof CitizenEscalateRequestSchema>;

export async function escalateCitizenReport(
  body: CitizenEscalateRequest,
  client: SupabaseClient = getAdminClient(),
): Promise<{ ok: true; routing_destination: "government" }> {
  const tokenHash = hashAccessToken(body.token);
  const tokenRow = await getAccessTokenByHash(client, tokenHash);
  if (!tokenBindsReport(tokenRow, body.report_id)) {
    throw citizenStatusUnauthorized();
  }

  await escalateReportToGovernment(client, {
    reportId: body.report_id,
    tokenHash,
  });

  return { ok: true, routing_destination: "government" };
}

export async function handleCitizenEscalateRequest(
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

  const parsed = CitizenEscalateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  try {
    const payload = await escalateCitizenReport(parsed.data, options.client);
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
