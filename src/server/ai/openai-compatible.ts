import "server-only";

import { projectToLegacyReportAnalysisFromHanoi } from "../domain/analysis-projection";
import {
  HanoiAnalysisSchema,
  type HanoiAnalysis,
} from "../domain/hanoi-analysis";
import type { ReportAnalysis } from "../domain/report-analysis";
import { buildHanoiSystemPrompt } from "./hanoi";
import { validateHanoiPolicy } from "../validation/hanoi-policy";
import { buildChatCompletionsUrl, type ServerEnv } from "../config/env";
import type {
  AnalysisInput,
  AnalysisLineage,
  AnalysisProvider,
  AnalysisResult,
  SupportedImageMimeType,
} from "./provider";

export const SYSTEM_INSTRUCTION = buildHanoiSystemPrompt();

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

type StreamingChoice = ChatCompletionResponse["choices"] extends Array<infer T> | undefined
  ? T & {
      delta?: {
        content?: string | null;
        reasoning_content?: string | null;
      };
    }
  : never;

function parseChatCompletionResponseBody(rawBody: string): ChatCompletionResponse {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    throw new AnalysisProviderError("invalid_response");
  }

  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as ChatCompletionResponse;
    } catch {
      throw new AnalysisProviderError("invalid_response");
    }
  }

  if (trimmed.includes("data:")) {
    let lastPayload: ChatCompletionResponse | null = null;
    let aggregatedContent = "";
    let aggregatedReasoning = "";

    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }
      try {
        const parsed = JSON.parse(payload) as ChatCompletionResponse;
        if (parsed.choices) {
          lastPayload = parsed;
          const choice = parsed.choices[0] as StreamingChoice | undefined;
          const delta = choice?.delta;
          if (typeof delta?.content === "string") {
            aggregatedContent += delta.content;
          }
          if (typeof delta?.reasoning_content === "string") {
            aggregatedReasoning += delta.reasoning_content;
          }
        }
      } catch {
        // Ignore malformed SSE chunks.
      }
    }

    const mergedText = aggregatedContent.trim() || aggregatedReasoning.trim();
    if (lastPayload && mergedText) {
      const choice = lastPayload.choices?.[0];
      return {
        ...lastPayload,
        choices: [
          {
            ...choice,
            message: {
              ...choice?.message,
              content: mergedText,
            },
          },
        ],
      };
    }

    if (lastPayload) {
      return lastPayload;
    }
  }

  throw new AnalysisProviderError("invalid_response");
}

function parseAssistantContent(payload: ChatCompletionResponse): string {
  const choice = payload.choices?.[0];
  if (!choice) {
    throw new AnalysisProviderError("invalid_response");
  }
  if (choice.message?.refusal) {
    throw new AnalysisProviderError("invalid_response");
  }
  const content = choice.message?.content;
  if (!content || !content.trim()) {
    throw new AnalysisProviderError("invalid_response");
  }
  return content;
}

function parseAndValidateSchema(content: string): HanoiAnalysis {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new AnalysisProviderError("invalid_response");
  }

  const schemaResult = HanoiAnalysisSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    throw new AnalysisProviderError("schema_invalid");
  }

  const policyResult = validateHanoiPolicy(schemaResult.data);
  if (!policyResult.ok) {
    throw new AnalysisProviderError("policy_invalid");
  }

  return schemaResult.data;
}

async function requestStructuredAnalysis(
  options: OpenAiCompatibleOptions,
  input: AnalysisInput,
  systemInstruction: string,
): Promise<{
  hanoiAnalysis: HanoiAnalysis;
  analysis: ReportAnalysis;
  lineage: AnalysisLineage;
  rawContent: string;
}> {
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
        stream: false,
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
    payload = parseChatCompletionResponseBody(rawBody);
  } catch (error) {
    if (error instanceof AnalysisProviderError) {
      throw error;
    }
    throw new AnalysisProviderError("invalid_response");
  }

  const content = parseAssistantContent(payload);
  let hanoiAnalysis: HanoiAnalysis;
  try {
    hanoiAnalysis = parseAndValidateSchema(content);
  } catch (error) {
    if (error instanceof AnalysisProviderError && error.code === "schema_invalid") {
      throw error;
    }
    throw error;
  }

  return {
    hanoiAnalysis,
    analysis: projectToLegacyReportAnalysisFromHanoi(hanoiAnalysis),
    rawContent: content,
    lineage: {
      providerLabel: env.AI_PROVIDER_LABEL,
      responseModel: payload.model ?? env.AI_MODEL,
      requestId: payload.id ?? null,
      latencyMs: Date.now() - startedAt,
    },
  };
}

export type StructuredAnalysisResult = AnalysisResult & {
  hanoiAnalysis: HanoiAnalysis;
  rawContent: string;
};

export async function analyzeStructured(
  options: OpenAiCompatibleOptions,
  input: AnalysisInput,
  systemInstruction: string = SYSTEM_INSTRUCTION,
): Promise<StructuredAnalysisResult> {
  try {
    const result = await requestStructuredAnalysis(options, input, systemInstruction);
    return {
      hanoiAnalysis: result.hanoiAnalysis,
      analysis: result.analysis,
      lineage: result.lineage,
      rawContent: result.rawContent,
    };
  } catch (error) {
    if (error instanceof AnalysisProviderError && error.code === "schema_invalid") {
      const retry = await requestStructuredAnalysis(options, input, systemInstruction);
      return {
        hanoiAnalysis: retry.hanoiAnalysis,
        analysis: retry.analysis,
        lineage: retry.lineage,
        rawContent: retry.rawContent,
      };
    }
    throw error;
  }
}

export type ConversationalChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function completeConversationalChat(
  options: OpenAiCompatibleOptions,
  messages: ConversationalChatMessage[],
): Promise<{ content: string; lineage: AnalysisLineage }> {
  const { env } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = buildChatCompletionsUrl(env.AI_BASE_URL);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${env.THIRD_PARTY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.3,
        max_tokens: 800,
        stream: false,
        messages,
      }),
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new AnalysisProviderError("http_error");
    }

    const rawBody = await readBoundedBody(response, MAX_RESPONSE_BYTES);
    const payload = parseChatCompletionResponseBody(rawBody);
    const content = parseAssistantContent(payload);

    return {
      content: content.trim(),
      lineage: {
        providerLabel: env.AI_PROVIDER_LABEL,
        responseModel: payload.model ?? env.AI_MODEL,
        requestId: payload.id ?? null,
        latencyMs: Date.now() - startedAt,
      },
    };
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
}

export async function probeChatCompletion(
  options: OpenAiCompatibleOptions,
): Promise<{ ok: boolean; latencyMs: number; model: string }> {
  const { env } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = buildChatCompletionsUrl(env.AI_BASE_URL);
  const startedAt = Date.now();

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(env.AI_TIMEOUT_MS, 10_000)),
      headers: {
        Authorization: `Bearer ${env.THIRD_PARTY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0,
        max_tokens: 5,
        stream: false,
        messages: [
          { role: "system", content: "Reply with OK" },
          { role: "user", content: "ping" },
        ],
        response_format: OPENAI_COMPATIBLE_RESPONSE_FORMAT,
      }),
    });

    if (!response.ok) {
      await response.body?.cancel();
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        model: env.AI_MODEL,
      };
    }

    const rawBody = await readBoundedBody(response, MAX_RESPONSE_BYTES);
    parseChatCompletionResponseBody(rawBody);
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      model: env.AI_MODEL,
    };
  } catch {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      model: env.AI_MODEL,
    };
  }
}

export function createOpenAiCompatibleProvider(
  options: OpenAiCompatibleOptions,
): AnalysisProvider {
  return {
    async analyze(input: AnalysisInput): Promise<AnalysisResult> {
      const result = await analyzeStructured(options, input);
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
