import "server-only";

import {
  AnalysisProviderError,
  completeConversationalChat,
  type ConversationalChatMessage,
} from "@/server/ai/openai-compatible";
import type { ServerEnv } from "@/server/config/env";
import { projectEvaluatorAnalysis } from "@/server/domain/analysis-projection";
import type { OfficerReport } from "@/server/repositories/reports";

export const OFFICER_ASSISTANT_SYSTEM_PROMPT = `You are CityMind's advisory assistant for municipal officers reviewing citizen incident reports.

Your role:
- Help officers use the dashboard, interpret AI triage fields (category, severity, priority, confidence), and follow evidence-based review practices.
- Explain that AI output is decision support only; officers retain final authority over status changes.
- Encourage opening a report's detail page to review structured analysis and evidence before resolving or rejecting.
- Keep answers concise (2–4 sentences unless the officer asks for more detail).

You must NOT:
- Claim to approve, reject, or change report status on the officer's behalf.
- Invent report-specific facts (IDs, locations, citizen details) you were not given.
- Present AI triage as autonomous or binding.

If asked about a specific report you do not have context for, direct the officer to open that report in the dashboard.`;

export type OfficerAssistantTurn = {
  role: "user" | "assistant";
  content: string;
};

export type OfficerReportContext = {
  reportId: string;
  status: string;
  triageStatus: string;
  routingDestination: string | null;
  category: string | null;
  severity: number | null;
  priority: string | null;
  observedFacts: string[];
};

export type OfficerAssistantReply = {
  content: string;
  model: string;
  latencyMs: number;
};

function buildOfficerContextBlock(context: OfficerReportContext): string {
  const facts =
    context.observedFacts.length > 0
      ? context.observedFacts.map((fact) => `- ${fact}`).join("\n")
      : "- No observed facts recorded.";
  return [
    `report_id: ${context.reportId}`,
    `status: ${context.status}`,
    `triage_status: ${context.triageStatus}`,
    `routing_destination: ${context.routingDestination ?? "unknown"}`,
    `category: ${context.category ?? "unknown"}`,
    `severity: ${context.severity ?? "unknown"}`,
    `priority: ${context.priority ?? "unknown"}`,
    "observed_facts:",
    facts,
  ].join("\n");
}

export function buildOfficerReportContext(report: OfficerReport): OfficerReportContext {
  const evaluator = projectEvaluatorAnalysis({
    category: report.category ?? null,
    severity: report.severity ?? null,
    confidence: report.confidence ?? null,
    summary: report.summary ?? null,
    recommendation: report.recommendation ?? null,
    priority: report.priority ?? null,
    estimated_impact: report.estimated_impact ?? null,
    evidence: report.evidence ?? null,
    uncertainty: report.uncertainty ?? null,
  });

  return {
    reportId: report.report_id,
    status: report.status,
    triageStatus: report.triage_status,
    routingDestination: report.routing_destination ?? null,
    category: evaluator.category,
    severity: evaluator.severity,
    priority: evaluator.priority,
    observedFacts: evaluator.observed_facts,
  };
}

export async function generateOfficerAssistantReply(
  env: ServerEnv,
  input: {
    message: string;
    history: OfficerAssistantTurn[];
    reportContext?: OfficerReportContext | null;
  },
  options: { fetchImpl?: typeof fetch } = {},
): Promise<OfficerAssistantReply> {
  const systemContent = input.reportContext
    ? `${OFFICER_ASSISTANT_SYSTEM_PROMPT}\n\nReport context:\n${buildOfficerContextBlock(input.reportContext)}`
    : OFFICER_ASSISTANT_SYSTEM_PROMPT;

  const messages: ConversationalChatMessage[] = [
    { role: "system", content: systemContent },
    ...input.history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: input.message },
  ];

  try {
    const result = await completeConversationalChat(
      { env, fetchImpl: options.fetchImpl },
      messages,
    );
    return {
      content: result.content,
      model: result.lineage.responseModel,
      latencyMs: result.lineage.latencyMs,
    };
  } catch (error) {
    if (error instanceof AnalysisProviderError) {
      throw error;
    }
    throw new AnalysisProviderError("invalid_response");
  }
}
