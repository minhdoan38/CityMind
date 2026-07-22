import { handleRecentReportsRequest } from "@/server/services/officer-read";

export async function GET(request: Request) {
  return handleRecentReportsRequest(request);
}
