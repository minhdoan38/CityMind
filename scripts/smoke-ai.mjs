#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = resolve(__dirname, "..");

const SYSTEM_INSTRUCTION = `You analyze urban incident reports for triage support.
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

const REPORT_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: {
      type: "string",
      enum: ["pothole", "flooding", "waste", "streetlight", "obstruction", "other"],
    },
    severity: { type: "integer", minimum: 1, maximum: 5 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string", minLength: 5, maxLength: 500 },
    recommendation: { type: "string", minLength: 5, maxLength: 1000 },
    priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
    estimated_impact: { type: "string", minLength: 3, maxLength: 500 },
    evidence: { type: "array", items: { type: "string" }, maxItems: 8 },
    uncertainty: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
  required: [
    "category",
    "severity",
    "confidence",
    "summary",
    "recommendation",
    "priority",
    "estimated_impact",
    "evidence",
    "uncertainty",
  ],
};

const REQUIRED_FLAGS = new Set([
  "--require-strict-schema",
  "--require-image",
  "--require-lineage",
  "--require-privacy-approval",
]);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const MAX_RESPONSE_BYTES = 256 * 1024;
const GENERIC_FAILURE = "Report analysis failed";

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const flags = new Set();
  for (const arg of argv) {
    if (REQUIRED_FLAGS.has(arg)) {
      flags.add(arg);
    }
  }
  return flags;
}

function missingConfig() {
  const missing = [];
  if (!process.env.AI_BASE_URL?.trim()) {
    missing.push("AI_BASE_URL");
  }
  if (!process.env.THIRD_PARTY_API_KEY?.trim()) {
    missing.push("THIRD_PARTY_API_KEY");
  }
  if (!process.env.AI_MODEL?.trim()) {
    missing.push("AI_MODEL");
  }
  return missing;
}

function normalizeAiBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error("AI_BASE_URL must use HTTPS except for loopback development.");
  }
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`;
}

function buildChatCompletionsUrl(baseUrl) {
  return new URL("chat/completions", `${baseUrl}/`).toString();
}

function tinyPngBytes() {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  return Buffer.from(base64, "base64");
}

async function promptPrivacyApproval() {
  if (process.env.SMOKE_AI_PRIVACY_APPROVED === "1") {
    return true;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolveAnswer) => {
    rl.question(
      "Confirm the configured endpoint privacy/retention terms are acceptable for synthetic smoke data? [y/N] ",
      resolveAnswer,
    );
  });
  rl.close();
  return String(answer).trim().toLowerCase() === "y";
}

function buildUserContent(description, image) {
  const parts = [
    {
      type: "text",
      text: `Citizen description:\n${description || "[none]"}`,
    },
  ];

  if (image) {
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}`,
      },
    });
  }

  return parts;
}

async function readBoundedBody(response) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error(GENERIC_FAILURE);
    }
    chunks.push(value);
  }

  const merged = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return merged.toString("utf8");
}

function parseChatCompletionResponseBody(rawBody) {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    throw new Error(GENERIC_FAILURE);
  }

  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  if (trimmed.includes("data:")) {
    let lastPayload = null;
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }
      try {
        const parsed = JSON.parse(payload);
        if (parsed.choices) {
          lastPayload = parsed;
        }
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
    if (lastPayload) {
      return lastPayload;
    }
  }

  throw new Error(GENERIC_FAILURE);
}

function assertStructuredAnalysis(analysis) {
  const required = REPORT_ANALYSIS_JSON_SCHEMA.required;
  for (const key of required) {
    if (!(key in analysis)) {
      throw new Error(`${GENERIC_FAILURE}: missing ${key}`);
    }
  }
  const categories = REPORT_ANALYSIS_JSON_SCHEMA.properties.category.enum;
  const priorities = REPORT_ANALYSIS_JSON_SCHEMA.properties.priority.enum;
  if (!categories.includes(analysis.category)) {
    throw new Error(`${GENERIC_FAILURE}: invalid category ${analysis.category}`);
  }
  if (!priorities.includes(analysis.priority)) {
    throw new Error(`${GENERIC_FAILURE}: invalid priority ${analysis.priority}`);
  }
  if (typeof analysis.severity !== "number" || analysis.severity < 1 || analysis.severity > 5) {
    throw new Error(`${GENERIC_FAILURE}: invalid severity ${analysis.severity}`);
  }
  if (
    typeof analysis.confidence !== "number" ||
    analysis.confidence < 0 ||
    analysis.confidence > 1
  ) {
    throw new Error(`${GENERIC_FAILURE}: invalid confidence ${analysis.confidence}`);
  }
  if (!Array.isArray(analysis.evidence)) {
    throw new Error(`${GENERIC_FAILURE}: evidence must be array`);
  }
  if (!Array.isArray(analysis.uncertainty)) {
    throw new Error(`${GENERIC_FAILURE}: uncertainty must be array`);
  }
}

async function analyzeCase(env, input) {
  const startedAt = Date.now();
  const response = await fetch(buildChatCompletionsUrl(env.baseUrl), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(env.timeoutMs),
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.model,
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: buildUserContent(input.description, input.image) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    if (input.image && response.status === 400) {
      throw new Error("VISION_UNSUPPORTED");
    }
    await response.body?.cancel().catch(() => {});
    throw new Error(`${GENERIC_FAILURE}: http ${response.status} ${errorBody.slice(0, 120)}`);
  }

  const rawBody = await readBoundedBody(response);
  let payload;
  try {
    payload = parseChatCompletionResponseBody(rawBody);
  } catch {
    throw new Error(GENERIC_FAILURE);
  }

  const choice = payload.choices?.[0];
  if (!choice || choice.message?.refusal) {
    throw new Error(`${GENERIC_FAILURE}: refusal or missing choice`);
  }
  if (!choice.message?.content?.trim()) {
    throw new Error(`${GENERIC_FAILURE}: empty assistant content`);
  }

  let analysis;
  try {
    analysis = JSON.parse(choice.message.content);
  } catch {
    throw new Error(`${GENERIC_FAILURE}: invalid JSON content`);
  }

  assertStructuredAnalysis(analysis);

  return {
    analysis,
    lineage: {
      providerLabel: env.providerLabel,
      responseModel: payload.model ?? env.model,
      requestId: payload.id ?? null,
      latencyMs: Date.now() - startedAt,
    },
  };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  loadEnvFile(join(FRONTEND_ROOT, ".env.local"));
  loadEnvFile(join(FRONTEND_ROOT, ".env"));

  const missing = missingConfig();
  if (missing.length > 0) {
    console.error(
      `SMOKE_BLOCKED: missing required configuration: ${missing.join(", ")}`,
    );
    console.error(
      "Set AI_BASE_URL, AI_MODEL, and THIRD_PARTY_API_KEY in .env.local before live smoke.",
    );
    process.exit(2);
  }

  if (flags.has("--require-privacy-approval")) {
    const approved = await promptPrivacyApproval();
    if (!approved) {
      console.error("SMOKE_BLOCKED: operator did not approve privacy/retention terms.");
      process.exit(3);
    }
  }

  const env = {
    baseUrl: normalizeAiBaseUrl(process.env.AI_BASE_URL),
    model: process.env.AI_MODEL.trim(),
    apiKey: process.env.THIRD_PARTY_API_KEY.trim(),
    providerLabel: process.env.AI_PROVIDER_LABEL?.trim() || "third-party",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60_000),
  };

  const cases = [
    {
      id: "en-text",
      description:
        "Synthetic EN incident: large pothole near a school entrance after recent rain.",
    },
    {
      id: "vi-text",
      description:
        "Bao cao gia lap: o ga lon gan cong truong, co nguy co gay nga cho nguoi di bo.",
    },
    {
      id: "image",
      description: "Synthetic image-only context for contract smoke.",
      image: {
        bytes: tinyPngBytes(),
        mimeType: "image/png",
      },
    },
  ];

  const results = [];
  for (const testCase of cases) {
    if (testCase.id === "image" && !flags.has("--require-image")) {
      continue;
    }

    let result;
    try {
      result = await analyzeCase(env, testCase);
    } catch (error) {
      if (
        testCase.id === "image" &&
        error instanceof Error &&
        error.message === "VISION_UNSUPPORTED"
      ) {
        console.warn(
          "SMOKE_SKIP_IMAGE: configured endpoint does not accept image_url content (text-only providers such as DeepSeek).",
        );
        continue;
      }
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} (case=${testCase.id})`,
        { cause: error },
      );
    }

    if (flags.has("--require-lineage")) {
      if (!result.lineage.responseModel || result.lineage.latencyMs < 0) {
        throw new Error(`Lineage missing for case ${testCase.id}`);
      }
    }

    if (flags.has("--require-strict-schema")) {
      assertStructuredAnalysis(result.analysis);
    }

    results.push({
      id: testCase.id,
      category: result.analysis.category,
      priority: result.analysis.priority,
      responseModel: result.lineage.responseModel,
      requestId: result.lineage.requestId,
      latencyMs: result.lineage.latencyMs,
    });
  }

  console.log("SMOKE_OK");
  for (const item of results) {
    console.log(
      `${item.id}: category=${item.category} priority=${item.priority} model=${item.responseModel} requestId=${item.requestId ?? "none"} latencyMs=${item.latencyMs}`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SMOKE_FAILED: ${message}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
