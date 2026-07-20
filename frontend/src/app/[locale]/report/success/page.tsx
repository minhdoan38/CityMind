"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";

import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";

const FLASH_KEY = "citymind:report-success";

type FlashPayload = {
  reportId: string;
  accessToken: string;
};

function consumeFlash(): FlashPayload | null {
  const raw = sessionStorage.getItem(FLASH_KEY);
  sessionStorage.removeItem(FLASH_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<FlashPayload>;
    if (!data.reportId || !data.accessToken) return null;
    return { reportId: data.reportId, accessToken: data.accessToken };
  } catch {
    return null;
  }
}

export default function ReportSuccessPage() {
  const t = useTranslations("public");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [flash, setFlash] = useState<FlashPayload | null>(null);
  const [ready, setReady] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    const payload = consumeFlash();
    if (!payload) {
      router.replace("/report");
      return;
    }
    startTransition(() => {
      setFlash(payload);
      setReady(true);
    });
  }, [router, startTransition]);

  const statusPrepValue = flash
    ? `/status?reportId=${encodeURIComponent(flash.reportId)}&token=${encodeURIComponent(flash.accessToken)}`
    : "";

  async function copyText(
    value: string,
    which: "id" | "token" | "status",
  ) {
    try {
      await navigator.clipboard.writeText(value);
      setLiveMessage(t("copied"));
      if (which === "id") {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else if (which === "token") {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedStatus(true);
        setTimeout(() => setCopiedStatus(false), 2000);
      }
    } catch {
      setLiveMessage("");
    }
  }

  if (!ready || !flash) {
    return (
      <div
        className="min-h-screen bg-background"
        aria-busy="true"
        aria-live="polite"
      />
    );
  }

  const { reportId, accessToken } = flash;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="w-full border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-2xl font-bold tracking-tight text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t("title")}
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-grow flex-col justify-center px-6 py-12">
        <div className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("successHeading")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("successBody")}</p>

          <Alert className="mt-6 border-amber-500/40 bg-amber-50 text-amber-900">
            <AlertDescription className="text-sm font-medium">
              {t("tokenWarning")}
            </AlertDescription>
          </Alert>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-muted-foreground">
                {t("reportIdLabel")}
              </span>
              <div className="flex items-center gap-2">
                <code className="min-h-11 flex-grow truncate rounded-md border border-border bg-muted/50 px-3 py-2.5 font-mono text-sm select-all">
                  {reportId}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={t("copyReportId")}
                  onClick={() => copyText(reportId, "id")}
                >
                  {copiedId ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-muted-foreground">
                {t("accessTokenLabel")}
              </span>
              <div className="flex items-center gap-2">
                <code className="min-h-11 flex-grow truncate rounded-md border border-border bg-muted/50 px-3 py-2.5 font-mono text-sm select-all">
                  {accessToken}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={t("copyAccessToken")}
                  onClick={() => copyText(accessToken, "token")}
                >
                  {copiedToken ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-muted-foreground">
                {t("statusLinkPrep")}
              </span>
              <div className="flex items-center gap-2">
                <code className="min-h-11 flex-grow truncate rounded-md border border-border bg-muted/50 px-3 py-2.5 font-mono text-xs select-all">
                  {statusPrepValue}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={t("statusLinkPrep")}
                  onClick={() => copyText(statusPrepValue, "status")}
                >
                  {copiedStatus ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {liveMessage}
          </div>

          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t("backToHome")}
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-border bg-muted/40 py-6 text-center text-sm text-muted-foreground">
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}
