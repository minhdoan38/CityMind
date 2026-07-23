"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, Copy, Loader2, RefreshCw, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  hasTriageOutputSummary,
  parseTriageOutputSummary,
  type TriageOutputSummary,
} from "@/lib/triage-output-summary";
import { cn } from "@/lib/utils";
import type { TriageConsoleCaseRow } from "@/server/repositories/triage-console";

type Props = {
  initialReportId?: string;
};

function dispositionVariant(
  disposition: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (disposition === "completed") return "default";
  if (disposition === "failed") return "destructive";
  if (disposition === "manual_review" || disposition === "retry") return "secondary";
  return "outline";
}

function logDispositionBadgeClass(disposition: string): string {
  if (disposition === "completed") return "agent-console-log-badge--completed";
  if (disposition === "failed") return "agent-console-log-badge--failed";
  return "agent-console-log-badge--pending";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatValidationErrors(value: unknown): string {
  if (!value) return "[]";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function caseAttemptCount(item: TriageConsoleCaseRow) {
  return item.runs.reduce((n, run) => n + run.attempts.length, 0);
}

function formatDispositionLabel(
  disposition: string,
  t: (key: "dispositionCompleted" | "dispositionFailed" | "dispositionManualReview" | "dispositionRetry") => string,
): string {
  switch (disposition) {
    case "completed":
      return t("dispositionCompleted");
    case "failed":
      return t("dispositionFailed");
    case "manual_review":
      return t("dispositionManualReview");
    case "retry":
      return t("dispositionRetry");
    default:
      return disposition;
  }
}

function TriageSummaryBlock({
  summary,
  labels,
}: {
  summary: TriageOutputSummary;
  labels: {
    category: string;
    matchedIssue: string;
    matchedYes: string;
    matchedNo: string;
    observedFacts: string;
    inferences: string;
    outputLanguage: string;
  };
}) {
  return (
    <dl className="agent-console-log-summary space-y-0">
      {summary.category ? (
        <>
          <dt>{labels.category}</dt>
          <dd>{summary.category}</dd>
        </>
      ) : null}
      {summary.matched_known_issue !== undefined ? (
        <>
          <dt>{labels.matchedIssue}</dt>
          <dd>{summary.matched_known_issue ? labels.matchedYes : labels.matchedNo}</dd>
        </>
      ) : null}
      {summary.output_language ? (
        <>
          <dt>{labels.outputLanguage}</dt>
          <dd className="font-mono">{summary.output_language}</dd>
        </>
      ) : null}
      {summary.observed_facts.length > 0 ? (
        <>
          <dt>{labels.observedFacts}</dt>
          <dd>
            <ul className="list-disc space-y-1 pl-4">
              {summary.observed_facts.map((fact, index) => (
                <li key={`fact-${index}`}>{fact}</li>
              ))}
            </ul>
          </dd>
        </>
      ) : null}
      {summary.inferences.length > 0 ? (
        <>
          <dt>{labels.inferences}</dt>
          <dd>
            <ul className="list-disc space-y-1 pl-4">
              {summary.inferences.map((item, index) => (
                <li key={`inference-${index}`}>{item}</li>
              ))}
            </ul>
          </dd>
        </>
      ) : null}
    </dl>
  );
}

export default function AgentConsoleViewer({ initialReportId = "" }: Props) {
  const t = useTranslations("dashboard.agentConsole");
  const [cases, setCases] = useState<TriageConsoleCaseRow[]>([]);
  const [filter, setFilter] = useState(initialReportId);
  const [appliedFilter, setAppliedFilter] = useState(initialReportId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRawOutput, setExpandedRawOutput] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedCaseIndex, setFocusedCaseIndex] = useState(0);
  const [mobileShowLog, setMobileShowLog] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [copiedReportId, setCopiedReportId] = useState(false);
  const [copiedJsonId, setCopiedJsonId] = useState<string | null>(null);
  const caseButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (reportId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (reportId?.trim()) {
          params.set("report_id", reportId.trim());
        }
        const suffix = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/officer/triage-console${suffix}`);
        if (!res.ok) {
          setError(t("loadError"));
          setCases([]);
          setLiveMessage("");
          return;
        }
        const body = (await res.json()) as { cases?: TriageConsoleCaseRow[] };
        const nextCases = body.cases ?? [];
        setCases(nextCases);
        const attempts = nextCases.reduce((sum, item) => sum + caseAttemptCount(item), 0);
        setLiveMessage(t("loadedSummary", { cases: nextCases.length, attempts }));
      } catch {
        setError(t("loadError"));
        setCases([]);
        setLiveMessage("");
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load(initialReportId || undefined);
    setAppliedFilter(initialReportId);
  }, [initialReportId, load]);

  useEffect(() => {
    if (!cases.length) {
      setSelectedId(null);
      return;
    }
    const preferred = initialReportId.trim();
    if (preferred && cases.some((item) => item.report_id === preferred)) {
      setSelectedId(preferred);
      const index = cases.findIndex((item) => item.report_id === preferred);
      if (index >= 0) setFocusedCaseIndex(index);
      return;
    }
    setSelectedId((current) => {
      if (current && cases.some((item) => item.report_id === current)) {
        return current;
      }
      return cases[0]?.report_id ?? null;
    });
    setFocusedCaseIndex((current) => Math.min(current, Math.max(cases.length - 1, 0)));
  }, [cases, initialReportId]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (filter === appliedFilter) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      setAppliedFilter(filter);
      void load(filter.trim() || undefined);
    }, 500);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filter, appliedFilter, load]);

  useEffect(() => {
    const active = document.activeElement;
    const inCaseList = caseButtonRefs.current.some((button) => button === active);
    if (!inCaseList || !cases[focusedCaseIndex]) {
      return;
    }
    caseButtonRefs.current[focusedCaseIndex]?.focus();
  }, [focusedCaseIndex, cases]);

  const totalAttempts = useMemo(
    () => cases.reduce((sum, item) => sum + caseAttemptCount(item), 0),
    [cases],
  );

  const selectedCase = useMemo(
    () => cases.find((item) => item.report_id === selectedId) ?? null,
    [cases, selectedId],
  );

  const summaryLabels = useMemo(
    () => ({
      category: t("summaryCategory"),
      matchedIssue: t("summaryMatchedIssue"),
      matchedYes: t("summaryMatchedYes"),
      matchedNo: t("summaryMatchedNo"),
      observedFacts: t("summaryObservedFacts"),
      inferences: t("summaryInferences"),
      outputLanguage: t("summaryOutputLanguage"),
    }),
    [t],
  );

  function clearFilter() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setFilter("");
    setAppliedFilter("");
    void load(undefined);
  }

  function applyFilterNow() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setAppliedFilter(filter);
    void load(filter.trim() || undefined);
  }

  function toggleRawOutput(attemptId: string) {
    setExpandedRawOutput((current) => {
      const next = new Set(current);
      if (next.has(attemptId)) {
        next.delete(attemptId);
      } else {
        next.add(attemptId);
      }
      return next;
    });
  }

  function focusCaseButton(index: number) {
    requestAnimationFrame(() => {
      caseButtonRefs.current[index]?.focus();
    });
  }

  function selectCase(reportId: string, index?: number) {
    setSelectedId(reportId);
    setMobileShowLog(true);
    const resolvedIndex = index ?? cases.findIndex((item) => item.report_id === reportId);
    if (resolvedIndex >= 0) {
      setFocusedCaseIndex(resolvedIndex);
    }
  }

  function handleCaseListKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!cases.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(index + 1, cases.length - 1);
      setFocusedCaseIndex(next);
      selectCase(cases[next]!.report_id, next);
      focusCaseButton(next);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(index - 1, 0);
      setFocusedCaseIndex(next);
      selectCase(cases[next]!.report_id, next);
      focusCaseButton(next);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectCase(cases[index]!.report_id, index);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setFocusedCaseIndex(0);
      selectCase(cases[0]!.report_id, 0);
      focusCaseButton(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      const last = cases.length - 1;
      setFocusedCaseIndex(last);
      selectCase(cases[last]!.report_id, last);
      focusCaseButton(last);
    }
  }

  async function copyReportId(reportId: string) {
    try {
      await navigator.clipboard.writeText(reportId);
      setCopiedReportId(true);
      setLiveMessage(t("reportIdCopied"));
      setTimeout(() => setCopiedReportId(false), 2000);
    } catch {
      setLiveMessage("");
    }
  }

  async function copyJson(attemptId: string, raw: string) {
    try {
      await navigator.clipboard.writeText(raw);
      setCopiedJsonId(attemptId);
      setLiveMessage(t("jsonCopied"));
      setTimeout(() => setCopiedJsonId(null), 2000);
    } catch {
      setLiveMessage("");
    }
  }

  const showTruncationNotice = !appliedFilter.trim() && !loading && cases.length > 0;
  const filterPending = filter !== appliedFilter;

  return (
    <div className="space-y-4">
      <div
        className="dash-rise flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between"
        role="search"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:max-w-lg">
          <label htmlFor="agent-console-filter" className="text-sm font-medium text-foreground">
            {t("filterLabel")}
          </label>
          <Input
            id="agent-console-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyFilterNow();
              }
            }}
            placeholder={t("filterPlaceholder")}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {filterPending ? (
              <span className="text-primary">{t("filterPending")}</span>
            ) : (
              t("filterApplyHint")
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={filterPending ? "default" : "outline"}
              onClick={() => applyFilterNow()}
              disabled={loading}
              aria-label={filterPending ? t("applyNow") : t("refresh")}
            >
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 size-4" aria-hidden />
              )}
              {filterPending ? t("applyNow") : t("refresh")}
            </Button>
            {filter.trim() ? (
              <Button type="button" variant="ghost" onClick={clearFilter}>
                {t("clearFilter")}
              </Button>
            ) : null}
          </div>
          {!loading && cases.length > 0 && appliedFilter.trim() ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {t("stats", { cases: cases.length, attempts: totalAttempts })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {loading ? t("loading") : liveMessage}
      </div>

      {showTruncationNotice ? (
        <p role="note" className="text-sm text-muted-foreground">
          {t("truncationNotice")}
          <span className="mx-2 text-border" aria-hidden>
            ·
          </span>
          <span className="tabular-nums">{t("stats", { cases: cases.length, attempts: totalAttempts })}</span>
        </p>
      ) : null}

      {error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => applyFilterNow()}>
            {t("retryLoad")}
          </Button>
        </div>
      ) : null}

      {loading && !cases.length ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-5 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("loading")}
        </div>
      ) : null}

      {!loading && !cases.length && !error ? (
        <div className="rounded-lg border border-border px-5 py-10 text-center">
          <ScrollText className="mx-auto mb-3 size-8 text-muted-foreground/70" aria-hidden />
          <p className="text-base text-muted-foreground">
            {appliedFilter.trim() ? t("emptyFiltered") : t("emptyRecent")}
          </p>
          {appliedFilter.trim() ? (
            <Button type="button" variant="outline" className="mt-4" onClick={clearFilter}>
              {t("clearFilter")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {cases.length > 0 ? (
        <div
          className={cn(
            "surface-card dash-rise dash-rise-delay-1 overflow-hidden lg:grid lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:items-stretch",
            loading && "agent-console-split--busy",
          )}
          aria-busy={loading}
        >
          <aside
            className={cn(
              "flex min-h-0 flex-col border-border",
              mobileShowLog ? "hidden lg:flex lg:border-r" : "flex border-b lg:border-b-0 lg:border-r",
            )}
            aria-label={t("casesHeading")}
          >
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground text-balance">
                {t("casesHeading")}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t("casesHint")}</p>
            </div>
            <ul
              className="max-h-[min(52vh,28rem)] divide-y divide-border overflow-y-auto lg:max-h-[calc(100vh-16rem)]"
              role="listbox"
              aria-activedescendant={
                cases[focusedCaseIndex]
                  ? `agent-console-case-${cases[focusedCaseIndex]!.report_id}`
                  : undefined
              }
            >
              {cases.map((item, index) => {
                const attempts = caseAttemptCount(item);
                const selected = item.report_id === selectedId;
                const focused = index === focusedCaseIndex;
                return (
                  <li key={item.report_id} role="presentation">
                    <button
                      type="button"
                      id={`agent-console-case-${item.report_id}`}
                      ref={(node) => {
                        caseButtonRefs.current[index] = node;
                      }}
                      onClick={() => selectCase(item.report_id, index)}
                      onKeyDown={(event) => handleCaseListKeyDown(event, index)}
                      tabIndex={focused ? 0 : -1}
                      role="option"
                      aria-selected={selected}
                      aria-label={t("caseAriaLabel", {
                        id: item.report_id.slice(0, 8),
                        attempts,
                      })}
                      className={cn(
                        "agent-console-case-option flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors duration-150",
                        selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-medium leading-snug break-all" aria-hidden>
                          {item.report_id.slice(0, 8)}…
                        </span>
                        <Badge variant="outline" className="shrink-0 tabular-nums" aria-hidden>
                          {attempts}
                        </Badge>
                      </div>
                      {item.description ? (
                        <p
                          className={cn(
                            "line-clamp-2 text-sm leading-snug",
                            selected ? "text-accent-foreground/90" : "text-muted-foreground",
                          )}
                          aria-hidden
                        >
                          {item.description}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section
            className={cn(
              "flex min-w-0 flex-col",
              !mobileShowLog && "hidden lg:flex",
              mobileShowLog && "flex",
            )}
            aria-label={t("logHeading")}
          >
            {selectedCase ? (
              <>
                <header className="border-b border-border px-4 py-4 sm:px-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-2 -ml-2 h-8 px-2 lg:hidden"
                    onClick={() => setMobileShowLog(false)}
                  >
                    <ChevronLeft className="mr-1 size-4" aria-hidden />
                    {t("backToCases")}
                  </Button>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground text-balance">
                        {t("logHeading")}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/reports/${encodeURIComponent(selectedCase.report_id)}`}
                          className="break-all font-mono text-sm font-medium text-primary hover:underline"
                        >
                          {selectedCase.report_id}
                        </Link>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2.5"
                          aria-label={t("copyReportId")}
                          onClick={() => void copyReportId(selectedCase.report_id)}
                        >
                          {copiedReportId ? (
                            <Check className="size-3.5 text-emerald-600" aria-hidden />
                          ) : (
                            <Copy className="size-3.5" aria-hidden />
                          )}
                          <span className="text-xs">
                            {copiedReportId ? t("copied") : t("copyReportId")}
                          </span>
                        </Button>
                      </div>
                      {selectedCase.description ? (
                        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                          {selectedCase.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{selectedCase.triage_status}</Badge>
                      {selectedCase.category ? (
                        <Badge variant="secondary">{selectedCase.category}</Badge>
                      ) : null}
                    </div>
                  </div>
                </header>

                <div className="flex-1 space-y-5 bg-[var(--dashboard-canvas)]/35 p-4 sm:p-5 lg:min-h-[calc(100vh-14rem)]">
                  {selectedCase.runs.map((run, runIndex) => (
                    <div
                      key={run.run_id}
                      className={cn("space-y-2", runIndex > 0 && "border-t border-border pt-5")}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span className="font-mono text-xs text-foreground">
                          {run.run_id.slice(0, 8)}…
                        </span>
                        <span aria-hidden>·</span>
                        <time className="tabular-nums">{formatTimestamp(run.started_at)}</time>
                        {run.final_disposition ? (
                          <Badge variant={dispositionVariant(run.final_disposition)}>
                            {formatDispositionLabel(run.final_disposition, t)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t("runInProgress")}</Badge>
                        )}
                      </div>

                      <div className="agent-console-log p-3 sm:p-4">
                        {run.attempts.length === 0 ? (
                          <p className="agent-console-log-meta">{t("noAttempts")}</p>
                        ) : (
                          <ul className="space-y-5">
                            {run.attempts.map((attempt) => {
                              const rawExpanded = expandedRawOutput.has(attempt.attempt_id);
                              const raw = attempt.raw_output ?? "";
                              const preview = raw.slice(0, 320);
                              const hasMore = raw.length > preview.length;
                              const summary = parseTriageOutputSummary(raw);
                              const showSummary = hasTriageOutputSummary(summary);
                              const rawPanelId = `raw-output-${attempt.attempt_id}`;

                              return (
                                <li key={attempt.attempt_id} className="agent-console-log-attempt space-y-3">
                                  <div className="agent-console-log-meta flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="agent-console-log-ts">
                                      {formatTimestamp(attempt.created_at)}
                                    </span>
                                    <span className="tabular-nums">
                                      {t("attemptLabel", { number: attempt.attempt_number })}
                                    </span>
                                    {attempt.model ? (
                                      <span className="font-mono">{attempt.model}</span>
                                    ) : null}
                                    {attempt.latency_ms != null ? (
                                      <span className="tabular-nums">
                                        {attempt.latency_ms}
                                        ms
                                      </span>
                                    ) : null}
                                    <span
                                      className={cn(
                                        "agent-console-log-badge",
                                        logDispositionBadgeClass(attempt.disposition),
                                      )}
                                    >
                                      {formatDispositionLabel(attempt.disposition, t)}
                                    </span>
                                    {raw ? (
                                      <button
                                        type="button"
                                        className="agent-console-log-action inline-flex items-center gap-1 text-[0.6875rem] font-medium hover:underline"
                                        aria-label={t("copyJson")}
                                        onClick={() => void copyJson(attempt.attempt_id, raw)}
                                      >
                                        {copiedJsonId === attempt.attempt_id ? (
                                          <Check className="size-3" aria-hidden />
                                        ) : (
                                          <Copy className="size-3" aria-hidden />
                                        )}
                                        {copiedJsonId === attempt.attempt_id
                                          ? t("copied")
                                          : t("copyJson")}
                                      </button>
                                    ) : null}
                                  </div>

                                  {Array.isArray(attempt.validation_errors) &&
                                  attempt.validation_errors.length > 0 ? (
                                    <pre className="agent-console-log-warn overflow-x-auto p-2.5 whitespace-pre-wrap">
                                      {formatValidationErrors(attempt.validation_errors)}
                                    </pre>
                                  ) : null}

                                  {showSummary && summary ? (
                                    <TriageSummaryBlock summary={summary} labels={summaryLabels} />
                                  ) : null}

                                  {raw ? (
                                    <div className="space-y-2">
                                      {showSummary || hasMore ? (
                                        <>
                                          <button
                                            type="button"
                                            id={`toggle-${attempt.attempt_id}`}
                                            className="agent-console-log-action text-xs font-medium hover:underline"
                                            aria-expanded={rawExpanded}
                                            aria-controls={rawPanelId}
                                            onClick={() => toggleRawOutput(attempt.attempt_id)}
                                          >
                                            {rawExpanded ? t("hideRawOutput") : t("showRawOutput")}
                                          </button>
                                          {rawExpanded ? (
                                            <pre
                                              id={rawPanelId}
                                              className="max-w-[75ch] overflow-x-auto whitespace-pre-wrap text-[0.8125rem] leading-relaxed"
                                            >
                                              {raw || t("noOutput")}
                                            </pre>
                                          ) : null}
                                        </>
                                      ) : (
                                        <pre
                                          id={rawPanelId}
                                          className="max-w-[75ch] overflow-x-auto whitespace-pre-wrap text-[0.8125rem] leading-relaxed"
                                        >
                                          {raw || t("noOutput")}
                                        </pre>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="agent-console-log-meta">{t("noOutput")}</p>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                {t("selectCase")}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
