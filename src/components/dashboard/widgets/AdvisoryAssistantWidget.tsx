"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Mic, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WidgetCard from "./WidgetCard";

type Props = {
  delayClass?: string;
};

export default function AdvisoryAssistantWidget({ delayClass }: Props) {
  const t = useTranslations("dashboard.widgets");
  const [query, setQuery] = useState("");

  return (
    <WidgetCard title={t("assistantTitle")} delayClass={delayClass}>
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-28 w-full items-center justify-center">
          <div
            aria-hidden
            className="assistant-orbit absolute size-28 rounded-full border border-dashed border-primary/25"
          />
          <div
            aria-hidden
            className="assistant-sphere size-20 rounded-full"
          />
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {t("assistantDisclaimer")}
        </p>

        <form
          className="flex w-full items-center gap-2 rounded-full border border-border bg-muted/50 p-1.5 pl-3"
          onSubmit={(event) => event.preventDefault()}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-muted-foreground"
            aria-label={t("assistantAttach")}
          >
            <Paperclip className="size-4" />
          </Button>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("assistantPlaceholder")}
            className="min-h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-describedby="assistant-hint"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-muted-foreground"
            aria-label={t("assistantVoice")}
          >
            <Mic className="size-4" />
          </Button>
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label={t("assistantSend")}
            disabled
            title={t("assistantComingSoon")}
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
        <p id="assistant-hint" className="sr-only">
          {t("assistantComingSoon")}
        </p>
      </div>
    </WidgetCard>
  );
}
