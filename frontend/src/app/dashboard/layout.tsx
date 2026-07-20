import { requireOfficerSession } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSidebar from "@/components/DashboardSidebar";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireOfficerSession();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <DashboardSidebar userEmail={session.userId} />
          <div className="flex flex-col flex-grow">
            <header className="flex h-16 items-center justify-between border-b border-border px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
              </div>
              <LocaleSwitcher />
            </header>
            <main className="flex-grow p-6 md:p-8 max-w-6xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
