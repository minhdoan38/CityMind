import { handleIntakeSubmitRequest } from "@/server/services/citizen-chat-intake";

export async function POST(request: Request) {
  return handleIntakeSubmitRequest(request);
}
