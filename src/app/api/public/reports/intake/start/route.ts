import { handleIntakeStartRequest } from "@/server/services/citizen-chat-intake";

export async function POST(request: Request) {
  return handleIntakeStartRequest(request);
}
