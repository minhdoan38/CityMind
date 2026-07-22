import { handleOfficerAnalyticsRequest } from "@/server/services/officer-analytics";

export async function GET(request: Request) {
  return handleOfficerAnalyticsRequest(request);
}
