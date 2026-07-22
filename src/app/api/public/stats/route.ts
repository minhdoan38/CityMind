import { handlePublicStatsRequest } from "@/server/services/officer-analytics";

export async function GET(request: Request) {
  return handlePublicStatsRequest(request);
}
