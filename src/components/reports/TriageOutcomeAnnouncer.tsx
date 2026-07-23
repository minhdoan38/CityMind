"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TriageOutcomeTone = "success" | "error" | "info";

export type TriageOutcomeMessage = {
  id: number;
  text: string;
  tone: TriageOutcomeTone;
};

type Props = {
  message: TriageOutcomeMessage | null;
  onDismiss: () => void;
};

const TONE_STYLES: Record<TriageOutcomeTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-border bg-card text-foreground",
};

export default function TriageOutcomeAnnouncer({ message, onDismiss }: Props) {
  const t = useTranslations("dashboard.triage");
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [message, onDismiss]);

  return (
    <>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message?.text ?? ""}
      </div>
      {message ? (
        <div
          className={cn(
            "pointer-events-auto fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3 shadow-lg",
            "duration-200 ease-[var(--ease-out-expo)] motion-reduce:duration-0",
            TONE_STYLES[message.tone],
          )}
          role="status"
          aria-live="polite"
        >
          <p className="min-w-0 flex-1 text-sm leading-snug">{message.text}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-inherit hover:bg-black/5"
            onClick={onDismiss}
            aria-label={t("outcomeDismiss")}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </>
  );
}
