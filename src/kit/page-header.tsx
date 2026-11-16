import type { ReactNode } from 'react';
import { cn } from './cn';

/** A page's top bar: icon, title and count. */
export function PageHeader({ icon, title, count, className }: { icon?: ReactNode; title: ReactNode; count?: ReactNode; className?: string }) {
  return (
    <div className={cn('shrink-0 border-b border-line bg-surface', className)}>
      <div className="flex h-12 items-center gap-2 pr-2.5 pl-4">
        {icon && <span className="flex shrink-0 text-fg-2 [&_svg]:size-4">{icon}</span>}
        <h1 className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.01em] text-fg">{title}</h1>
        {count != null && <span className="mono shrink-0 text-[12px] text-fg-3 tabular-nums">{count}</span>}
      </div>
    </div>
  );
}
