import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { requireOfficerSession } from "@/lib/auth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";

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
          <div className="flex min-h-screen w-full flex-col bg-[var(--dashboard-canvas)] text-foreground">
            <DashboardNavbar userEmail={session.userId} />
            <div className="flex min-h-0 flex-1">
              <Suspense fallback={null}>
                <DashboardSidebar />
              </Suspense>
              <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </NextIntlClientProvider>
  );
}
