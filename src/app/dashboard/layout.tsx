import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { requireOfficerSession } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSidebar from "@/components/DashboardSidebar";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import CityMindLogo from "@/components/CityMindLogo";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireOfficerSession();
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <TooltipProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-[var(--dashboard-canvas)] text-foreground">
            <Suspense fallback={null}>
              <DashboardSidebar userEmail={session.userId} />
            </Suspense>
            <div className="flex min-w-0 flex-grow flex-col">
              <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-[var(--shadow-card)] sm:px-6">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:hidden" />
                  <div className="hidden items-center gap-2 md:flex">
                    <CityMindLogo size={24} />
                    <span className="font-heading text-sm font-semibold text-foreground">
                      Officer workspace
                    </span>
                  </div>
                </div>
                <LocaleSwitcher />
              </header>
              <main className="w-full flex-grow p-4 md:p-6 lg:p-8">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </NextIntlClientProvider>
  );
}
