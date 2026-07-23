"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import CityMindLogo from "@/components/CityMindLogo";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";

type Props = {
  children: ReactNode;
};

export default function ReportOutcomeLayout({ children }: Props) {
  const t = useTranslations("public");
  const tn = useTranslations("navigation");

  return (
    <div className="report-page flex min-h-screen flex-col bg-background text-foreground">
      <header className="report-page-header sticky top-0 z-40 border-b border-border bg-card shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center gap-3 text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <CityMindLogo size={34} priority className="rounded-md" />
            <span className="font-heading">{t("title")}</span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {tn("home")}
            </Link>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <main className="report-page-main mx-auto flex w-full max-w-2xl flex-grow flex-col justify-center px-6 py-10 sm:py-14">
        {children}
      </main>

      <footer className="report-page-footer w-full border-t border-border bg-muted/30 py-6 text-center text-sm text-muted-foreground">
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}
