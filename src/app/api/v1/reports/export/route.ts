import { handleReportsExportRequest } from "@/server/services/officer-write";

export async function GET(request: Request) {
  return handleReportsExportRequest(request);
}
