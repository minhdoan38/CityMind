import "server-only";

import { buildChatCompletionsUrl, getServerEnv, type ServerEnv } from "@/server/config/env";
import { projectEvaluatorAnalysis } from "@/server/domain/analysis-projection";
import { resolvePlaybookId } from "@/server/routing/playbooks";
import type { ChatMessageRow } from "@/server/repositories/chat-messages";

export const COACH_SYSTEM_PROMPT = `You are a calm, practical self-help coach for CityMind citizens.
You help people follow safe, step-by-step guidance for minor community issues that were routed to self-help.
You provide advisory support only. You cannot change report status, routing, or officer decisions.
Do not contradict the routing destination or triage output supplied in the context.
If the citizen needs government follow-up, encourage them to use the escalate option instead of claiming a crew was dispatched.
Keep replies concise, actionable, and grounded only in the supplied report context.
Never invent facts, causes, or outcomes that are not supported by the context.`;

export type CoachReportContext = {
  reportId: string;
  routingDestination: string | null;
  category: string | null;
  observedFacts: string[];
  recommendedAction: string | null;
  playbookId: string | null;
};

export type CoachReply = {
  content: string;
  model: string;
  latencyMs: number;
};

type CoachDeps = {
  env?: ServerEnv;
  fetchImpl?: typeof fetch;
};

function buildCoachContextBlock(context: CoachReportContext): string {
  const facts =
    context.observedFacts.length > 0
      ? context.observedFacts.map((fact) => `- ${fact}`).join("\n")
      : "- No observed facts recorded.";
  const playbook = context.playbookId ?? "none";
  return [
    `report_id: ${context.reportId}`,
    `routing_destination: ${context.routingDestination ?? "unknown"}`,
    `category: ${context.category ?? "unknown"}`,
    `playbook_id: ${playbook}`,
    "observed_facts:",
    facts,
    `recommended_action: ${context.recommendedAction ?? "Await officer review."}`,
  ].join("\n");
}

function toProviderMessages(
  history: ChatMessageRow[],
  userMessage: string,
  context: CoachReportContext,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `${COACH_SYSTEM_PROMPT}\n\nReport context:\n${buildCoachContextBlock(context)}`,
    },
  ];

  for (const item of history) {
    if (item.role === "user" || item.role === "assistant") {
      messages.push({ role: item.role, content: item.content });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

export function buildCoachReportContext(row: Record<string, unknown>): CoachReportContext {
  const evaluator = projectEvaluatorAnalysis({
    category: (row.category as string | null) ?? null,
    severity: (row.severity as number | null) ?? null,
    confidence: (row.confidence as number | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    recommendation: (row.recommendation as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    estimated_impact: (row.estimated_impact as string | null) ?? null,
    evidence: (row.evidence as string[] | null) ?? null,
    uncertainty: (row.uncertainty as string[] | null) ?? null,
    observed_facts: (row.observed_facts as string[] | null) ?? null,
    inferences: (row.inferences as string[] | null) ?? null,
    unknowns: (row.unknowns as string[] | null) ?? null,
    severity_reason: (row.severity_reason as string | null) ?? null,
    priority_reason: (row.priority_reason as string | null) ?? null,
    recommended_action: (row.recommended_action as string | null) ?? null,
  });

  return {
    reportId: String(row.report_id ?? ""),
    routingDestination: (row.routing_destination as string | null) ?? null,
    category: evaluator.category,
    observedFacts: evaluator.observed_facts,
    recommendedAction: evaluator.recommended_action,
    playbookId: resolvePlaybookId(evaluator.category),
  };
}

export async function generateCoachReply(
  input: {
    context: CoachReportContext;
    history: ChatMessageRow[];
    userMessage: string;
  },
  deps: CoachDeps = {},
): Promise<CoachReply> {
  const env = deps.env ?? getServerEnv();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const endpoint = buildChatCompletionsUrl(env.AI_BASE_URL);
  const startedAt = Date.now();

  const response = await fetchImpl(endpoint, {
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
      messages: toProviderMessages(input.history, input.userMessage, input.context),
    }),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("coach_provider_error");
  }

  const payload = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("coach_empty_response");
  }

  return {
    content,
    model: payload.model ?? env.AI_MODEL,
    latencyMs: Date.now() - startedAt,
  };
}
