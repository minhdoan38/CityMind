import { checkReadiness } from "@/server/health/readiness";

export async function GET() {
  const readiness = await checkReadiness();
  const status = readiness.status === "ready" ? 200 : 503;
  return Response.json(readiness, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
