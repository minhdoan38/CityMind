import Link from "next/link";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default function Home() {
  const t = useTranslations("public");
  const nav = useTranslations("navigation");

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Accessible Header */}
      <header className="w-full max-w-6xl mx-auto px-4 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          {/* CityMind Wordmark */}
          <span className="text-2xl font-semibold tracking-tight text-primary">
            {t("title")}
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium hover:text-primary min-h-11 py-2.5 px-3 flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {nav("login")}
          </Link>
          <LocaleSwitcher />
        </nav>
      </header>

      {/* Semantic Main Content */}
      <main className="flex-grow flex items-center justify-center max-w-4xl mx-auto px-4 py-12">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            {t("description")}
          </p>
          <div className="pt-4 flex justify-center">
            <Link
              href="/report"
              className="inline-flex items-center justify-center min-h-11 px-6 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 transition-colors"
            >
              {t("reportCTA")}
            </Link>
          </div>
        </div>
      </main>

      {/* Semantic Footer */}
      <footer className="w-full max-w-6xl mx-auto px-4 py-6 border-t border-border text-center text-sm text-muted-foreground">
        <p>{t("footer")}</p>
      </footer>
    </div>
  );
}
