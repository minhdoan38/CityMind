import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type TriageAttemptRow = {
  attempt_id: string;
  run_id: string;
  attempt_number: number;
  model: string | null;
  prompt_version: string | null;
  raw_output: string | null;
  latency_ms: number | null;
  validation_errors: unknown;
  disposition: string;
  created_at: string;
};

export type TriageRunRow = {
  run_id: string;
  report_id: string;
  started_at: string;
  finished_at: string | null;
  final_disposition: string | null;
  prompt_version: string;
};

export type TriageConsoleCaseRow = {
  report_id: string;
  description: string | null;
  triage_status: string;
  category: string | null;
  runs: Array<TriageRunRow & { attempts: TriageAttemptRow[] }>;
};

const DEFAULT_RUN_LIMIT = 50;

export async function listTriageConsoleCases(
  client: SupabaseClient,
  options: { reportId?: string; runLimit?: number } = {},
): Promise<TriageConsoleCaseRow[]> {
  const runLimit = options.runLimit ?? DEFAULT_RUN_LIMIT;

  let runsQuery = client
    .from("triage_runs")
    .select("run_id, report_id, started_at, finished_at, final_disposition, prompt_version")
    .order("started_at", { ascending: false })
    .limit(runLimit);

  if (options.reportId?.trim()) {
    runsQuery = runsQuery.eq("report_id", options.reportId.trim());
  }

  const { data: runs, error: runsError } = await runsQuery;
  if (runsError) {
    throw runsError;
  }

  const runRows = (runs ?? []) as TriageRunRow[];
  if (!runRows.length) {
    return [];
  }

  const runIds = runRows.map((run) => run.run_id);
  const reportIds = [...new Set(runRows.map((run) => run.report_id))];

  const [{ data: attempts, error: attemptsError }, { data: reports, error: reportsError }] =
    await Promise.all([
      client
        .from("triage_attempts")
        .select(
          "attempt_id, run_id, attempt_number, model, prompt_version, raw_output, latency_ms, validation_errors, disposition, created_at",
        )
        .in("run_id", runIds)
        .order("created_at", { ascending: true }),
      client
        .from("reports")
        .select("report_id, description, triage_status, category")
        .in("report_id", reportIds),
    ]);

  if (attemptsError) {
    throw attemptsError;
  }
  if (reportsError) {
    throw reportsError;
  }

  const attemptsByRun = new Map<string, TriageAttemptRow[]>();
  for (const attempt of (attempts ?? []) as TriageAttemptRow[]) {
    const bucket = attemptsByRun.get(attempt.run_id) ?? [];
    bucket.push(attempt);
    attemptsByRun.set(attempt.run_id, bucket);
  }

  const reportById = new Map(
    (reports ?? []).map((row) => [
      String(row.report_id),
      {
        description: (row.description as string | null) ?? null,
        triage_status: String(row.triage_status ?? "pending"),
        category: (row.category as string | null) ?? null,
      },
    ]),
  );

  const cases = new Map<string, TriageConsoleCaseRow>();

  for (const run of runRows) {
    const meta = reportById.get(run.report_id);
    const existing = cases.get(run.report_id) ?? {
      report_id: run.report_id,
      description: meta?.description ?? null,
      triage_status: meta?.triage_status ?? "pending",
      category: meta?.category ?? null,
      runs: [],
    };

    existing.runs.push({
      ...run,
      attempts: attemptsByRun.get(run.run_id) ?? [],
    });
    cases.set(run.report_id, existing);
  }

  return [...cases.values()].sort((a, b) => {
    const aStarted = a.runs[0]?.started_at ?? "";
    const bStarted = b.runs[0]?.started_at ?? "";
    return bStarted.localeCompare(aStarted);
  });
}
