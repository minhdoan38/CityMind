"use client";

import { Check, Loader2, ScanSearch, Send, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

type AnalyzeStep = 0 | 1 | 2 | 3;

const STEP_ICONS = [Send, Sparkles, ScanSearch] as const;

type ReportAnalyzingStateProps = {
  step: AnalyzeStep;
};

export default function ReportAnalyzingState({ step }: ReportAnalyzingStateProps) {
  const t = useTranslations("public");

  const steps = [
    { label: t("submitting"), key: "send" },
    { label: t("analyzing"), key: "review" },
    { label: t("analyzeStepPrepare"), key: "prepare" },
  ] as const;

  const activeIndex = step >= 3 ? steps.length : Math.min(step, steps.length - 1);
  const progress =
    step >= 3 ? 100 : Math.round(((activeIndex + 0.35) / steps.length) * 100);

  return (
    <div
      className="report-analyze-panel"
      role="status"
      aria-busy={step < 3}
      aria-live="polite"
    >
      <div className="report-analyze-header hero-rise">
        <div
          className="report-analyze-orbit"
          aria-hidden
        >
          <span className="report-analyze-orbit-ring" />
          <span className="report-analyze-orbit-core">
            {step >= 3 ? (
              <Check className="size-7 stroke-[2.5]" />
            ) : (
              <Loader2 className="size-7 animate-spin stroke-[2.5]" />
            )}
          </span>
        </div>

        <h2 className="report-analyze-title font-heading text-balance">
          {step >= 3 ? t("analyzeStepDone") : t("analyzePanelTitle")}
        </h2>
        <p className="report-analyze-hint text-pretty">{t("analyzePanelHint")}</p>
      </div>

      <ol className="report-analyze-steps" aria-label={t("analyzePanelTitle")}>
        {steps.map((item, index) => {
          const Icon = STEP_ICONS[index];
          const isComplete = step > index || step >= 3;
          const isActive = !isComplete && activeIndex === index;

          return (
            <li
              key={item.key}
              className={[
                "report-analyze-step hero-rise",
                isComplete ? "report-analyze-step-complete" : "",
                isActive ? "report-analyze-step-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ animationDelay: `${80 + index * 70}ms` }}
            >
              <span
                className={[
                  "report-analyze-icon",
                  isComplete ? "report-analyze-icon-complete" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden
              >
                {isComplete ? (
                  <Check className="size-4 stroke-[2.75]" />
                ) : (
                  <Icon className="size-4 stroke-[2.5]" />
                )}
              </span>
              <span className="report-analyze-step-label">{item.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="report-analyze-progress" aria-hidden>
        <div
          className="report-analyze-progress-fill"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
    </div>
  );
}
