"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import type { GeoPin } from "./types";

type Props = {
  pins: GeoPin[];
};

export default function IncidentsListPanel({ pins }: Props) {
  const t = useTranslations("dashboard.map");
  const router = useRouter();

  return (
    <Collapsible className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-10 w-full justify-between rounded-b-none"
        >
          {t("listPanelToggle")}
          <span className="text-xs text-muted-foreground">{pins.length}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-64 overflow-y-auto border-t border-border">
        {pins.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {t("emptyHeading")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pins.map((pin) => (
              <li key={pin.report_id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left text-sm hover:bg-secondary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={() =>
                    router.push(`/dashboard/reports/${pin.report_id}`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      router.push(`/dashboard/reports/${pin.report_id}`);
                    }
                  }}
                >
                  <span className="font-medium text-foreground">
                    {pin.category} · {pin.priority}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pin.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
