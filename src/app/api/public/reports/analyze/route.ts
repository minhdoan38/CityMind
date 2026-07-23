/**
 * POST /api/public/reports/analyze — permanently removed (410 Gone).
 * Citizen intake uses POST /api/public/reports/intake instead (Phase 7+).
 */
import { analyzeRouteGone, jsonErrorResponse } from "@/server/http/errors";

export async function POST() {
  return jsonErrorResponse(analyzeRouteGone());
}
