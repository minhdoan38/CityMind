import "server-only";

import {
  ReportAnalysisSchema,
  type ReportAnalysis,
} from "../domain/report-analysis";
import { validateAnalysisPolicy } from "../validation/analysis-policy";
import { buildChatCompletionsUrl, type ServerEnv } from "../config/env";
import type {
  AnalysisInput,
  AnalysisProvider,
  AnalysisResult,
  SupportedImageMimeType,
} from "./provider";

export const SYSTEM_INSTRUCTION = `You analyze urban incident reports for triage support.
Return evidence-based output only. Do not invent facts not visible in the image or text.
Severity scale: 1 cosmetic, 2 minor, 3 service disruption, 4 safety risk, 5 immediate danger.
Priority must reflect severity, affected people, urgency, and uncertainty.
When evidence is insufficient, lower confidence and state uncertainty.
This is decision support, not an autonomous final decision.
Respond with one JSON object only. No markdown fences or extra prose.
JSON keys and types (strict):
- category: one of pothole|flooding|waste|streetlight|obstruction|other
- severity: integer 1-5
- confidence: number 0-1
- summary: string 5-500 chars
- recommendation: string 5-1000 chars
- priority: one of low|medium|high|critical
- estimated_impact: string 3-500 chars
- evidence: array of up to 8 strings
- uncertainty: array of up to 8 strings`;

export const OPENAI_COMPATIBLE_RESPONSE_FORMAT = {
  type: "json_object" as const,
};

export const GENERIC_ANALYSIS_FAILURE = "Report analysis failed";

export const MAX_RESPONSE_BYTES = 256 * 1024;

export type AnalysisProviderErrorCode =
  | "timeout"
  | "refused"
  | "http_error"
  | "invalid_response"
  | "schema_invalid"
  | "policy_invalid"
  | "oversized_response"
  | "redirect"
  | "unsupported_image";

export class AnalysisProviderError extends Error {
  readonly code: AnalysisProviderErrorCode;

  constructor(code: AnalysisProviderErrorCode, message = GENERIC_ANALYSIS_FAILURE) {
    super(message);
    this.name = "AnalysisProviderError";
    this.code = code;
  }
}

type FetchLike = typeof fetch;

type OpenAiCompatibleOptions = {
  env: ServerEnv;
  fetchImpl?: FetchLike;
};

type ChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
    finish_reason?: string | null;
  }>;
};

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function buildUserContent(input: AnalysisInput, includeVision: boolean) {
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `Citizen description:\n${input.description || "[none]"}`,
    },
  ];

  if (includeVision && input.image) {
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${input.image.mimeType};base64,${toBase64(input.image.bytes)}`,
      },
    });
  }

  return parts;
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AnalysisProviderError("oversized_response");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

function parseAssistantContent(payload: ChatCompletionResponse): string {
  const choice = payload.choices?.[0];
  if (!choice) {
    throw new AnalysisProviderError("invalid_response");
  }
  if (choice.message?.refusal) {
    throw new AnalysisProviderError("refused");
  }
  const content = choice.message?.content;
  if (!content || !content.trim()) {
    throw new AnalysisProviderError("refused");
  }
  return content;
}

function parseAndValidateSchema(content: string): ReportAnalysis {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new AnalysisProviderError("invalid_response");
  }

  const schemaResult = ReportAnalysisSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    throw new AnalysisProviderError("schema_invalid");
  }

  return schemaResult.data;
}

async function requestStructuredAnalysis(
  options: OpenAiCompatibleOptions,
  input: AnalysisInput,
  systemInstruction: string,
): Promise<{ analysis: ReportAnalysis; lineage: AnalysisLineage; rawContent: string }> {
  const { env } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = buildChatCompletionsUrl(env.AI_BASE_URL);
  const includeVision = env.AI_SUPPORTS_VISION;

  if (includeVision && input.image && !isSupportedImageMime(input.image.mimeType)) {
    throw new AnalysisProviderError("unsupported_image");
  }

  const startedAt = Date.now();
  let response: Response;

  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${env.THIRD_PARTY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: buildUserContent(input, includeVision) },
        ],
        response_format: OPENAI_COMPATIBLE_RESPONSE_FORMAT,
      }),
    });
  } catch (error) {
    if (error instanceof AnalysisProviderError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new AnalysisProviderError("timeout");
    }
    if (error instanceof TypeError) {
      throw new AnalysisProviderError("redirect");
    }
    throw new AnalysisProviderError("invalid_response");
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new AnalysisProviderError("http_error");
  }

  const rawBody = await readBoundedBody(response, MAX_RESPONSE_BYTES);
  let payload: ChatCompletionResponse;
  try {
    payload = JSON.parse(rawBody) as ChatCompletionResponse;
  } catch {
    throw new AnalysisProviderError("invalid_response");
  }

  const content = parseAssistantContent(payload);
  const analysis = parseAndValidateSchema(content);

  return {
    analysis,
    rawContent: content,
    lineage: {
      providerLabel: env.AI_PROVIDER_LABEL,
      responseModel: payload.model ?? env.AI_MODEL,
      requestId: payload.id ?? null,
      latencyMs: Date.now() - startedAt,
    },
  };
}

export type StructuredAnalysisResult = AnalysisResult & { rawContent: string };

export async function analyzeStructured(
  options: OpenAiCompatibleOptions,
  input: AnalysisInput,
  systemInstruction: string = SYSTEM_INSTRUCTION,
): Promise<StructuredAnalysisResult> {
  const result = await requestStructuredAnalysis(options, input, systemInstruction);
  return {
    analysis: result.analysis,
    lineage: result.lineage,
    rawContent: result.rawContent,
  };
}

export function createOpenAiCompatibleProvider(
  options: OpenAiCompatibleOptions,
): AnalysisProvider {
  return {
    async analyze(input: AnalysisInput): Promise<AnalysisResult> {
      const result = await analyzeStructured(options, input);
      const policyResult = validateAnalysisPolicy(result.analysis);
      if (!policyResult.ok) {
        throw new AnalysisProviderError("policy_invalid");
      }
      return {
        analysis: result.analysis,
        lineage: result.lineage,
      };
    },
  };
}

function isSupportedImageMime(value: string): value is SupportedImageMimeType {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export function redactSensitiveText(value: string, env: ServerEnv): string {
  return value
    .replaceAll(env.THIRD_PARTY_API_KEY, "[REDACTED]")
    .replaceAll(env.AI_BASE_URL, "[REDACTED]");
}
