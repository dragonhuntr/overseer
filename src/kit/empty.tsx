import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

/** An empty list: its icon in an outlined square, a few words, at most one action. */
export function EmptyState({ icon: Icon, title, action, className }: { icon: LucideIcon; title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-rise-in motion-reduce:animate-none', className)}>
      <span className="flex size-10 items-center justify-center border border-line text-fg-3 [&_svg]:size-[18px]"><Icon /></span>
      <p className="text-[14px] font-medium text-fg-2">{title}</p>
      {action}
    </div>
  );
}
