import { handleCitizenCoachRequest } from "@/server/services/citizen-coach";

export async function GET(request: Request) {
  return handleCitizenCoachRequest(request);
}

export async function POST(request: Request) {
  return handleCitizenCoachRequest(request);
}
