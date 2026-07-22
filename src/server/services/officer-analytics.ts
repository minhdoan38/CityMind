import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AnalyticsResponse } from "@/components/analytics/types";
import { HttpError, jsonErrorResponse } from "@/server/http/errors";
import { requireOfficerContext } from "@/server/officer/guard";
import {
  fetchOfficerAnalytics,
  fetchPublicStats,
  type PublicStatsResponse,
  validateAnalyticsRange,
} from "@/server/repositories/analytics";
import {
  enforcePublicStatsRateLimit,
  type RateLimitRequest,
} from "@/server/security/rate-limit";

function queryErrorResponse(message: string): Response {
  return Response.json({ detail: message }, { status: 502 });
}

export async function handleOfficerAnalyticsRequest(
  request: Request,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const dateFrom = searchParams.get("from")?.trim() ?? "";
  const dateTo = searchParams.get("to")?.trim() ?? "";

  if (!dateFrom || !dateTo) {
    return Response.json({ detail: "from and to are required" }, { status: 422 });
  }

  try {
    validateAnalyticsRange(dateFrom, dateTo);
    const data = await fetchOfficerAnalytics(
      auth.context.client,
      dateFrom,
      dateTo,
    );
    return Response.json(data);
  } catch (error) {
    if (error instanceof RangeError) {
      return Response.json({ detail: error.message }, { status: 422 });
    }
    if (error instanceof HttpError) return jsonErrorResponse(error);
    return queryErrorResponse(
      error instanceof Error ? error.message : "Analytics query failed",
    );
  }
}

export async function handlePublicStatsRequest(
  request: Request,
): Promise<Response> {
  const rateLimitRequest: RateLimitRequest = { headers: request.headers };
  const rateLimit = enforcePublicStatsRateLimit(rateLimitRequest);
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
    const data = await fetchPublicStats(getAdminClient());
    return Response.json(data satisfies PublicStatsResponse);
  } catch {
    return queryErrorResponse("Public stats unavailable");
  }
}

export async function loadOfficerAnalytics(
  dateFrom: string,
  dateTo: string,
): Promise<{ data: AnalyticsResponse | null; error: "load" | "api" | null }> {
  try {
    validateAnalyticsRange(dateFrom, dateTo);
    const client = await createClient();
    const data = await fetchOfficerAnalytics(client, dateFrom, dateTo);
    return { data, error: null };
  } catch (error) {
    if (error instanceof RangeError) {
      return { data: null, error: "load" };
    }
    return { data: null, error: "api" };
  }
}

export async function loadPublicStats(): Promise<PublicStatsResponse | null> {
  try {
    return await fetchPublicStats(getAdminClient());
  } catch {
    return null;
  }
}
