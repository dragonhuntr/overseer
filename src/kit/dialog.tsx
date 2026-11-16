import { Dialog as Root, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { cn } from './cn';

const WIDTH = { sm: 'w-[min(400px,calc(100%-2rem))]', md: 'w-[min(520px,calc(100%-2rem))]' };
const TABBABLE = 'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/** Dialogs render into one layer at the end of #root, so page styles around the trigger don't reach them. */
let layer: HTMLElement | null = null;
function overlayRoot(): HTMLElement | null {
  if (layer?.isConnected) return layer;
  const app = typeof document === 'undefined' ? null : document.getElementById('root');
  if (!app) return null;
  layer = document.createElement('div');
  layer.dataset.overlayRoot = '';
  app.appendChild(layer);
  return layer;
}

/** A modal: title, optional description and body, actions in the footer. Escape and a press outside close it. */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', className }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode;
  children?: ReactNode; footer?: ReactNode; size?: keyof typeof WIDTH; className?: string;
}) {
  const content = useRef<HTMLDivElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  return (
    <Root container={overlayRoot()} open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogBackdrop onClick={() => onOpenChange(false)} />
      <DialogContent
        ref={content}
        initialFocus={() => body.current?.querySelector<HTMLElement>(TABBABLE) ?? content.current?.querySelector<HTMLElement>('[data-slot="dialog-footer"] button') ?? null}
        className={cn(WIDTH[size], 'max-h-[calc(100dvh-2rem)]', className)}
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <DialogTitle className="min-w-0 flex-1 break-words">{title}</DialogTitle>
            <DialogClose aria-label="Close" data-variant="ghost" className="-my-1.5"><X aria-hidden /></DialogClose>
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
        </div>
        {children && <div ref={body} className="min-h-0 flex-1 overflow-y-auto">{children}</div>}
        {footer && <div data-slot="dialog-footer" className="flex shrink-0 items-center justify-end gap-2">{footer}</div>}
      </DialogContent>
    </Root>
  );
}
