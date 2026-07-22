import { handleCitizenEscalateRequest } from "@/server/services/citizen-escalate";

export async function POST(request: Request) {
  return handleCitizenEscalateRequest(request);
}
