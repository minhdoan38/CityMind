import "server-only";

import { z } from "zod";

import { getAdminClient } from "@/lib/supabase/admin";
import { requireOfficerContext } from "@/server/officer/guard";
import { dispatchTriage } from "@/server/triage/dispatch";

const ELIGIBLE_STATUSES = new Set(["pending", "failed", "retry"]);
const MAX_BULK_REPORTS = 25;

const BulkTriageSchema = z.object({
  report_ids: z.array(z.string().min(1)).min(1).max(MAX_BULK_REPORTS),
});

export async function handleOfficerTriageDispatchRequest(
  reportId: string,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) {
    return auth.response;
  }

  const { data, error } = await getAdminClient()
    .from("reports")
    .select("report_id, triage_status")
    .eq("report_id", reportId)
    .maybeSingle();

  if (error) {
    return Response.json({ detail: "Dispatch lookup failed" }, { status: 502 });
  }

  if (!data) {
    return Response.json({ detail: "Report not found" }, { status: 404 });
  }

  const triageStatus = String(data.triage_status);
  if (triageStatus === "completed") {
    return Response.json(
      { detail: "Triage already completed for this report" },
      { status: 409 },
    );
  }

  if (triageStatus === "processing") {
    const { error: resetError } = await getAdminClient()
      .from("reports")
      .update({
        triage_status: "pending",
        triage_claimed_at: null,
      })
      .eq("report_id", reportId)
      .eq("triage_status", "processing");

    if (resetError) {
      return Response.json({ detail: "Dispatch reset failed" }, { status: 502 });
    }
  } else if (!ELIGIBLE_STATUSES.has(triageStatus)) {
    return Response.json(
      {
        detail: `Report triage_status '${triageStatus}' is not eligible for manual dispatch`,
      },
      { status: 409 },
    );
  }

  const result = await dispatchTriage(reportId, {
    client: getAdminClient(),
    force: true,
  });

  if (!result.accepted && result.reason === "not_found") {
    return Response.json({ detail: "Report not found" }, { status: 404 });
  }

  return Response.json(
    {
      report_id: reportId,
      disposition: result.accepted ? result.disposition : "skipped",
      reason: result.accepted ? undefined : result.reason,
    },
    { status: 202 },
  );
}

export async function handleOfficerBulkTriageDispatchRequest(
  request: Request,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const parsed = BulkTriageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: "Invalid request body" }, { status: 422 });
  }

  const accepted: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const reportId of parsed.data.report_ids) {
    const { data, error } = await getAdminClient()
      .from("reports")
      .select("report_id, triage_status")
      .eq("report_id", reportId)
      .maybeSingle();

    if (error) {
      skipped.push({ id: reportId, reason: "lookup_failed" });
      continue;
    }

    if (!data) {
      skipped.push({ id: reportId, reason: "not_found" });
      continue;
    }

    const triageStatus = String(data.triage_status);
    if (triageStatus === "completed") {
      skipped.push({ id: reportId, reason: "already_completed" });
      continue;
    }

    if (triageStatus === "processing") {
      const { error: resetError } = await getAdminClient()
        .from("reports")
        .update({
          triage_status: "pending",
          triage_claimed_at: null,
        })
        .eq("report_id", reportId)
        .eq("triage_status", "processing");

      if (resetError) {
        skipped.push({ id: reportId, reason: "reset_failed" });
        continue;
      }
    } else if (!ELIGIBLE_STATUSES.has(triageStatus)) {
      skipped.push({ id: reportId, reason: "ineligible_status" });
      continue;
    }

    const result = await dispatchTriage(reportId, {
      client: getAdminClient(),
      force: true,
    });
    if (result.accepted) {
      accepted.push(reportId);
    } else {
      skipped.push({ id: reportId, reason: result.reason });
    }
  }

  return Response.json({ accepted, skipped }, { status: 202 });
}
