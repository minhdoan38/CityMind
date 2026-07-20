'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { setUserLocale } from '@/services/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function LocaleSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (nextLocale: string) => {
    startTransition(async () => {
      await setUserLocale(nextLocale);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="min-h-11 border-border font-medium text-foreground hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={locale === 'en' ? 'Language Selection' : 'Chọn ngôn ngữ'}
          disabled={isPending}
        >
          {locale === 'en' ? 'Language: English' : 'Ngôn ngữ: Tiếng Việt'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border border-border text-foreground">
        <DropdownMenuItem
          onClick={() => handleLocaleChange('en')}
          className="cursor-pointer hover:bg-secondary focus:bg-secondary focus:text-primary font-medium"
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLocaleChange('vi')}
          className="cursor-pointer hover:bg-secondary focus:bg-secondary focus:text-primary font-medium"
        >
          Tiếng Việt
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
