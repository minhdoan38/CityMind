import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ reportId?: string; token?: string }>;
};

/** Unprefixed /status — bounce into default locale while preserving deep-link query (D-03). */
export default async function PublicStatusRedirectPage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.reportId) qs.set("reportId", params.reportId);
  if (params.token) qs.set("token", params.token);
  const query = qs.toString();
  redirect(query ? `/en/status?${query}` : "/en/status");
}
