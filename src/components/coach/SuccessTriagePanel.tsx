"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";

import CitizenTriageOutcome, {
  type CitizenTriageOutcomeData,
} from "@/components/coach/CitizenTriageOutcome";
import { Alert, AlertDescription } from "@/components/ui/alert";

type StatusPayload = CitizenTriageOutcomeData & {
  report_id?: string;
};

type Props = {
  reportId: string;
  accessToken: string;
  initialOutcome?: CitizenTriageOutcomeData;
  hideStatusLinks?: boolean;
};

const TERMINAL_TRIAGE = new Set(["completed", "failed", "manual_review"]);

export function isOutcomeReady(outcome?: CitizenTriageOutcomeData | null): boolean {
  if (!outcome) return false;
  return (
    outcome.service_step !== "ai_review_pending" &&
    outcome.triage_status !== "pending" &&
    outcome.triage_status !== "processing" &&
    outcome.triage_status !== "retry"
  );
}

function statusToOutcome(data: StatusPayload): CitizenTriageOutcomeData {
  return {
    service_step: data.service_step,
    triage_status: data.triage_status,
    routing_destination: data.routing_destination ?? null,
    category: data.category ?? null,
    severity: data.severity ?? null,
    priority: data.priority ?? null,
    summary: data.summary ?? null,
    recommendation: data.recommendation ?? null,
    playbook_id: data.playbook_id ?? null,
    can_escalate: data.can_escalate ?? false,
    guidance_script: data.guidance_script ?? null,
    guidance_status: data.guidance_status ?? null,
    allowed_actions: data.allowed_actions ?? [],
    prohibited_actions: data.prohibited_actions ?? [],
  };
}

export default function SuccessTriagePanel({
  reportId,
  accessToken,
  initialOutcome,
  hideStatusLinks = false,
}: Props) {
  const t = useTranslations("public");
  const tw = useTranslations("public.statusWorkflow");
  const [outcome, setOutcome] = useState<CitizenTriageOutcomeData | null>(
    isOutcomeReady(initialOutcome) ? (initialOutcome ?? null) : null,
  );
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isOutcomeReady(initialOutcome)) {
      setOutcome(initialOutcome ?? null);
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      while (!cancelled) {
        const elapsed = Date.now() - startedAt;
        if (elapsed > 60_000) {
          setTimedOut(true);
          return;
        }

        try {
          const res = await fetch("/api/public/reports/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ report_id: reportId, token: accessToken }),
          });
          if (res.ok) {
            const data = (await res.json()) as StatusPayload;
            if (!cancelled && TERMINAL_TRIAGE.has(data.triage_status)) {
              setOutcome(statusToOutcome(data));
              return;
            }
          }
        } catch {
          /* keep polling */
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, elapsed > 30_000 ? 5_000 : 2_000);
        });
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [reportId, accessToken, initialOutcome]);

  if (!outcome) {
    return (
      <div
        className="mt-6 space-y-4 rounded-xl border border-border bg-muted/30 p-6"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="size-4 shrink-0 animate-pulse" aria-hidden />
          <p className="text-sm font-semibold uppercase tracking-wide">
            {t("successPreparingEyebrow")}
          </p>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{t("successPreparingTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("successPreparingBody")}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span>{timedOut ? t("coach.pollTimeout") : tw("stepAiPending")}</span>
        </div>
      </div>
    );
  }

  return (
    <CitizenTriageOutcome
      reportId={reportId}
      accessToken={accessToken}
      outcome={outcome}
      hideStatusLinks={hideStatusLinks}
    />
  );
}
