"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";

import SuccessTriagePanel from "@/components/coach/SuccessTriagePanel";
import ReportOutcomeLayout from "@/components/report/ReportOutcomeLayout";
import { Link, useRouter } from "@/i18n/navigation";
import { readReportSuccessFlash, type ReportSuccessFlash } from "@/lib/report-outcome-flash";

export default function ReportSuccessPage() {
  const t = useTranslations("public");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [flash, setFlash] = useState<ReportSuccessFlash | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const payload = readReportSuccessFlash();
    if (!payload) {
      router.replace("/report");
      return;
    }
    startTransition(() => {
      setFlash(payload);
      setReady(true);
    });
  }, [router, startTransition]);

  if (!ready || !flash) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite" />
    );
  }

  const { reportId, accessToken, outcome } = flash;

  return (
    <ReportOutcomeLayout>
      <article className="report-form-shell surface-card-elevated w-full">
        <div className="flex items-start gap-4 border-b border-border pb-6">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
            aria-hidden
          >
            <CheckCircle2 className="size-6" strokeWidth={2} />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-success">
              {t("successEyebrow")}
            </p>
            <h1 className="report-form-title font-heading text-balance">{t("successHeading")}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("successBody")}</p>
          </div>
        </div>

        <SuccessTriagePanel
          reportId={reportId}
          accessToken={accessToken}
          initialOutcome={outcome}
          hideStatusLinks
        />

        <div className="mt-8 border-t border-border pt-6">
          <Link
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t("backToHome")}
          </Link>
        </div>
      </article>
    </ReportOutcomeLayout>
  );
}
