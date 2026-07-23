import { checkAiHealth } from "@/server/health/ai-readiness";
import { getServerEnv } from "@/server/config/env";

export async function GET() {
  const result = await checkAiHealth(getServerEnv());
  const status = result.body.status === "down" ? 503 : 200;

  return Response.json(result.body, {
    status,
    headers: {
      "Cache-Control": "private, max-age=30",
      "X-Cache": result.cacheHit ? "HIT" : "MISS",
    },
  });
}
