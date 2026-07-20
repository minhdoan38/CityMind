"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Download } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  buildReportsQuery,
  type DashboardSearchParams,
} from "./types";

type Props = {
  params: DashboardSearchParams;
  focusExport?: boolean;
};

function filenameFromDisposition(header: string | null, format: string): string {
  if (header) {
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(header);
    if (match?.[1]) {
      return decodeURIComponent(match[1].replace(/"/g, "").trim());
    }
  }
  return format === "xlsx" ? "reports.xlsx" : "reports.csv";
}

export default function ExportButton({ params, focusExport = false }: Props) {
  const t = useTranslations("dashboard");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!focusExport) return;
    triggerRef.current?.focus();
    triggerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusExport]);

  async function download(format: "csv" | "xlsx") {
    setPreparing(true);
    setError(false);

    const filterQs = buildReportsQuery(
      { ...params, cursor: undefined },
      { includeCursor: false },
    );
    const qs = new URLSearchParams(filterQs);
    qs.set("format", format);

    try {
      const res = await fetch(`/api/officer/reports/export?${qs.toString()}`);
      if (!res.ok) {
        setError(true);
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        format,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(true);
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="space-y-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            className="min-h-11 gap-2"
            disabled={preparing}
            aria-busy={preparing}
          >
            <Download className="h-4 w-4" aria-hidden />
            {preparing ? t("exportPreparing") : t("exportReports")}
            <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border border-border">
          <DropdownMenuItem
            disabled={preparing}
            onSelect={() => {
              void download("csv");
            }}
          >
            {t("exportCsv")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={preparing}
            onSelect={() => {
              void download("xlsx");
            }}
          >
            {t("exportExcel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{t("errorTitle")}</AlertTitle>
          <AlertDescription>{t("exportFailed")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
