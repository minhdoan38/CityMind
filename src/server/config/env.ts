import "server-only";

import { z } from "zod";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function normalizeAiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && !isLoopbackUrl(trimmed)) {
    throw new Error("AI_BASE_URL must use HTTPS except for loopback development.");
  }
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`;
}

const ServerEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AI_BASE_URL: z
    .string()
    .min(1)
    .transform((value) => normalizeAiBaseUrl(value)),
  AI_MODEL: z.string().min(1),
  AI_PROVIDER_LABEL: z.string().min(1).default("third-party"),
  THIRD_PARTY_API_KEY: z.string().min(1),
  AI_SUPPORTS_VISION: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return false;
      }
      if (typeof value === "boolean") {
        return value;
      }
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1";
    }),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(60_000),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function loadServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error("Server environment configuration is invalid.");
  }
  return parsed.data;
}

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = loadServerEnv();
  }
  return cachedEnv;
}

export function resetServerEnvCache(): void {
  cachedEnv = null;
}

export function buildChatCompletionsUrl(baseUrl: string): string {
  return new URL("chat/completions", `${baseUrl}/`).toString();
}
