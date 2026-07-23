"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell, LogOut, Search, User } from "lucide-react";

import BrandSidebarToggle from "@/components/dashboard/BrandSidebarToggle";
import AiHealthChip from "@/components/dashboard/AiHealthChip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { setUserLocale } from "@/services/locale";

type DashboardNavbarProps = {
  userEmail: string;
};

function meaningfulEmailInitials(email: string): string | null {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0]![0] ?? "";
    const second = parts[1]![0] ?? "";
    if (/[a-zA-Z]/.test(first) && /[a-zA-Z]/.test(second)) {
      return `${first}${second}`.toUpperCase();
    }
    return null;
  }

  const alpha = local.replace(/[^a-zA-Z]/g, "");
  if (alpha.length >= 2) {
    return alpha.slice(0, 2).toUpperCase();
  }

  return null;
}

function useModifierKeyLabel(): string {
  const [label, setLabel] = useState("Ctrl");

  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    setLabel(isMac ? "⌘" : "Ctrl");
  }, []);

  return label;
}

export default function DashboardNavbar({ userEmail }: DashboardNavbarProps) {
  const router = useRouter();
  const locale = useLocale();
  const tNav = useTranslations("dashboard.navbar");
  const tLocale = useTranslations("locale");
  const tLogout = useTranslations("logout");
  const modifierKey = useModifierKeyLabel();
  const { state: sidebarState } = useSidebar();

  const [searchOpen, setSearchOpen] = useState(false);
  const [reportQuery, setReportQuery] = useState("");

  const initials = useMemo(
    () => meaningfulEmailInitials(userEmail),
    [userEmail],
  );

  const openSearch = useCallback(() => {
    setReportQuery("");
    setSearchOpen(true);
  }, []);

  const navigateToReport = useCallback(
    (raw: string) => {
      const reportId = raw.trim();
      if (!reportId) return;
      setSearchOpen(false);
      router.push(`/dashboard/reports/${encodeURIComponent(reportId)}`);
    },
    [router],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  const handleLogout = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/session/logout";
    document.body.appendChild(form);
    form.submit();
  };

  const switchLocale = async (nextLocale: string) => {
    await setUserLocale(nextLocale);
    router.refresh();
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 flex h-16 w-full shrink-0 items-stretch border-b border-border bg-card",
          "shadow-[var(--shadow-card)]",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center overflow-hidden transition-[width] duration-200 ease-linear",
            sidebarState === "expanded"
              ? "w-[var(--sidebar-width)] px-4"
              : "w-[var(--sidebar-width-icon)] justify-center px-0",
          )}
        >
          <BrandSidebarToggle />
        </div>

        <div className="flex min-w-0 flex-1 items-center px-3 sm:px-5">
          <button
            type="button"
            onClick={openSearch}
            className={cn(
              "group dash-control-surface flex w-full items-center gap-2.5 px-3.5 sm:gap-3 sm:px-4",
              "bg-muted/50 transition-[border-color,background-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
              "hover:border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] hover:bg-muted/80 hover:shadow-sm",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            )}
            aria-label={tNav("searchAria")}
          >
            <Search
              className="size-[1.125rem] shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-muted-foreground group-hover:text-foreground/80">
              {tNav("searchPlaceholder")}
            </span>
            <kbd
              className={cn(
                "hidden shrink-0 items-center rounded-md border border-border bg-card px-1.5 py-0.5",
                "font-code text-[0.6875rem] font-semibold leading-none text-muted-foreground sm:inline-flex",
              )}
            >
              {modifierKey}&nbsp;K
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 px-3 sm:gap-2.5 sm:px-5">
          <AiHealthChip className="shrink-0 max-sm:min-h-8 max-sm:px-2.5 max-sm:text-xs" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 border-border bg-card text-foreground hover:bg-muted [&_svg]:size-[1.125rem] [&_svg]:stroke-[2.25]"
                aria-label={tNav("notificationsAria")}
              >
                <Bell strokeWidth={2.25} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tNav("notificationsEmpty")}</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "size-10 overflow-hidden border-border bg-card p-0",
                  "text-foreground transition-colors hover:bg-muted",
                  "[&_svg]:size-[1.125rem] [&_svg]:stroke-[2.25]",
                )}
                aria-label={tNav("accountMenuAria")}
              >
                {initials ? (
                  <span
                    aria-hidden
                    className="flex size-full items-center justify-center bg-muted font-heading text-xs font-bold tracking-tight text-muted-foreground ring-1 ring-inset ring-border"
                  >
                    {initials}
                  </span>
                ) : (
                  <User
                    className="text-muted-foreground"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 border-border">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {tNav("signedInAs")}
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                  {userEmail}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer font-medium"
                onClick={() => switchLocale("en")}
                disabled={locale === "en"}
              >
                {tLocale("en")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer font-medium"
                onClick={() => switchLocale("vi")}
                disabled={locale === "vi"}
              >
                {tLocale("vi")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer font-medium text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="size-4 stroke-[2.25]" />
                {tLogout("submit")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="gap-5 sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-semibold tracking-tight">
              {tNav("searchTitle")}
            </DialogTitle>
            <DialogDescription>{tNav("searchDescription")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              navigateToReport(reportQuery);
            }}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={2.25}
                aria-hidden
              />
              <Input
                autoFocus
                value={reportQuery}
                onChange={(event) => setReportQuery(event.target.value)}
                placeholder={tNav("searchInputPlaceholder")}
                className="h-10 rounded-[var(--radius-control)] border-border bg-muted/40 pr-3 pl-10 text-base font-medium placeholder:font-normal"
                aria-label={tNav("searchInputPlaceholder")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSearchOpen(false)}
              >
                {tNav("searchCancel")}
              </Button>
              <Button type="submit" className="font-semibold">
                {tNav("searchGo")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
