import { getTranslations } from "next-intl/server";

import LocaleSwitcher from "@/components/LocaleSwitcher";
import ReportForm from "@/components/ReportForm";
import { Link } from "@/i18n/navigation";

export default async function ReportPage() {
  const t = await getTranslations("public");
  const tn = await getTranslations("navigation");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="w-full border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-2xl font-bold tracking-tight text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {t("title")}
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {tn("home")}
            </Link>
            <LocaleSwitcher />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-grow flex-col justify-center px-6 py-12">
        <h1 className="sr-only">{t("reportPageTitle")}</h1>
        <ReportForm />
      </main>

      <footer className="w-full border-t border-border bg-muted/40 py-6 text-center text-sm text-muted-foreground">
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}
