import { redirect } from "next/navigation";

type Props = { params: Promise<{ reportId: string }> };

/** Legacy officer detail path — send callers into the AUTH-04 gated dashboard route. */
export default async function LegacyReportDetailRedirect({ params }: Props) {
  const { reportId } = await params;
  redirect(`/dashboard/reports/${reportId}`);
}
