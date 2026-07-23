import type { SupabaseClient } from "@supabase/supabase-js";

export type ChatMessageRole = "user" | "assistant" | "system";

export type ChatMessageRow = {
  message_id: string;
  report_id: string;
  role: ChatMessageRole;
  content: string;
  created_at: string;
  model: string | null;
  latency_ms: number | null;
};

export async function listChatMessagesByReportId(
  client: SupabaseClient,
  reportId: string,
): Promise<ChatMessageRow[]> {
  const { data, error } = await client
    .from("chat_messages")
    .select("message_id, report_id, role, content, created_at, model, latency_ms")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    message_id: String(row.message_id),
    report_id: String(row.report_id),
    role: row.role as ChatMessageRole,
    content: String(row.content),
    created_at: String(row.created_at),
    model: (row.model as string | null) ?? null,
    latency_ms: row.latency_ms == null ? null : Number(row.latency_ms),
  }));
}

export async function insertChatMessage(
  client: SupabaseClient,
  input: {
    reportId: string;
    role: ChatMessageRole;
    content: string;
    model?: string | null;
    latencyMs?: number | null;
  },
): Promise<ChatMessageRow> {
  const { data, error } = await client
    .from("chat_messages")
    .insert({
      report_id: input.reportId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      latency_ms: input.latencyMs ?? null,
    })
    .select("message_id, report_id, role, content, created_at, model, latency_ms")
    .single();

  if (error) {
    throw error;
  }

  return {
    message_id: String(data.message_id),
    report_id: String(data.report_id),
    role: data.role as ChatMessageRole,
    content: String(data.content),
    created_at: String(data.created_at),
    model: (data.model as string | null) ?? null,
    latency_ms: data.latency_ms == null ? null : Number(data.latency_ms),
  };
}

export async function countChatMessagesLast24h(
  client: SupabaseClient,
  reportId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await client
    .from("chat_messages")
    .select("message_id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .gte("created_at", since);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
