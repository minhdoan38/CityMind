import type { ReportAnalysis } from "../domain/report-analysis";

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export type AnalysisImageInput = {
  bytes: Uint8Array;
  mimeType: SupportedImageMimeType;
};

export type AnalysisInput = {
  description: string;
  image?: AnalysisImageInput;
};

export type AnalysisLineage = {
  providerLabel: string;
  responseModel: string;
  requestId: string | null;
  latencyMs: number;
};

export type AnalysisResult = {
  analysis: ReportAnalysis;
  lineage: AnalysisLineage;
};

export type AnalysisProvider = {
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
};
