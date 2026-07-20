import { backendEndpoint } from "@/lib/backend";

export async function POST(request: Request) {
  const form = await request.formData();
  
  const headers = new Headers();
  const xff = request.headers.get("x-forwarded-for");
  const xrip = request.headers.get("x-real-ip");
  
  if (xff) {
    headers.set("X-Forwarded-For", xff);
  } else if (xrip) {
    headers.set("X-Forwarded-For", xrip);
  }

  const response = await fetch(backendEndpoint("/api/v1/reports/analyze"), {
    method: "POST",
    body: form,
    headers: headers,
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
