import { handleOfficerBulkTriageDispatchRequest } from "@/server/services/officer-triage-dispatch";

export async function POST(request: Request) {
  return handleOfficerBulkTriageDispatchRequest(request);
}
