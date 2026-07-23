import { readFileSync } from "node:fs";
import path from "node:path";

export const HANOI_PROMPT_PATH = path.resolve(
  process.cwd(),
  "prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json",
);

type HanoiConfig = {
  config_version: string;
  system_prompt: string;
  output_schema: unknown;
};

let cachedConfig: HanoiConfig | null = null;

export function loadHanoiConfig(configPath?: string): HanoiConfig {
  if (cachedConfig && !configPath) {
    return cachedConfig;
  }

  const absolutePath = path.isAbsolute(configPath ?? "")
    ? (configPath as string)
    : path.resolve(process.cwd(), configPath ?? HANOI_PROMPT_PATH);
  const raw = JSON.parse(readFileSync(absolutePath, "utf8")) as HanoiConfig;
  if (!configPath) {
    cachedConfig = raw;
  }
  return raw;
}

export function buildHanoiSystemPrompt(configPath?: string): string {
  return loadHanoiConfig(configPath).system_prompt;
}

export function getHanoiConfigVersion(configPath?: string): string {
  return loadHanoiConfig(configPath).config_version;
}
