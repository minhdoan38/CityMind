'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarChart3, FileText, Download, Settings, LogOut } from 'lucide-react';
import CityMindLogo from '@/components/CityMindLogo';

export default function DashboardSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tNav = useTranslations('navigation');
  const tAnalytics = useTranslations('dashboard.analytics');
  const tLogout = useTranslations('logout');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const exportFocused =
    pathname === '/dashboard' && searchParams.get('focus') === 'export';

  const menuItems = [
    {
      title: tNav('dashboard'),
      url: '/dashboard',
      icon: FileText,
      active: pathname === '/dashboard' && !exportFocused,
    },
    {
      title: tAnalytics('navItem'),
      url: '/dashboard/analytics',
      icon: BarChart3,
      active: pathname === '/dashboard/analytics',
    },
    {
      title: 'Export',
      url: '/dashboard?focus=export',
      icon: Download,
      active: exportFocused,
    },
    {
      title: 'Settings',
      url: '#',
      icon: Settings,
      active: false,
    },
  ];

  const handleLogoutSubmit = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/session/logout';
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <>
      <Sidebar className="border-r border-sidebar-border bg-sidebar">
        <SidebarContent>
          <SidebarGroup>
            <div className="mb-2 flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
              <CityMindLogo size={32} />
              <div className="min-w-0">
                <span className="block font-heading text-base font-semibold tracking-tight text-foreground">
                  CityMind AI
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  Officer dashboard
                </span>
              </div>
            </div>
            <SidebarGroupContent className="px-2">
              <SidebarMenu className="gap-1">
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.active} className="min-h-11">
                      <Link
                        href={item.url}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                          item.active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <item.icon
                          className={`h-4 w-4 shrink-0 ${
                            item.active ? "text-primary-foreground" : "text-muted-foreground"
                          }`}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className="surface-card flex flex-col gap-3 p-3">
            <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
            <Button
              variant="ghost"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full min-h-11 justify-start gap-3 text-destructive hover:bg-destructive/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium text-sm">{tLogout('submit')}</span>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Custom Logout Confirmation Dialog Overlay */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-sm border border-border shadow-lg mx-4">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Sign out of the officer dashboard?</CardTitle>
              <CardDescription>You will need to enter your password again to access dashboard features.</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                className="min-h-11 border-border font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Stay signed in
              </Button>
              <Button
                variant="destructive"
                className="min-h-11 font-medium bg-destructive hover:bg-destructive/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive"
                onClick={handleLogoutSubmit}
              >
                Sign out
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
