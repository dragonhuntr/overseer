import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { isTone, tone as tones, type Tone } from './tones';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | Tone;
const SEMANTIC: Record<string, Tone> = { ok: 'green', warn: 'amber', danger: 'red' };

/** A mono tag: 1px outline in its tone's ink, no fill, square. */
export function Badge({ children, className, tone = 'neutral', ...rest }: Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & { children: ReactNode; tone?: BadgeTone }) {
  const hue = SEMANTIC[tone] ?? (isTone(tone) ? tone : null);
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1 border px-1.5 font-mono text-[12px] leading-4 font-normal whitespace-nowrap',
        hue ? cn(tones[hue].text, 'border-current/35') : 'border-fg/20 text-fg-2',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone, className, pulse }: { tone: 'ok' | 'warn' | 'danger' | 'muted'; className?: string; pulse?: boolean }) {
  const c = { ok: tones.green.solid, warn: tones.amber.solid, danger: tones.red.solid, muted: 'bg-fg-4' }[tone];
  return <span className={cn('inline-block size-1.5 shrink-0', c, pulse && 'animate-pulse-soft', className)} aria-hidden />;
}
