import { getTranslations } from "next-intl/server";

import AgentConsoleViewer from "@/components/dashboard/AgentConsoleViewer";
import { requireOfficerSession } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ report_id?: string }>;
};

export default async function AgentConsolePage({ searchParams }: Props) {
  await requireOfficerSession();
  const t = await getTranslations("dashboard.agentConsole");
  const params = await searchParams;
  const reportId = params.report_id?.trim() ?? "";

  return (
    <div className="w-full max-w-none space-y-6">
      <header className="dash-rise space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground text-balance">
          {t("pageTitle")}
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground text-pretty">
          {t("pageSubtitle")}
        </p>
      </header>

      <AgentConsoleViewer initialReportId={reportId} />
    </div>
  );
}
