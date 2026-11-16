import { Tooltip as Root, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';
import { cloneElement, createContext, isValidElement, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { renderInto } from './render-into';

const Delay = createContext<number | undefined>(undefined);

/** Sets the open delay for every tooltip inside it. */
export function TooltipProvider({ delayDuration, children }: { delayDuration?: number; children?: ReactNode }) {
  return <Delay.Provider value={delayDuration}>{children}</Delay.Provider>;
}

/** Wraps one focusable child, which becomes the trigger. */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const delay = useContext(Delay);
  const [open, setOpen] = useState(false);
  if (!content || !isValidElement<Record<string, unknown>>(children)) return <>{children}</>;
  // Text that repeats the trigger's own name (an icon button's aria-label) would be read twice: don't describe with it.
  const quiet = typeof content === 'string' && children.props['aria-label'] === content;
  // A neutral slot keeps web.css from drawing the trigger as a framed button.
  const anchor = cloneElement(children as ReactElement<Record<string, unknown>>, { 'data-slot': children.props['data-slot'] ?? 'tooltip-anchor' });
  const into = renderInto(anchor, {
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); },
  });
  return (
    <Root delay={delay} open={open} onOpenChange={setOpen}>
      <TooltipTrigger render={quiet ? (props) => into({ ...props, 'aria-describedby': undefined }) : into} />
      <TooltipContent side={side} align="center" sideOffset={6} collisionPadding={8}>{content}</TooltipContent>
    </Root>
  );
}
