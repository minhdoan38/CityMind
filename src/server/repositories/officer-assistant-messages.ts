import type { SupabaseClient } from "@supabase/supabase-js";

export type OfficerAssistantMessageRole = "user" | "assistant" | "system";

export type OfficerAssistantMessageRow = {
  message_id: string;
  officer_user_id: string;
  report_id: string | null;
  role: OfficerAssistantMessageRole;
  content: string;
  created_at: string;
  model: string | null;
  latency_ms: number | null;
};

export async function listOfficerAssistantMessages(
  client: SupabaseClient,
  officerUserId: string,
): Promise<OfficerAssistantMessageRow[]> {
  const { data, error } = await client
    .from("officer_assistant_messages")
    .select(
      "message_id, officer_user_id, report_id, role, content, created_at, model, latency_ms",
    )
    .eq("officer_user_id", officerUserId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    message_id: String(row.message_id),
    officer_user_id: String(row.officer_user_id),
    report_id: row.report_id == null ? null : String(row.report_id),
    role: row.role as OfficerAssistantMessageRole,
    content: String(row.content),
    created_at: String(row.created_at),
    model: (row.model as string | null) ?? null,
    latency_ms: row.latency_ms == null ? null : Number(row.latency_ms),
  }));
}

export async function insertOfficerAssistantMessage(
  client: SupabaseClient,
  input: {
    officerUserId: string;
    role: OfficerAssistantMessageRole;
    content: string;
    reportId?: string | null;
    model?: string | null;
    latencyMs?: number | null;
  },
): Promise<OfficerAssistantMessageRow> {
  const { data, error } = await client
    .from("officer_assistant_messages")
    .insert({
      officer_user_id: input.officerUserId,
      report_id: input.reportId ?? null,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      latency_ms: input.latencyMs ?? null,
    })
    .select(
      "message_id, officer_user_id, report_id, role, content, created_at, model, latency_ms",
    )
    .single();

  if (error) {
    throw error;
  }

  return {
    message_id: String(data.message_id),
    officer_user_id: String(data.officer_user_id),
    report_id: data.report_id == null ? null : String(data.report_id),
    role: data.role as OfficerAssistantMessageRole,
    content: String(data.content),
    created_at: String(data.created_at),
    model: (data.model as string | null) ?? null,
    latency_ms: data.latency_ms == null ? null : Number(data.latency_ms),
  };
}
