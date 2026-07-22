import { analyzeRouteGone, jsonErrorResponse } from "@/server/http/errors";

export async function POST() {
  return jsonErrorResponse(analyzeRouteGone());
}
