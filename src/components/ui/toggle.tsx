"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleSelectedOn =
  "data-[state=on]:border-[color-mix(in_oklch,var(--primary)_28%,var(--border))] data-[state=on]:bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_18%,transparent)]"

const toggleVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 text-sm tracking-tight whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 ease-[var(--ease-out-expo)] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: cn(
          "bg-transparent font-medium text-foreground hover:bg-muted/70",
          toggleSelectedOn,
        ),
        outline: cn(
          "border border-border bg-card font-medium text-foreground hover:bg-muted/70",
          toggleSelectedOn,
        ),
        segmented: cn(
          "rounded-none border-0 bg-transparent font-medium text-foreground shadow-none hover:bg-muted/60",
          toggleSelectedOn,
          "data-[state=on]:border-transparent",
        ),
      },
      size: {
        default: "min-h-10 px-3.5 sm:px-4",
        sm: "min-h-10 px-3 text-sm",
        lg: "min-h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
