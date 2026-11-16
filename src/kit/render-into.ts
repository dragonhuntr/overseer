import { cloneElement, type ReactElement, type Ref } from 'react';

type Props = Record<string, unknown>;
type Handler = (...args: unknown[]) => unknown;

const composeRefs = <T,>(...refs: unknown[]) => (node: T | null) => {
  for (const r of refs as (Ref<T> | undefined)[]) {
    if (typeof r === 'function') r(node);
    else if (r) (r as { current: T | null }).current = node;
  }
};
const join = (a: string | undefined, b: string) => (a ? `${a} ${b}` : b);
const chain = (first: Handler, second: Handler) => (...args: unknown[]) => {
  first(...args);
  if (!(args[0] as { defaultPrevented?: boolean } | undefined)?.defaultPrevented) second(...args);
};

function merge(a: Props, b: Props): Props {
  const out: Props = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (value === undefined) continue;
    const other = a[key];
    if (key === 'ref') out.ref = composeRefs(other, value);
    else if (key === 'className' && typeof other === 'string' && typeof value === 'string') out.className = join(other, value);
    else if (/^on[A-Z]/.test(key) && typeof value === 'function' && typeof other === 'function') out[key] = chain(value as Handler, other as Handler);
    else out[key] = value;
  }
  return out;
}

/** A UI SDK part's `render`, drawn as `element`: props merge, the element's handlers run first, refs combine. */
export function renderInto(element: ReactElement, extra?: Props) {
  return (partProps: Props) => {
    const own = element.props as Props;
    const theirs = extra ? merge(partProps, extra) : partProps;
    const merged: Props = { ...theirs };
    for (const [key, value] of Object.entries(own)) {
      if (value === undefined) continue;
      const other = theirs[key];
      if (key === 'className' && typeof other === 'string' && typeof value === 'string') merged.className = join(value, other);
      else if (/^on[A-Z]/.test(key) && typeof value === 'function' && typeof other === 'function') merged[key] = chain(value as Handler, other as Handler);
      else merged[key] = value;
    }
    merged.ref = composeRefs(theirs.ref, own.ref);
    return cloneElement(element, merged);
  };
}
