import { z } from "zod";

export const CategorySchema = z.enum([
  "pothole",
  "flooding",
  "waste",
  "streetlight",
  "graffiti",
  "obstruction",
  "other",
]);

export const PrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const ReportAnalysisSchema = z
  .object({
    category: CategorySchema,
    severity: z.number().int().min(1).max(5),
    confidence: z.number().min(0).max(1),
    summary: z.string().min(5).max(500),
    recommendation: z.string().min(5).max(1000),
    priority: PrioritySchema,
    estimated_impact: z.string().min(3).max(500),
    evidence: z.array(z.string()).max(8).default([]),
    uncertainty: z.array(z.string()).max(8).default([]),
  })
  .strict();

export type ReportAnalysis = z.infer<typeof ReportAnalysisSchema>;

export const reportAnalysisJsonSchema = z.toJSONSchema(ReportAnalysisSchema);
