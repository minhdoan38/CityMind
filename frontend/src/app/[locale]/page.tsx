import Image from "next/image";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";

import LocaleSwitcher from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1582898882571-b84d7c95dc72?auto=format&fit=crop&w=2000&q=80";

export default async function LocalizedHomePage() {
  const t = await getTranslations("public");

  const steps = [
    { title: t("step1Title"), desc: t("step1Desc") },
    { title: t("step2Title"), desc: t("step2Desc") },
    { title: t("step3Title"), desc: t("step3Desc") },
    { title: t("step4Title"), desc: t("step4Desc") },
    { title: t("step5Title"), desc: t("step5Desc") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/15 bg-black/20 text-white backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[1.25rem] font-semibold tracking-[-0.02em] text-white"
          >
            {t("title")}
          </Link>
          <nav className="flex items-center gap-4 sm:gap-6">
            <NextLink
              href="/login"
              className="inline-flex min-h-11 items-center px-2 text-sm font-normal text-white/70 hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t("officerSignIn")}
            </NextLink>
            <LocaleSwitcher tone="on-dark" />
          </nav>
        </div>
      </header>

      <main className="flex flex-grow flex-col">
        {/* D-08: full-bleed hero — brand + headline + advisory + one CTA */}
        <section className="relative isolate min-h-[min(92vh,52rem)] w-full overflow-hidden">
          <Image
            src={HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-[#14201D]/88 via-[#14201D]/40 to-[#14201D]/20"
          />

          <div className="relative z-10 mx-auto flex min-h-[min(92vh,52rem)] max-w-6xl flex-col justify-end px-6 pb-16 pt-28 sm:pb-20 md:pb-24 md:pt-32">
            <div className="max-w-[36rem]">
              <h1 className="hero-rise text-balance text-[clamp(1.75rem,5vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.04em] text-white">
                {t("title")}
              </h1>
              <p className="hero-rise hero-rise-delay-1 mt-3 max-w-[32rem] text-pretty text-base font-normal leading-relaxed text-white/90 sm:text-[1.125rem]">
                {t("subtitle")}
              </p>
              <p className="hero-rise hero-rise-delay-2 mt-3 max-w-[28rem] text-pretty text-sm leading-relaxed text-white/70">
                {t("heroAdvisory")}
              </p>
              <div className="hero-rise hero-rise-delay-3 mt-8">
                <Link
                  href="/report"
                  className="hero-cta inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {t("reportCTA")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* D-03: How it works */}
        <section className="w-full border-b border-border bg-background px-6 py-16 md:py-20">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-balance text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
              {t("howItWorksTitle")}
            </h2>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground">
              {t("howItWorksDesc")}
            </p>
          </div>
        </section>

        {/* D-03 / D-06: Instructions (3–5 steps) */}
        <section className="w-full border-b border-border bg-secondary px-6 py-16 md:py-20">
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-balance text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
                {t("instructionsTitle")}
              </h2>
              <p className="text-pretty text-base leading-relaxed text-muted-foreground">
                {t("instructionsDesc")}
              </p>
            </div>

            <ol className="space-y-0 divide-y divide-border border-t border-border">
              {steps.map((step, idx) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 py-5 sm:gap-6"
                >
                  <span
                    aria-hidden
                    className="pt-0.5 font-semibold tabular-nums text-primary"
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="max-w-[42rem] text-pretty text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* About */}
        <section className="w-full border-b border-border bg-background px-6 py-16 md:py-20">
          <div className="mx-auto max-w-2xl space-y-4">
            <h2 className="text-balance text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
              {t("aboutTitle")}
            </h2>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground">
              {t("aboutDesc")}
            </p>
          </div>
        </section>

        {/* D-05: Contact static */}
        <section className="w-full bg-secondary px-6 py-16 md:py-20">
          <div className="mx-auto max-w-md space-y-4">
            <h2 className="text-balance text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
              {t("contactTitle")}
            </h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {t("contactDesc", { email: t("contactEmail") })}
            </p>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {t("contactFormSoon")}
            </p>
            <div className="pt-1">
              <a
                href={`mailto:${t("contactEmail")}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-5 text-base font-semibold text-primary transition-colors hover:bg-background/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {t("contactEmail")}
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-border bg-secondary">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>{t("footer")}</p>
          <NextLink
            href="/login"
            className="text-sm font-normal text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("officerSignIn")}
          </NextLink>
        </div>
      </footer>
    </div>
  );
}
