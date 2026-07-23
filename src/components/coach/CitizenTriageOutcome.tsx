"use client";

import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Sparkles,
  Wrench,
} from "lucide-react";

import CoachPanel from "@/components/coach/CoachPanel";
import GuidanceScriptCard from "@/components/coach/GuidanceScriptCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { CitizenServiceStep } from "@/server/services/citizen-status";

export type CitizenTriageOutcomeData = {
  service_step: CitizenServiceStep;
  triage_status: string;
  routing_destination?: string | null;
  category?: string | null;
  severity?: number | null;
  priority?: string | null;
  summary?: string | null;
  recommendation?: string | null;
  playbook_id?: string | null;
  can_escalate?: boolean;
  guidance_script?: string | null;
  guidance_status?: "script_ready" | "generate_later" | null;
  allowed_actions?: string[];
  prohibited_actions?: string[];
};

type Props = {
  reportId: string;
  accessToken: string;
  outcome: CitizenTriageOutcomeData;
  hideStatusLinks?: boolean;
};

function categoryLabel(
  t: ReturnType<typeof useTranslations<"public">>,
  category: string | null | undefined,
): string {
  if (!category) return t("categoryOther");
  const labels: Record<string, Parameters<typeof t>[0]> = {
    pothole: "categoryPothole",
    flooding: "categoryFlooding",
    waste: "categoryWaste",
    streetlight: "categoryStreetlight",
    obstruction: "categoryObstruction",
    graffiti: "categoryOther",
    traffic_signal: "categoryOther",
    utility_hazard: "categoryOther",
    structural_damage: "categoryOther",
    other: "categoryOther",
  };
  const key = labels[category] ?? "categoryOther";
  return t(key);
}

export default function CitizenTriageOutcome({
  reportId,
  accessToken,
  outcome,
  hideStatusLinks = false,
}: Props) {
  const t = useTranslations("public");
  const tt = useTranslations("public.triage");
  const tr = useTranslations("public.routing");
  const tw = useTranslations("public.successOutcome");
  const tg = useTranslations("public.guidance");

  const statusUrl = `/status?reportId=${encodeURIComponent(reportId)}&token=${encodeURIComponent(accessToken)}`;

  if (outcome.service_step === "automated_review_unavailable") {
    return (
      <Alert className="mt-6 border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
        <AlertTriangle className="size-4" aria-hidden />
        <AlertTitle>{tt("calmNoticeTitle")}</AlertTitle>
        <AlertDescription>{tt("calmNoticeBody")}</AlertDescription>
      </Alert>
    );
  }

  if (outcome.service_step === "ai_review_pending") {
    return (
      <Alert className="mt-6">
        <AlertDescription>{t("coach.pollTimeout")}</AlertDescription>
      </Alert>
    );
  }

  const isSelfHelp = outcome.service_step === "self_help_guidance";
  const showGuidanceScript =
    isSelfHelp &&
    outcome.guidance_status === "script_ready" &&
    Boolean(outcome.guidance_script?.trim());
  const summary =
    outcome.summary?.trim() ||
    outcome.recommendation?.trim() ||
    tw("summaryFallback");

  return (
    <section
      className="mt-6 space-y-5"
      aria-labelledby="citizen-triage-outcome-heading"
    >
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {tw("eyebrow")}
              </p>
            </div>
            <h2
              id="citizen-triage-outcome-heading"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {tw("title")}
            </h2>
            <p className="text-sm text-muted-foreground">{tw("advisoryNote")}</p>
          </div>
          <Badge
            variant={isSelfHelp ? "secondary" : "default"}
            className="gap-1.5 px-3 py-1 text-xs font-medium"
          >
            {isSelfHelp ? (
              <>
                <Wrench className="size-3.5" aria-hidden />
                {tw("pathSelfHelp")}
              </>
            ) : (
              <>
                <Building2 className="size-3.5" aria-hidden />
                {tw("pathGovernment")}
              </>
            )}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {outcome.category ? (
            <Badge variant="outline" className="font-normal">
              {tt("categoryLabel")}: {categoryLabel(t, outcome.category)}
            </Badge>
          ) : null}
          {typeof outcome.severity === "number" ? (
            <Badge variant="outline" className="font-normal">
              {tt("severityLabel")}: {outcome.severity}/5
            </Badge>
          ) : null}
          {outcome.priority ? (
            <Badge variant="outline" className="font-normal capitalize">
              {tt("priorityLabel")}: {outcome.priority}
            </Badge>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">{tw("summaryLabel")}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {summary}
            </p>
          </div>

          {outcome.recommendation && outcome.recommendation !== summary ? (
            <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
              <p className="text-sm font-medium text-foreground">
                {tt("recommendationLabel")}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {outcome.recommendation}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>{isSelfHelp ? tw("selfHelpNext") : tw("governmentNext")}</p>
        </div>
      </div>

      {isSelfHelp ? (
        <div className="space-y-4">
          {showGuidanceScript ? (
            <GuidanceScriptCard
              script={outcome.guidance_script!.trim()}
              allowedActions={outcome.allowed_actions}
              prohibitedActions={outcome.prohibited_actions}
            />
          ) : outcome.guidance_status === "generate_later" ? (
            <Alert>
              <AlertDescription>{tg("generateLaterMessage")}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{tw("chatHeading")}</h3>
            <p className="text-sm text-muted-foreground">{tw("chatIntro")}</p>
          </div>
          <CoachPanel reportId={reportId} accessToken={accessToken} />
          {!hideStatusLinks ? (
            <p className="text-sm text-muted-foreground">
              <Link href={statusUrl} className="font-medium text-primary hover:underline">
                {t("coach.resumeOnStatus")}
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <Alert>
          <AlertTitle>{tr("escalateTitle")}</AlertTitle>
          <AlertDescription>
            {hideStatusLinks ? (
              tw("governmentNext")
            ) : (
              <>
                {t("coach.governmentPathBody")}{" "}
                <Link href={statusUrl} className="font-medium text-primary hover:underline">
                  {t("coach.openStatusPage")}
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
