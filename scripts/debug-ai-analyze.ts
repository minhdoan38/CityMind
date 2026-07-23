import { loadServerEnv } from "@/server/config/env";
import { analyzeStructured, AnalysisProviderError } from "@/server/ai/openai-compatible";

async function main() {
  const env = loadServerEnv();
  const started = Date.now();

  try {
    const result = await analyzeStructured(
      { env },
      { description: "Broken streetlight on Nguyen Hue street, dark for three nights" },
    );
    console.log("OK in", Date.now() - started, "ms");
    console.log("category:", result.hanoiAnalysis.category);
    console.log("handling:", result.hanoiAnalysis.handling_type);
    console.log("summary:", result.analysis.summary?.slice(0, 120));
  } catch (error) {
    console.error("FAIL in", Date.now() - started, "ms");
    if (error instanceof AnalysisProviderError) {
      console.error("code:", error.code);
      console.error("message:", error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

void main();
