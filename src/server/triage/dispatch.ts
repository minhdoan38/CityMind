import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminClient } from "@/lib/supabase/admin";
import { getInternalBaseUrl, getServerEnv } from "@/server/config/env";
import { verifyInternalTriageRequest } from "@/server/security/internal-auth";
import { runTriageForReport } from "./service";

export type DispatchResult =
  | {
      accepted: true;
      reportId: string;
      disposition: "accepted" | "already_running_or_done";
    }
  | {
      accepted: false;
      reportId: string;
      reason:
        | "not_found"
        | "already_running_or_done"
        | "not_due"
        | "ineligible_status";
    };

export type DispatchDeps = {
  client: SupabaseClient;
  runTriage?: typeof runTriageForReport;
  /** Officer manual dispatch bypasses retry backoff windows. */
  force?: boolean;
  /** Await triage completion instead of fire-and-forget. */
  wait?: boolean;
};

type TriageRow = {
  report_id: string;
  triage_status: string;
  triage_next_attempt_at: string | null;
};

const ELIGIBLE_STATUSES = new Set(["pending", "failed", "retry"]);

export async function dispatchTriage(
  reportId: string,
  deps: DispatchDeps = { client: getAdminClient() },
): Promise<DispatchResult> {
  const { data, error } = await deps.client
    .from("reports")
    .select("report_id, triage_status, triage_next_attempt_at")
    .eq("report_id", reportId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { accepted: false, reportId, reason: "not_found" };
  }

  const row = data as TriageRow;

  if (row.triage_status === "processing" || row.triage_status === "completed") {
    return {
      accepted: true,
      reportId,
      disposition: "already_running_or_done",
    };
  }

  if (!ELIGIBLE_STATUSES.has(row.triage_status)) {
    return {
      accepted: false,
      reportId,
      reason: "ineligible_status",
    };
  }

  if (!deps.force && row.triage_next_attempt_at) {
    const dueAt = new Date(row.triage_next_attempt_at).getTime();
    if (Number.isFinite(dueAt) && dueAt > Date.now()) {
      return { accepted: false, reportId, reason: "not_due" };
    }
  }

  const { data: claimed, error: claimError } = await deps.client
    .from("reports")
    .update({
      triage_status: "processing",
      triage_claimed_at: new Date().toISOString(),
    })
    .eq("report_id", reportId)
    .in("triage_status", ["pending", "failed", "retry"])
    .select("report_id")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claimed) {
    return {
      accepted: true,
      reportId,
      disposition: "already_running_or_done",
    };
  }

  const runTriage = deps.runTriage ?? runTriageForReport;
  if (deps.wait) {
    try {
      await runTriage(reportId, { client: deps.client });
    } catch (dispatchError) {
      console.error(`dispatchTriage: failed report ${reportId}`, dispatchError);
    }
  } else {
    void runTriage(reportId, { client: deps.client }).catch((dispatchError) => {
      console.error(`dispatchTriage: failed report ${reportId}`, dispatchError);
    });
  }

  return {
    accepted: true,
    reportId,
    disposition: "accepted",
  };
}

/** Run evaluator triage synchronously after citizen intake (blocks until AI finishes or errors). */
export async function dispatchTriageAndWait(
  reportId: string,
  deps: DispatchDeps = { client: getAdminClient() },
): Promise<void> {
  const client = deps.client;
  const deadline = Date.now() + 55_000;
  const terminal = new Set(["completed", "failed", "manual_review"]);

  while (Date.now() < deadline) {
    await dispatchTriage(reportId, { ...deps, client, force: true, wait: true });

    const { data, error } = await client
      .from("reports")
      .select("triage_status")
      .eq("report_id", reportId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const status = data?.triage_status;
    if (typeof status === "string" && terminal.has(status)) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
  }
}

export async function handleInternalTriageDispatch(
  request: Request,
  reportId: string,
  deps: DispatchDeps = { client: getAdminClient() },
): Promise<Response> {
  const env = getServerEnv();
  if (!env.INTERNAL_TRIAGE_SECRET) {
    return Response.json(
      { detail: "Internal triage dispatch is not configured" },
      { status: 503 },
    );
  }

  if (!verifyInternalTriageRequest(request, env)) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const result = await dispatchTriage(reportId, deps);

  if (!result.accepted && result.reason === "not_found") {
    return Response.json({ detail: "Report not found" }, { status: 404 });
  }

  if (!result.accepted) {
    return Response.json(
      {
        report_id: reportId,
        disposition: "skipped",
        reason: result.reason,
      },
      { status: 202 },
    );
  }

  return Response.json(
    {
      report_id: reportId,
      disposition: result.disposition,
    },
    { status: 202 },
  );
}

export function enqueueTriageDispatch(reportId: string): void {
  const secret = process.env.INTERNAL_TRIAGE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return;
  }

  const url = `${getInternalBaseUrl()}/api/internal/triage/${encodeURIComponent(reportId)}`;
  void fetch(url, {
    method: "POST",
    headers: {
      "X-CityMind-Internal-Key": secret,
    },
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined);
}
