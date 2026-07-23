import { handleOfficerTriageConsoleRequest } from "@/server/services/officer-triage-console";

export async function GET(request: Request) {
  return handleOfficerTriageConsoleRequest(request);
}
