'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { BarChart3, ChevronRight, Download, FileText, HelpCircle, Settings, Sparkles, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  active: boolean;
};

function SidebarNavLink({
  item,
  isSecondary = false,
  className,
}: {
  item: NavItem;
  isSecondary?: boolean;
  className?: string;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.url}
      className={cn(
        'dash-nav-link group/nav relative flex h-10 min-h-10 w-full items-center gap-3 overflow-hidden rounded-[var(--radius-control)] px-3.5',
        'group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:min-h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:pl-0',
        item.active ? 'dash-nav-link--active' : 'dash-nav-link--inactive',
        className,
      )}
    >
      <span
        className={cn(
          'dash-nav-icon flex size-5 shrink-0 items-center justify-center transition-[color,transform] duration-150 ease-[var(--ease-out-expo)]',
          item.active
            ? 'text-[#2563EB]'
            : 'text-[#7C8799] group-hover/nav:text-[#344054]',
        )}
      >
        <Icon
          className={cn(
            'dash-nav-icon__svg size-5 shrink-0 transition-[color,transform] duration-150 ease-[var(--ease-out-expo)]',
            !item.active && 'group-hover/nav:scale-105',
          )}
          strokeWidth={2}
          aria-hidden
        />
      </span>
      <span
        className={cn(
          'dash-nav-link__label min-w-0 truncate',
          isSecondary ? 'text-sm font-normal' : 'text-[0.9375rem] font-medium',
          item.active
            ? 'font-semibold text-[#2563EB]'
            : 'text-[#667085] group-hover/nav:text-[#344054]',
        )}
      >
        {item.title}
      </span>
    </Link>
  );
}

function SidebarAiStatusCard() {
  return (
    <Link
      href="/dashboard/agent-console"
      className="group/card mt-3 block w-full rounded-[var(--radius-card)] border border-blue-100/80 bg-gradient-to-b from-[#F6F9FF] to-[#EEF3FF] p-2.5 shadow-2xs transition-all duration-150 hover:border-blue-200/90 hover:shadow-xs group-data-[collapsible=icon]:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB]">
          <Sparkles className="size-3.5 shrink-0 text-[#2563EB]" strokeWidth={2} aria-hidden />
          <span className="truncate">AI Triage Advisor</span>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
          Active
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[0.75rem] leading-snug text-[#667085]">
        Structured triage &amp; priority recommendations ready for officer review.
      </p>
      <div className="mt-2 flex items-center justify-between pt-1 text-[0.6875rem]">
        <span className="font-medium text-[#7C8799]">Policy v2</span>
        <span className="flex items-center gap-0.5 font-semibold text-[#2563EB] group-hover/card:underline">
          Console
          <ChevronRight className="size-3 transition-transform duration-150 group-hover/card:translate-x-0.5" strokeWidth={2} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tNav = useTranslations('navigation');
  const tAnalytics = useTranslations('dashboard.analytics');
  const tSidebar = useTranslations('dashboard.sidebar');
  const exportFocused =
    pathname === '/dashboard' && searchParams.get('focus') === 'export';

  const menuItems: NavItem[] = [
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
      title: tSidebar('agentConsole'),
      url: '/dashboard/agent-console',
      icon: Terminal,
      active: pathname === '/dashboard/agent-console',
    },
    {
      title: 'Export',
      url: '/dashboard?focus=export',
      icon: Download,
      active: exportFocused,
    },
  ];

  const footerItems: Omit<NavItem, 'active'>[] = [
    {
      title: tSidebar('settings'),
      url: '#',
      icon: Settings,
    },
    {
      title: tSidebar('helpSupport'),
      url: '#',
      icon: HelpCircle,
    },
  ];

  const menuButtonClassName = cn(
    'h-[48px] min-h-[48px] overflow-hidden p-0 hover:bg-transparent active:bg-transparent',
    'data-[active=true]:bg-transparent data-[active=true]:font-normal data-[active=true]:shadow-none',
    'group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!min-h-10 group-data-[collapsible=icon]:!p-0',
  );

  const menuItemClassName = cn(
    'dash-nav-item overflow-hidden',
    'group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center',
  );

  return (
    <Sidebar
      collapsible="icon"
      className="!top-[68px] !h-[calc(100svh-4.25rem)] border-r border-sidebar-border bg-sidebar"
    >
      <SidebarContent className="flex flex-col justify-between px-4 py-3 group-data-[collapsible=icon]:px-0">
        {/* Main Navigation Group (Top) */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-1.5 h-5 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#98A2B3] group-data-[collapsible=icon]:hidden">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent className="overflow-hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {menuItems.map((item) => (
                <SidebarMenuItem
                  key={item.title}
                  className={cn(menuItemClassName, item.active && 'dash-nav-item--active')}
                >
                  <SidebarMenuButton
                    asChild
                    isActive={item.active}
                    tooltip={item.title}
                    className={menuButtonClassName}
                  >
                    <SidebarNavLink item={item} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Group & AI Card (Bottom) */}
        <div className="mt-auto pt-3">
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="mb-1.5 h-5 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#98A2B3] group-data-[collapsible=icon]:hidden">
              System
            </SidebarGroupLabel>
            <SidebarGroupContent className="overflow-hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
                {footerItems.map((item) => (
                  <SidebarMenuItem key={item.title} className={menuItemClassName}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className={menuButtonClassName}
                    >
                      <SidebarNavLink
                        item={{ ...item, active: false }}
                        isSecondary
                        className="dash-nav-link--inactive"
                      />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarAiStatusCard />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
