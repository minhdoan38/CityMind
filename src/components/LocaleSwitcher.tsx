'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

type LocaleSwitcherProps = {
  tone?: 'default' | 'on-dark';
};

export default function LocaleSwitcher({ tone = 'default' }: LocaleSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (nextLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  const triggerClass =
    tone === 'on-dark'
      ? 'min-h-11 border-white/40 bg-transparent font-normal text-white hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
      : 'min-h-11 border-border font-medium text-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={triggerClass}
          aria-label={locale === 'en' ? 'Language Selection' : 'Chọn ngôn ngữ'}
          disabled={isPending}
        >
          {locale === 'en' ? 'EN' : 'VI'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border border-border bg-popover text-foreground animate-none">
        <DropdownMenuItem
          onClick={() => handleLocaleChange('en')}
          className="cursor-pointer font-medium hover:bg-secondary focus:bg-secondary focus:text-primary"
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLocaleChange('vi')}
          className="cursor-pointer font-medium hover:bg-secondary focus:bg-secondary focus:text-primary"
        >
          Tiếng Việt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
