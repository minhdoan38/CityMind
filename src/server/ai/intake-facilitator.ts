import "server-only";

import { buildChatCompletionsUrl, getServerEnv } from "@/server/config/env";
import type { ChatMessageRow } from "@/server/repositories/chat-messages";

export const INTAKE_FACILITATOR_SYSTEM_PROMPT = `You are a calm, helpful intake facilitator for CityMind citizens reporting urban community issues.
Your role is to conversationally collect: (1) a clear description of the incident, (2) optional location details, and (3) whether they can attach a photo.
Respond in the same language the citizen uses (Vietnamese or English).
Never classify incidents, assign severity, prioritize, or route to government — triage happens only after they submit the report.
Keep replies concise, friendly, and focused on gathering missing details.
Do not claim a report was filed or a crew was dispatched — submission is a separate step.`;

export type FacilitatorReply = {
  content: string;
  model: string;
  latencyMs: number;
};

function toFacilitatorMessages(
  history: ChatMessageRow[],
  userMessage: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: INTAKE_FACILITATOR_SYSTEM_PROMPT },
  ];

  for (const item of history) {
    if (item.role === "user" || item.role === "assistant") {
      messages.push({ role: item.role, content: item.content });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

export async function generateFacilitatorReply(input: {
  history: ChatMessageRow[];
  userMessage: string;
}): Promise<FacilitatorReply> {
  const env = getServerEnv();
  const endpoint = buildChatCompletionsUrl(env.AI_BASE_URL);
  const startedAt = Date.now();

  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(Math.min(env.AI_TIMEOUT_MS, 60_000)),
    headers: {
      Authorization: `Bearer ${env.THIRD_PARTY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      temperature: 0.2,
      max_tokens: 800,
      stream: false,
      messages: toFacilitatorMessages(input.history, input.userMessage),
    }),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("intake_facilitator_provider_error");
  }

  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("intake_facilitator_empty_response");
  }

  return {
    content,
    model: payload.model ?? env.AI_MODEL,
    latencyMs: Date.now() - startedAt,
  };
}
