import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

const HANOI_CONFIG_PATH = path.resolve(
  process.cwd(),
  "prompt/citymind_ai_hanoi_triage_guidance_v5_2 (1).json",
);

type HanoiConfigShape = {
  output_schema: {
    properties: {
      category: { enum: string[] };
      guidance_code: { enum: string[] };
    };
  };
};

function loadHanoiConfigRaw(): HanoiConfigShape {
  return JSON.parse(readFileSync(HANOI_CONFIG_PATH, "utf8")) as HanoiConfigShape;
}

function loadHanoiCategories(): [string, ...string[]] {
  const categories = loadHanoiConfigRaw().output_schema.properties.category.enum;
  if (categories.length === 0) {
    throw new Error("Hanoi category enum is empty");
  }
  return categories as [string, ...string[]];
}

function loadGuidanceCodeEnum(): [string, ...string[]] {
  const codes = loadHanoiConfigRaw().output_schema.properties.guidance_code.enum;
  if (codes.length === 0) {
    throw new Error("Hanoi guidance_code enum is empty");
  }
  return codes as [string, ...string[]];
}

export const HANOI_SEVERITY_TO_INT = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 5,
} as const;

export const HanoiCategorySchema = z.enum(loadHanoiCategories());
export const HanoiSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const HanoiConfidenceSchema = z.union([
  z.literal(0.9),
  z.literal(0.75),
  z.literal(0.55),
  z.literal(0.3),
]);
export const HanoiHandlingTypeSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const HanoiHandlingLabelSchema = z.enum([
  "SELF_GUIDANCE",
  "TEMPORARY_SAFE_ACTION",
  "KEEP_AWAY",
]);
export const HanoiGuidanceCodeSchema = z.enum(loadGuidanceCodeEnum());

export const HanoiAnalysisSchema = z
  .object({
    category: HanoiCategorySchema,
    matched_known_issue: z.boolean(),
    observed_facts: z.array(z.string().min(1)),
    inferences: z.array(z.string().min(1)).default([]),
    unknowns: z.array(z.string().min(1)).default([]),
    severity: HanoiSeveritySchema,
    severity_reason: z.string().min(1),
    confidence: HanoiConfidenceSchema,
    handling_type: HanoiHandlingTypeSchema,
    handling_label: HanoiHandlingLabelSchema,
    allowed_actions: z.array(z.string().min(1)).min(1).max(3),
    prohibited_actions: z.array(z.string().min(1)).min(1).max(3),
    recommended_action: z.string().min(1),
    guidance_code: HanoiGuidanceCodeSchema,
    critical_alert: z.boolean(),
    requires_human_review: z.literal(true),
  })
  .strict();

export type HanoiAnalysis = z.infer<typeof HanoiAnalysisSchema>;
export type HanoiSeverity = z.infer<typeof HanoiSeveritySchema>;

export const hanoiAnalysisJsonSchema = z.toJSONSchema(HanoiAnalysisSchema);
