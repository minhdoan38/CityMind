"use client";

import { useTranslations } from "next-intl";
import { PanelLeft } from "lucide-react";

import CityMindLogo from "@/components/CityMindLogo";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export default function BrandSidebarToggle() {
  const { toggleSidebar, state } = useSidebar();
  const tNav = useTranslations("dashboard.navbar");
  const isCollapsed = state === "collapsed";

  return (
    <div
      className={cn(
        "flex w-full items-center",
        isCollapsed ? "justify-center" : "justify-between gap-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "group/logo relative flex shrink-0 items-center justify-center rounded-lg p-0.5",
            "transition-colors duration-150 ease-[var(--ease-out-expo)]",
            "hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
          aria-label={tNav("toggleSidebarAria")}
        >
          <CityMindLogo
            size={isCollapsed ? 30 : 32}
            className="shrink-0 transition-transform duration-150 group-hover/logo:scale-105"
          />
        </button>
        {!isCollapsed ? (
          <span className="dash-brand-wordmark min-w-0 truncate">
            <span className="dash-brand-wordmark__name">CityMind</span>
            <span className="dash-brand-wordmark__suffix"> AI</span>
          </span>
        ) : (
          <span className="sr-only">CityMind AI</span>
        )}
      </div>

      {!isCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex size-7.5 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={tNav("toggleSidebarAria")}
          title={tNav("toggleSidebarAria")}
        >
          <PanelLeft className="size-4 stroke-[2]" aria-hidden />
        </button>
      )}
    </div>
  );
}
