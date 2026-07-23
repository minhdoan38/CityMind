import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import { requireOfficerContext } from "@/server/officer/guard";
import {
  listTriageConsoleCases,
  type TriageConsoleCaseRow,
} from "@/server/repositories/triage-console";

export type TriageConsoleResponse = {
  cases: TriageConsoleCaseRow[];
  generated_at: string;
};

export async function loadOfficerTriageConsole(
  reportId?: string,
): Promise<TriageConsoleResponse> {
  const cases = await listTriageConsoleCases(getAdminClient(), {
    reportId,
  });

  return {
    cases,
    generated_at: new Date().toISOString(),
  };
}

export async function handleOfficerTriageConsoleRequest(
  request: Request,
): Promise<Response> {
  const auth = await requireOfficerContext();
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const reportId = url.searchParams.get("report_id")?.trim() || undefined;

  try {
    const payload = await loadOfficerTriageConsole(reportId);
    return Response.json(payload, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ detail: "Triage console lookup failed" }, { status: 502 });
  }
}
