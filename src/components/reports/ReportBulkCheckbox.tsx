"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckedState = boolean | "indeterminate";

type ReportBulkCheckboxProps = Omit<
  React.ComponentProps<typeof CheckboxPrimitive.Root>,
  "checked" | "onCheckedChange"
> & {
  checked: CheckedState;
  onCheckedChange: (checked: boolean) => void;
  staggerIndex?: number;
  selectWaveId?: number;
};

export default function ReportBulkCheckbox({
  checked,
  onCheckedChange,
  className,
  disabled,
  staggerIndex,
  selectWaveId,
  ...props
}: ReportBulkCheckboxProps) {
  const isIndeterminate = checked === "indeterminate";
  const isChecked = checked === true;
  const waveActive =
    selectWaveId != null &&
    staggerIndex != null &&
    isChecked &&
    !isIndeterminate;

  return (
    <span className="dash-bulk-checkbox-host shrink-0">
      <CheckboxPrimitive.Root
        data-slot="report-bulk-checkbox"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className={cn(
          "dash-bulk-checkbox relative inline-flex shrink-0 items-center justify-center",
          "!h-5 !w-5 !min-h-5 !max-h-5 !min-w-5 !max-w-5",
          "rounded-[5px] border-2 border-border bg-card shadow-sm",
          "transition-[transform,border-color,background-color,box-shadow] duration-150 ease-[var(--ease-out-expo)]",
          "hover:border-[color-mix(in_oklch,var(--primary)_40%,var(--border))] hover:bg-muted/60 hover:shadow-md",
          "hover:scale-110 motion-reduce:hover:scale-100",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
          "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-checked:shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_25%,transparent)]",
          "data-checked:hover:scale-105 motion-reduce:data-checked:hover:scale-100",
          waveActive && "dash-bulk-checkbox--wave",
          className,
        )}
        style={
          waveActive
            ? ({ "--dash-bulk-stagger": `${staggerIndex * 42}ms` } as React.CSSProperties)
            : undefined
        }
        data-wave-id={waveActive ? selectWaveId : undefined}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="dash-bulk-checkbox-indicator grid place-content-center text-current">
          {isIndeterminate ? (
            <Minus className="size-3.5 stroke-[2.75]" aria-hidden />
          ) : (
            <Check className="size-3.5 stroke-[2.75]" aria-hidden />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </span>
  );
}
