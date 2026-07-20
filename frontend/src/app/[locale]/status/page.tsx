"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

type HistoryItem = {
  status: string;
  note: string | null;
  created_at: string;
};

type StatusResult = {
  status: string;
  summary: string | null;
  history: HistoryItem[];
};

type LookupErrorKind = "verify" | "rate" | "network";

function statusValueKey(status: string): string {
  const normalized = status.trim().toLowerCase();
  return `statusValue${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function formatTimestamp(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatusLookupForm() {
  const t = useTranslations("public");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const autoFetched = useRef(false);

  const initialReportId = (searchParams.get("reportId") ?? "").trim();
  const initialToken = (searchParams.get("token") ?? "").trim();

  const [reportId, setReportId] = useState(initialReportId);
  const [token, setToken] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [errorKind, setErrorKind] = useState<LookupErrorKind | null>(null);
  const [result, setResult] = useState<StatusResult | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  async function lookupStatus(id: string, accessToken: string) {
    setLoading(true);
    setErrorKind(null);
    setResult(null);
    setLiveMessage(t("statusChecking"));

    try {
      const res = await fetch("/api/public/reports/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: id,
          token: accessToken,
        }),
      });

      if (res.status === 401) {
        setErrorKind("verify");
        setLiveMessage(t("statusVerifyFailed"));
        return;
      }

      if (res.status === 429) {
        setErrorKind("rate");
        setLiveMessage(t("statusRateLimited"));
        const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          setRateLimited(true);
          window.setTimeout(() => setRateLimited(false), retryAfter * 1000);
        }
        return;
      }

      if (!res.ok) {
        setErrorKind("network");
        setLiveMessage(t("statusNetworkError"));
        return;
      }

      const data = (await res.json()) as StatusResult;
      setResult({
        status: data.status,
        summary: data.summary ?? null,
        history: Array.isArray(data.history) ? data.history : [],
      });
      setLiveMessage("");
    } catch {
      setErrorKind("network");
      setLiveMessage(t("statusNetworkError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const qReportId = (searchParams.get("reportId") ?? "").trim();
    const qToken = (searchParams.get("token") ?? "").trim();
    if (!qReportId || !qToken || autoFetched.current) return;
    autoFetched.current = true;
    void lookupStatus(qReportId, qToken);
    // One-shot deep-link auto-fetch (D-01 / D-02)
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional one-shot

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = reportId.trim();
    const accessToken = token.trim();
    if (!id || !accessToken) return;
    void lookupStatus(id, accessToken);
  }

  const errorMessage =
    errorKind === "verify"
      ? t("statusVerifyFailed")
      : errorKind === "rate"
        ? t("statusRateLimited")
        : errorKind === "network"
          ? t("statusNetworkError")
          : null;

  function labelForStatus(status: string): string {
    const key = statusValueKey(status);
    if (t.has(key)) return t(key);
    return status;
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t("statusHeading")}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{t("statusBody")}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reportId">{t("reportIdLabel")}</Label>
          <Input
            id="reportId"
            name="reportId"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            autoComplete="off"
            className="min-h-11 font-mono text-sm"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="token">{t("accessTokenLabel")}</Label>
          <Input
            id="token"
            name="token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            className="min-h-11 font-mono text-sm"
            required
          />
        </div>
        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={loading || rateLimited}
        >
          {loading ? t("statusChecking") : t("checkStatus")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("statusPrivacyNote")}</p>
      </form>

      <div
        className="mt-6"
        aria-live="polite"
        aria-busy={loading}
        role="region"
        aria-label={t("statusHeading")}
      >
        <span className="sr-only">{liveMessage}</span>

        {errorMessage ? (
          <Alert variant="destructive" className="border-destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-3 rounded-xl border border-border bg-card p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : null}

        {!loading && !errorKind && !result ? (
          <div className="rounded-xl border border-border bg-muted/40 p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {t("statusEmptyHeading")}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              {t("statusEmptyBody")}
            </p>
          </div>
        ) : null}

        {!loading && result ? (
          <div className="space-y-6 rounded-xl border border-border bg-card p-6">
            <div className="rounded-lg bg-[#EFF6FF] p-4">
              <p className="text-sm text-muted-foreground">
                {t("statusCurrentLabel")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary">{labelForStatus(result.status)}</Badge>
              </div>
            </div>

            {result.summary ? (
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {t("statusSummaryLabel")}
                </h2>
                <p className="mt-2 text-base text-foreground">{result.summary}</p>
              </div>
            ) : null}

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {t("statusHistoryHeading")}
              </h2>
              {result.history.length === 0 ? (
                <p className="mt-2 text-base text-muted-foreground">
                  {t("statusHistoryEmpty")}
                </p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {result.history.map((item, index) => (
                    <li
                      key={`${item.created_at}-${item.status}-${index}`}
                      className="rounded-lg bg-muted/60 px-4 py-3"
                    >
                      <p className="text-sm text-muted-foreground">
                        {formatTimestamp(item.created_at, locale)}
                      </p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {labelForStatus(item.status)}
                      </p>
                      {item.note ? (
                        <p className="mt-1 text-base text-foreground">{item.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function StatusPage() {
  const t = useTranslations("public");

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

      <main className="mx-auto flex w-full max-w-xl flex-grow flex-col px-6 py-12">
        <Suspense
          fallback={
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          }
        >
          <StatusLookupForm />
        </Suspense>
      </main>

      <footer className="w-full border-t border-border bg-muted/40 py-6 text-center text-sm text-muted-foreground">
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}
