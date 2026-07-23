"use client";

import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  script: string;
  allowedActions?: string[];
  prohibitedActions?: string[];
};

export default function GuidanceScriptCard({
  script,
  allowedActions = [],
  prohibitedActions = [],
}: Props) {
  const t = useTranslations("public.guidance");

  return (
    <section
      className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4"
      aria-labelledby="guidance-script-heading"
    >
      <div className="flex items-center gap-2 text-primary">
        <BookOpen className="size-4" aria-hidden />
        <h3 className="text-sm font-semibold uppercase tracking-wide">{t("title")}</h3>
      </div>

      <p id="guidance-script-heading" className="text-sm leading-relaxed text-foreground">
        {script}
      </p>

      {allowedActions.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-foreground">{t("allowedTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {allowedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {prohibitedActions.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-foreground">{t("prohibitedTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {prohibitedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Alert className="border-border bg-background/80">
        <AlertDescription className="text-xs text-muted-foreground">
          {t("disclaimer")}
        </AlertDescription>
      </Alert>
    </section>
  );
}
