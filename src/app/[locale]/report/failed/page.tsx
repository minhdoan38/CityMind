"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Home, RotateCcw } from "lucide-react";

import ReportOutcomeLayout from "@/components/report/ReportOutcomeLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import {
  readReportFailedFlash,
  type ReportFailedFlash,
  type ReportFailedReason,
} from "@/lib/report-outcome-flash";

function reasonHintKey(reason: ReportFailedReason):
  | "failedHintValidation"
  | "failedHintServer"
  | "failedHintNetwork"
  | "failedHintGeneric" {
  switch (reason) {
    case "validation":
      return "failedHintValidation";
    case "server":
      return "failedHintServer";
    case "network":
      return "failedHintNetwork";
    default:
      return "failedHintGeneric";
  }
}

export default function ReportFailedPage() {
  const t = useTranslations("public");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [flash, setFlash] = useState<ReportFailedFlash | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const payload = readReportFailedFlash();
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

  return (
    <ReportOutcomeLayout>
      <article className="report-form-shell surface-card-elevated w-full">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            aria-hidden
          >
            <AlertCircle className="size-8" strokeWidth={2} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-destructive">
            {t("failedEyebrow")}
          </p>
          <h1 className="report-form-title font-heading mt-2 text-balance">
            {t("failedHeading")}
          </h1>
          <p className="report-form-lead mt-2 max-w-md text-pretty">{t("failedBody")}</p>
        </div>

        <Alert variant="destructive" className="mt-8">
          <AlertDescription className="text-sm leading-relaxed">
            {flash.message}
          </AlertDescription>
        </Alert>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t(reasonHintKey(flash.reason))}
        </p>

        {flash.status ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("failedStatusCode", { code: flash.status })}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="min-h-11 flex-1">
            <Link href="/report">
              <RotateCcw className="mr-2 size-4" aria-hidden />
              {t("failedTryAgain")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 flex-1">
            <Link href="/">
              <Home className="mr-2 size-4" aria-hidden />
              {t("backToHome")}
            </Link>
          </Button>
        </div>
      </article>
    </ReportOutcomeLayout>
  );
}
