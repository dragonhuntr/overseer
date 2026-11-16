import type { HTMLAttributes, ReactNode } from 'react';
import { Badge, type BadgeTone } from './kit/badge';
import { cn } from './kit/cn';
import type { ProviderId } from './data';

/* ---------- layout ---------- */

/** A framed surface: white (or the dark tile) with the library's 1px ring. */
export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('border border-line bg-surface', className)}>{children}</div>;
}

/** A section's mono label with a hairline to its right and a note at the end (GPUS · HOST ———— 4× A100). */
export function SectionLabel({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="label-mono inline-flex shrink-0 items-center gap-1.5">{children}</span>
      <span className="h-px min-w-4 flex-1 bg-line-soft" />
      {note && <span className="mono min-w-0 truncate text-[12px] text-fg-3" title={typeof note === "string" ? note : undefined}>{note}</span>}
    </div>
  );
}

/* ---------- meters ---------- */

export function Meter({ pct, width = 20, height = 6, danger = 90, color }: {
  pct: number | null; width?: number | string; height?: number; danger?: number; color?: string;
}) {
  const fill = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const bg = color ?? (pct != null && pct >= danger ? 'var(--tone-red-solid)' : 'var(--tone-blue-solid)');
  return (
    <span className="meter" style={{ width, height }}>
      {fill > 0 && <span className="meter-fill" style={{ width: `${Math.max(fill, 3)}%`, background: bg }} />}
    </span>
  );
}

export function CpuMem({ cpu, mem, disk }: { cpu: number | null; mem: number | null; disk?: number | null }) {
  const fmt = (v: number | null) => (v == null ? '–' : `${Math.round(v)}%`);
  const row = (label: string, v: number | null) => (
    <>
      <span className="text-fg-4">{label}</span><Meter pct={v} /><span className="text-right text-fg-2 tabular-nums">{fmt(v)}</span>
    </>
  );
  return (
    <div className="mono grid shrink-0 grid-cols-[auto_auto_34px] items-center gap-x-2.5 gap-y-[3px] self-start text-[11px]">
      {row('CPU', cpu)}{row('MEM', mem)}{disk !== undefined && row('DISK', disk)}
    </div>
  );
}

/* ---------- pixel avatars (deterministic from name) ---------- */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Avatar({ name, size = 20, boxed = false }: { name: string; size?: number; boxed?: boolean }) {
  const r = rng(hash(name));
  const hue = Math.floor(r() * 360);
  const N = 7;
  const cells: { x: number; y: number; c: string }[] = [];
  // a little symmetric creature: random silhouette per row, eyes, a few tinted pixels
  const eyeRow = 2 + Math.floor(r() * 3);
  const eyeX = 1 + Math.floor(r() * 2);
  const halfW = Array.from({ length: N }, (_, y) =>
    y === eyeRow ? 3 : y < eyeRow ? Math.floor(r() * (y + 2)) : 1 + Math.floor(r() * 3));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x <= 3; x++) {
      if (3 - x > halfW[y]) continue;
      if (y > eyeRow && x === 3 - halfW[y] && r() > 0.5) continue; // ragged legs/edges
      const eye = y === eyeRow && x === eyeX;
      const c = eye ? 'var(--avatar-eye)' : r() > 0.8 ? `hsl(${hue} 65% 66%)` : 'var(--avatar)';
      cells.push({ x, y, c });
      if (x !== 3) cells.push({ x: N - 1 - x, y, c });
    }
  }
  const svg = (
    <svg width={size} height={size} viewBox={`-0.5 -0.5 ${N + 1} ${N + 1}`} shapeRendering="crispEdges" aria-hidden>
      {cells.map((p, i) => <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.c} />)}
    </svg>
  );
  return boxed
    ? <span className="inline-grid shrink-0 place-items-center border border-line-soft bg-canvas" style={{ width: size + 12, height: size + 12 }}>{svg}</span>
    : svg;
}

/* ---------- provider glyphs (generic shapes, not brand logos) ---------- */

export function ProviderIcon({ id, size = 14 }: { id: ProviderId | 'claude' | 'google' | 'openrouter'; size?: number }) {
  const s = { width: size, height: size, flex: 'none' as const };
  switch (id) {
    case 'tailnet':
      return (
        <svg {...s} viewBox="0 0 12 12" aria-hidden>
          {[0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => (
            <circle key={`${x}${y}`} cx={2 + x * 4} cy={2 + y * 4} r={1.3} fill="currentColor" opacity={y === 1 || (x === 1 && y === 2) ? 1 : 0.4} />
          )))}
        </svg>
      );
    case 'ovh':
      return (
        <svg {...s} viewBox="0 0 16 12" fill="currentColor" aria-hidden>
          <path d="M1 1h3l3 9H4z" /><path d="M6 1h3l2.5 7.5L14 1h1.5L12 11H9z" opacity=".85" />
        </svg>
      );
    case 'gcloud':
      return (
        <svg {...s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M4.5 12.5h7a3 3 0 0 0 .4-5.98A4 4 0 0 0 4.2 7.6 2.5 2.5 0 0 0 4.5 12.5z" />
        </svg>
      );
    case 'claude':
      return (
        <svg {...s} viewBox="0 0 16 16" aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x="7.3" y="0.8" width="1.4" height="7" rx=".7" fill="#e07a4f" transform={`rotate(${i * 36} 8 8)`} />
          ))}
        </svg>
      );
    case 'google':
      return (
        <svg {...s} viewBox="0 0 16 16" aria-hidden>
          <defs>
            <linearGradient id="gsp" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7aa2ff" /><stop offset="1" stopColor="#b18cff" />
            </linearGradient>
          </defs>
          <path d="M8 0c.6 4.2 3.8 7.4 8 8-4.2.6-7.4 3.8-8 8-.6-4.2-3.8-7.4-8-8 4.2-.6 7.4-3.8 8-8z" fill="url(#gsp)" />
        </svg>
      );
    case 'server':
      return (
        <svg {...s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="2" y="2.5" width="12" height="4.5" /><rect x="2" y="9" width="12" height="4.5" />
          <path d="M4.5 4.75h1M4.5 11.25h1" strokeLinecap="square" />
        </svg>
      );
    case 'openrouter':
      return (
        <svg {...s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M1.5 8h3.5c2 0 2.5-4 5-4h3.5" /><path d="M5 8c2 0 2.5 4 5 4h3.5" /><path d="M11.5 2l2 2-2 2M11.5 10l2 2-2 2" />
        </svg>
      );
  }
}

const PLAN_TONE = (plan: string): BadgeTone =>
  plan.startsWith('Max') || plan === 'Ultra' ? 'orange' : plan.startsWith('Team') || plan === 'Enterprise' ? 'green' : plan === 'Free' ? 'neutral' : 'blue';

export function PlanBadge({ plan }: { plan: string }) {
  return <Badge tone={PLAN_TONE(plan)} className="h-[18px] px-1 text-[11px]">{plan}</Badge>;
}

/** A small mono tag beside a name: "hub" (blue) or "demo" (dashed, quiet). */
export function Tag({ kind }: { kind: 'hub' | 'demo' }) {
  return kind === 'hub'
    ? <Badge tone="blue" className="h-4 px-1 text-[10px] leading-none">hub</Badge>
    : <Badge className="h-4 border-dashed px-1 text-[10px] leading-none text-fg-4">demo</Badge>;
}
