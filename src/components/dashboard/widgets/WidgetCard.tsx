import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WidgetCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  delayClass?: string;
};

export default function WidgetCard({
  title,
  children,
  className,
  action,
  delayClass = "dash-rise",
}: WidgetCardProps) {
  return (
    <section
      className={cn(
        "surface-card flex flex-col overflow-hidden rounded-2xl",
        delayClass,
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 px-5 pt-5">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {action ?? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground"
            aria-label={title}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        )}
      </header>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">{children}</div>
    </section>
  );
}
