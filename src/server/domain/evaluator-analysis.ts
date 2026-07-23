import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import { PrioritySchema } from "./report-analysis";

const EVALUATOR_CONFIG_PATH = path.resolve(
  process.cwd(),
  "prompt/citymind_ai_triage_structured_output_evaluator.json",
);
const HANOI_CONFIG_PATH = path.resolve(
  process.cwd(),
  "prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json",
);

let cachedCategories: [string, ...string[]] | null = null;

function loadEvaluatorCategories(): [string, ...string[]] {
  if (cachedCategories) {
    return cachedCategories;
  }

  const configPath = existsSync(EVALUATOR_CONFIG_PATH)
    ? EVALUATOR_CONFIG_PATH
    : HANOI_CONFIG_PATH;
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as {
    output_schema: { properties: { category: { enum: string[] } } };
  };
  const categories = raw.output_schema.properties.category.enum;
  if (categories.length === 0) {
    throw new Error("Evaluator category enum is empty");
  }
  cachedCategories = categories as [string, ...string[]];
  return cachedCategories;
}

export const EvaluatorCategorySchema = z.enum(loadEvaluatorCategories());

export const EvaluatorAnalysisSchema = z
  .object({
    category: EvaluatorCategorySchema,
    observed_facts: z.array(z.string().min(1)).default([]),
    inferences: z.array(z.string().min(1)).default([]),
    unknowns: z.array(z.string().min(1)).default([]),
    severity: z.number().int().min(1).max(5),
    severity_reason: z.string().min(1),
    priority: PrioritySchema,
    priority_reason: z.string().min(1),
    confidence: z.number().min(0).max(1),
    recommended_action: z.string().min(1),
    requires_human_review: z.literal(true),
  })
  .strict();

export type EvaluatorAnalysis = z.infer<typeof EvaluatorAnalysisSchema>;

export const evaluatorAnalysisJsonSchema = z.toJSONSchema(EvaluatorAnalysisSchema);
