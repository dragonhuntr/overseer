import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { textInSpans } from './button';

export type SegmentedOption<V extends string> = { value: V; label: ReactNode; icon?: ReactNode };

/** One of a few values, as a radio group: one tab stop, arrow keys move and pick. */
export function Segmented<V extends string>({ value, onChange, options, className, 'aria-label': ariaLabel }: {
  value: V; onChange: (value: V) => void; options: SegmentedOption<V>[]; className?: string; 'aria-label': string;
}) {
  return (
    <SegmentedControl value={value} onValueChange={(v) => { if (v != null) onChange(v as V); }} aria-label={ariaLabel}
      className={cn('max-w-full flex-wrap min-h-8', className)}>
      <SegmentedControlIndicator />
      {options.map((o) => (
        <SegmentedControlItem key={o.value} value={o.value} className="h-auto min-h-7 gap-1.5">
          {o.icon}
          {textInSpans(o.label)}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
