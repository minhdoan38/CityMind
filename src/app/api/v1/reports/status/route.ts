import { handleCitizenStatusRequest } from "@/server/services/citizen-status";

export async function POST(request: Request) {
  return handleCitizenStatusRequest(request);
}
