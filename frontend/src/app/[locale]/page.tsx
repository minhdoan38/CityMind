import Image from "next/image";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";

import LocaleSwitcher from "@/components/LocaleSwitcher";
import PublicStatsStrip from "@/components/analytics/PublicStatsStrip";
import ReportStarterBar from "@/components/ReportStarterBar";
import { Link } from "@/i18n/navigation";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1582898882571-b84d7c95dc72?auto=format&fit=crop&w=2000&q=80";
const ABOUT_IMAGE =
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80";

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
      {/* Dentlabs-style solid header — logo + nav + primary CTA */}
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground"
          >
            <span
              aria-hidden
              className="mr-2 inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              C
            </span>
            {t("title")}
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#how-it-works"
              className="inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground hover:text-foreground"
            >
              {t("navHowItWorks")}
            </a>
            <a
              href="#instructions"
              className="inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground hover:text-foreground"
            >
              {t("instructionsTitle")}
            </a>
            <a
              href="#about"
              className="inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground hover:text-foreground"
            >
              {t("navAbout")}
            </a>
            <a
              href="#contact"
              className="inline-flex min-h-11 items-center text-sm font-normal text-muted-foreground hover:text-foreground"
            >
              {t("navContact")}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <NextLink
              href="/login"
              className="hidden min-h-11 items-center px-2 text-sm font-normal text-muted-foreground hover:text-foreground sm:inline-flex"
            >
              {t("officerSignIn")}
            </NextLink>
            <LocaleSwitcher />
            <Link
              href="/report"
              className="hero-cta inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t("reportCTA")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-grow flex-col">
        {/* Hero + overlapping report starter (reference structure) */}
        <section className="relative isolate">
          <div className="relative min-h-[min(78vh,42rem)] w-full overflow-hidden">
            <Image
              src={HERO_IMAGE}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_30%]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-[#1A2B3C]/80 via-[#1A2B3C]/50 to-[#1A2B3C]/25"
            />

            <div className="relative z-10 mx-auto flex min-h-[min(78vh,42rem)] max-w-6xl flex-col justify-center px-6 pb-28 pt-16 sm:pb-32">
              <div className="max-w-[34rem]">
                <p className="hero-rise text-sm font-semibold tracking-wide text-white/80">
                  {t("title")}
                </p>
                <h1 className="hero-rise hero-rise-delay-1 mt-3 text-balance text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-white">
                  {t("heroHeadline")}
                </h1>
                <p className="hero-rise hero-rise-delay-2 mt-4 max-w-[30rem] text-pretty text-base leading-relaxed text-white/90 sm:text-[1.125rem]">
                  {t("subtitle")}
                </p>
                <p className="hero-rise hero-rise-delay-2 mt-2 max-w-[28rem] text-pretty text-sm leading-relaxed text-white/70">
                  {t("heroAdvisory")}
                </p>
                <div className="hero-rise hero-rise-delay-3 mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/report"
                    className="hero-cta inline-flex min-h-11 items-center justify-center rounded-full bg-white px-7 text-base font-semibold text-primary hover:bg-white/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {t("reportCTA")}
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/50 bg-transparent px-6 text-base font-semibold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {t("heroSecondaryCta")}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-20 mx-auto -mt-16 max-w-6xl px-6 pb-4 sm:-mt-20">
            <ReportStarterBar />
          </div>
        </section>

        {/* D-03 order: How it works → Instructions → About → Contact → Footer */}
        <section
          id="how-it-works"
          className="w-full scroll-mt-24 border-y border-border bg-secondary px-6 py-16 md:py-24"
        >
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-balance text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.02em] text-foreground">
                {t("howItWorksTitle")}
              </h2>
              <p className="text-pretty text-base leading-relaxed text-muted-foreground">
                {t("howItWorksDesc")}
              </p>
            </div>
          </div>
        </section>

        <section
          id="instructions"
          className="w-full scroll-mt-24 bg-background px-6 py-16 md:py-24"
        >
          <div className="mx-auto max-w-6xl space-y-6">
            <h2 className="text-balance text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.02em] text-foreground">
              {t("instructionsTitle")}
            </h2>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, idx) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-border bg-white p-5"
                >
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h4 className="mt-3 text-base font-semibold text-foreground">
                    {step.title}
                  </h4>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <PublicStatsStrip />

        {/* About — image + mission/vision (reference two-column) */}
        <section id="about" className="w-full scroll-mt-24 bg-secondary px-6 py-16 md:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-[5/4] lg:aspect-[4/5]">
              <Image
                src={ABOUT_IMAGE}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            <div className="space-y-6">
              <p className="inline-flex rounded-full bg-background px-3 py-1 text-sm font-semibold text-primary">
                {t("aboutTitle")}
              </p>
              <h2 className="text-balance text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.02em] text-foreground">
                {t("aboutHeadline")}
              </h2>
              <p className="max-w-[40rem] text-pretty text-base leading-relaxed text-muted-foreground">
                {t("aboutDesc")}
              </p>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("missionTitle")}
                  </h3>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {t("missionDesc")}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("visionTitle")}
                  </h3>
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                    {t("visionDesc")}
                  </p>
                </div>
              </div>

              <Link
                href="/report"
                className="hero-cta inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {t("aboutCta")}
              </Link>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="w-full scroll-mt-24 bg-background px-6 py-16 md:py-24">
          <div className="mx-auto max-w-xl space-y-4">
            <h2 className="text-balance text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.02em] text-foreground">
              {t("contactTitle")}
            </h2>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground">
              {t("contactDesc", { email: t("contactEmail") })}
            </p>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {t("contactFormSoon")}
            </p>
            <a
              href={`mailto:${t("contactEmail")}`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white px-6 text-base font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t("contactEmail")}
            </a>
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
