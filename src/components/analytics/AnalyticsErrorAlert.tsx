"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
  kind: "load" | "api";
};

export default function AnalyticsErrorAlert({ kind }: Props) {
  const t = useTranslations("dashboard.analytics");
  const router = useRouter();

  return (
    <Alert variant="destructive">
      <AlertTitle>{t("errorLoad")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{kind === "api" ? t("errorApi") : t("errorLoad")}</span>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0"
          onClick={() => router.refresh()}
        >
          {t("retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
