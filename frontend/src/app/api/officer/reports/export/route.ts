import { getClaims } from "@/lib/auth";
import { officerFetch } from "@/lib/backend";

export async function GET(request: Request) {
  if (!(await getClaims())) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const incoming = new URL(request.url);
  const response = await officerFetch(
    `/api/v1/reports/export?${incoming.searchParams.toString()}`,
  );

  const headers = new Headers();
  headers.set(
    "Content-Type",
    response.headers.get("Content-Type") ?? "application/octet-stream",
  );
  const disposition = response.headers.get("Content-Disposition");
  if (disposition) {
    headers.set("Content-Disposition", disposition);
  }
  headers.set("Cache-Control", "private, no-store");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
