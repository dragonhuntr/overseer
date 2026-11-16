import { cn } from './kit/cn';
import type { Group, Machine, ProviderId } from './data';
import { Avatar, CpuMem, Panel, ProviderIcon, Tag } from './ui';

const CARD_H = 84;
const GAP = 10;
const HEAD_H = 28;
const HUB_H = 192;

export interface HubInfo {
  name: string;
  place: string;
  provider: ProviderId;
  cpu: number;
  cores: number;
  memGb: number;
  memUsedGb: number;
  history: number[];
  live: boolean;
  diskFreeGb?: number;
}

/** fullness of the machine's biggest disk */
export const mainDisk = (m: Machine) =>
  m.disks?.length ? [...m.disks].sort((a, b) => b.sizeGb - a.sizeGb)[0].pct : m.status === 'down' ? null : undefined;

export function gpuSummary(m: Machine) {
  if (!m.gpus?.length) return '';
  const names = [...new Set(m.gpus.map((g) => g.name))];
  return names.length === 1 ? `${m.gpus.length}× ${names[0]}` : `${m.gpus.length} GPUs`;
}

function Spec({ m }: { m: Machine }) {
  if (m.status === 'down') return <div className="mono truncate text-[11px] text-tone-red">offline</div>;
  const gpu = gpuSummary(m);
  return <div className="mono truncate text-[11px] text-fg-3">{m.cores} cores · {m.memGb} GB{gpu && ` · ${gpu}`}</div>;
}

function ServerCard({ m, provider }: { m: Machine; provider: Group['provider'] }) {
  return (
    <div
      id={m.id}
      className={cn('flex items-center gap-3 overflow-hidden border border-line bg-surface px-3 py-2 scroll-mt-4', m.status === 'down' && 'opacity-60')}
      style={{ height: CARD_H }}
    >
      <Avatar name={m.name} size={22} boxed />
      <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
        <div className="flex min-w-0 items-center gap-2 text-[14px] font-medium"><span className="truncate">{m.name}</span>{m.demo && <Tag kind="demo" />}</div>
        <div className="flex items-center gap-1.5 truncate text-[12px] text-fg-3"><ProviderIcon id={provider} size={12} /> {m.place}</div>
        <Spec m={m} />
      </div>
      <CpuMem cpu={m.cpu} mem={m.mem} disk={mainDisk(m)} />
    </div>
  );
}

function Side({ g }: { g: Group }) {
  const up = g.machines.filter((m) => m.status === 'up').length;
  return (
    <div className="topo-side min-w-0">
      <div className="flex items-start justify-between gap-3 whitespace-nowrap" style={{ height: HEAD_H }}>
        <span className="label-mono inline-flex min-w-0 items-center gap-1.5 truncate"><ProviderIcon id={g.provider} size={12} /> {g.label}</span>
        <span className="mono text-[11px] text-fg-3">{up} of {g.machines.length} up</span>
      </div>
      <div className="flex flex-col" style={{ gap: GAP }}>
        {g.machines.map((m) => <ServerCard key={m.id} m={m} provider={g.provider} />)}
      </div>
    </div>
  );
}

/** Cards joined to a bus, bus joined to the hub's midline. `flip` mirrors it for the right side. */
function Connector({ machines, flip }: { machines: Machine[]; flip?: boolean }) {
  if (!machines.length) return <div />;
  const W = 100;
  const colH = machines.length * CARD_H + (machines.length - 1) * GAP;
  const ys = machines.map((_, i) => i * (CARD_H + GAP) + CARD_H / 2);
  const hubY = HUB_H / 2 - HEAD_H; // hub card starts at the top of the row, cards start below the header
  const bus = W / 2;
  const xCard = flip ? W : 0;
  const xHub = flip ? 0 : W;
  return (
    <div className="connector relative" style={{ paddingTop: HEAD_H }}>
      <svg width="100%" height={colH} viewBox={`0 0 ${W} ${colH}`} preserveAspectRatio="none" className="block overflow-visible">
        {ys.map((y, i) => <line key={i} x1={xCard} y1={y} x2={bus} y2={y} className={machines[i].status === 'down' ? 'down' : ''} />)}
        <line x1={bus} y1={Math.min(ys[0], hubY)} x2={bus} y2={Math.max(ys[ys.length - 1], hubY)} />
        <line x1={bus} y1={hubY} x2={xHub} y2={hubY} />
      </svg>
      {machines.map((m, i) => m.latencyMs != null && (
        <span key={m.id} className="mono absolute text-[11px] text-fg-4" style={{ top: HEAD_H + ys[i] - 18, [flip ? 'right' : 'left']: 6 }}>
          {m.latencyMs} ms
        </span>
      ))}
    </div>
  );
}

function HubCard({ h }: { h: HubInfo }) {
  const W = 340, H = 34;
  const max = Math.max(60, ...h.history);
  const n = Math.max(2, h.history.length);
  const pts = h.history.map((v, i) => `${(i / (n - 1)) * W},${H - 4 - (v / max) * (H - 8)}`).join(' ');
  return (
    <div
      id={h.name}
      className="hub-card flex min-w-0 scroll-mt-4 flex-col border border-(--edge) bg-surface p-5 shadow-(--shadow-soft)"
      style={{ height: HUB_H }}
    >
      <div className="mb-4 flex items-center gap-3.5">
        <Avatar name="overseer-hub" size={30} boxed />
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[18px] leading-6 font-semibold tracking-[-0.01em]">
            <span className="truncate">{h.name}</span> <Tag kind="hub" />
            {!h.live && <Tag kind="demo" />}
          </div>
          <div className="flex items-center gap-1.5 truncate text-[13px] text-fg-3"><ProviderIcon id={h.provider} size={13} /> {h.place}</div>
        </div>
      </div>
      <div className="meter relative h-9 w-full" role="img" aria-label={`CPU ${Math.round(h.cpu)}%`}>
        <div className="meter-fill opacity-25" style={{ width: `${h.cpu}%`, background: 'var(--tone-blue-solid)' }} />
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" className="absolute inset-0">
          <polyline points={pts} fill="none" stroke="var(--tone-blue-solid)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mono mt-auto truncate pt-3 text-[11px] text-fg-3">
        {h.live ? (
          <>
            {Math.round(h.cpu)}% CPU · {h.cores} cores · {h.memUsedGb.toFixed(1)} GB of {h.memGb} GB
            {h.diskFreeGb != null && <> · {Math.round(h.diskFreeGb)} GB free</>}
          </>
        ) : 'no answer from /api/machines'}
      </div>
    </div>
  );
}

/** The hub between the first two groups; any further groups are listed below, without connectors. */
export function Topology({ groups, hub }: { groups: Group[]; hub: HubInfo }) {
  const [left, right, ...rest] = groups;
  return (
    <Panel className="p-6 [container:topo/inline-size]">
      <div className={cn('topo-row', !right && 'one-side', !left && 'no-side')}>
        {left && <Side g={left} />}
        {left && <Connector machines={left.machines} />}
        <div className="hub-col flex flex-col">
          <HubCard h={hub} />
        </div>
        {right && <Connector machines={right.machines} flip />}
        {right && <Side g={right} />}
      </div>
      {rest.length > 0 && (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 border-t border-line-soft pt-6">
          {rest.map((g) => <Side key={g.id} g={g} />)}
        </div>
      )}
    </Panel>
  );
}
