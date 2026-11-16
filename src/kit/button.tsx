import { Children, forwardRef, useRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { Button as Part } from '@ui-sdk/react/button';
import { cn } from './cn';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger-solid';
const LOOK = { primary: 'solid', secondary: undefined, ghost: 'ghost', 'danger-solid': 'destructive' } as const;

/** Wraps each run of text in a span: web.css draws a labelled button whose only element child is an svg as a square. */
export function textInSpans(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  let run = '';
  const flush = () => {
    if (run.trim()) out.push(<span key={`t${out.length}`}>{run}</span>);
    run = '';
  };
  for (const node of Children.toArray(children)) {
    if (typeof node === 'string' || typeof node === 'number') run += node;
    else { flush(); out.push(node); }
  }
  flush();
  return out;
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  /** Pending: takes no presses and keeps the label it had, so it doesn't change size. */
  loading?: boolean;
  /** Square, icon only. Pass aria-label. */
  square?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon, loading, square, className, children, disabled, type, onClick, ...rest },
  ref,
) {
  const idle = useRef(children);
  if (!loading) idle.current = children;
  const parts = <>{icon}{textInSpans(loading ? idle.current : children)}</>;
  return (
    <Part
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      {...(loading ? { 'aria-busy': true, 'aria-disabled': true, 'data-pending': '' } : undefined)}
      disabled={!loading && !!disabled}
      data-variant={LOOK[variant]}
      className={cn('shrink-0', square && 'w-(--size) px-0', loading && !icon && 'relative', className)}
      onClick={(e) => {
        if (loading) return e.preventDefault();
        onClick?.(e as MouseEvent<HTMLButtonElement>);
      }}
    >
      {loading && !icon ? (
        <>
          <span className="contents [&>*]:opacity-0">{parts}</span>
          <span className="ui-pending-over absolute inset-0 flex items-center justify-center"><Spinner /></span>
        </>
      ) : parts}
    </Part>
  );
});
