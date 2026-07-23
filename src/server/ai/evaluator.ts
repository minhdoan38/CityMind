import { readFileSync } from "node:fs";
import path from "node:path";

type EvaluatorConfig = {
  config_version: string;
  system_prompt: string;
  output_schema: unknown;
};

let cachedConfig: EvaluatorConfig | null = null;

export function loadEvaluatorConfig(configPath?: string): EvaluatorConfig {
  if (cachedConfig && !configPath) {
    return cachedConfig;
  }

  const absolutePath = path.isAbsolute(configPath ?? "")
    ? (configPath as string)
    : path.resolve(
        process.cwd(),
        configPath ?? "prompt/citymind_ai_triage_structured_output_evaluator.json",
      );
  const raw = JSON.parse(readFileSync(absolutePath, "utf8")) as EvaluatorConfig;
  if (!configPath) {
    cachedConfig = raw;
  }
  return raw;
}

export function buildEvaluatorSystemPrompt(configPath?: string): string {
  return loadEvaluatorConfig(configPath).system_prompt;
}

export function getEvaluatorConfigVersion(configPath?: string): string {
  return loadEvaluatorConfig(configPath).config_version;
}
