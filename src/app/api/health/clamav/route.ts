import { checkClamavHealth } from "@/server/health/clamav-readiness";

export async function GET() {
  const result = await checkClamavHealth();
  const status = result.body.status === "up" ? 200 : 503;

  return Response.json(result.body, {
    status,
    headers: {
      "Cache-Control": "private, max-age=30",
      "X-Cache": result.cacheHit ? "HIT" : "MISS",
    },
  });
}
