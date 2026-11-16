import { Badge } from './kit/badge';
import { cn } from './kit/cn';
import type { Machine } from './data';
import { Meter, Panel, SectionLabel } from './ui';
import { gpuSummary } from './Topology';

const gb = (mb: number) => (mb / 1024).toFixed(1);

export function Gpus({ machines }: { machines: Machine[] }) {
  const withGpus = machines.filter((m) => m.status === 'up' && m.gpus?.length);
  if (!withGpus.length) return null;
  return (
    <>
      {withGpus.map((m) => {
        const gpus = m.gpus!;
        const busy = gpus.filter((g) => g.util >= 10).length;
        const watts = gpus.reduce((s, g) => s + g.powerW, 0);
        const vramUsed = gpus.reduce((s, g) => s + g.memUsedMb, 0);
        const vramTotal = gpus.reduce((s, g) => s + g.memTotalMb, 0);
        return (
          <Panel className="p-5" key={m.id}>
            <SectionLabel note={`${gpuSummary(m)} · ${busy} busy · ${gb(vramUsed)}/${gb(vramTotal)} GB · ${watts} W`}>GPUs · {m.name}</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5">
              {gpus.map((g) => {
                const procs = [...new Set(g.procs.map((p) => p.name))];
                return (
                  <div className={cn('flex flex-col gap-2.5 border bg-surface px-3.5 py-3', g.util >= 10 ? 'border-tone-blue-solid/50' : 'border-line')} key={g.index}>
                    <div className="flex items-baseline gap-2 text-[14px]">
                      <span className="font-medium">GPU {g.index}</span>
                      <span className="mono truncate text-[11px] text-fg-3">{g.name}</span>
                      <span className={cn('mono ml-auto text-[12px]', g.tempC >= 80 ? 'text-tone-red' : 'text-fg-2')}>{g.tempC}°C</span>
                    </div>
                    <div className="mono grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 text-[11px] [&>span:nth-child(3n)]:min-w-16 [&>span:nth-child(3n)]:text-right [&>span:nth-child(3n)]:text-fg-2">
                      <span className="text-fg-4">util</span><Meter pct={g.util} width="100%" height={7} /><span>{g.util}%</span>
                      <span className="text-fg-4">vram</span><Meter pct={(100 * g.memUsedMb) / g.memTotalMb} width="100%" height={7} danger={97} /><span>{gb(g.memUsedMb)}/{gb(g.memTotalMb)}G</span>
                      <span className="text-fg-4">power</span><Meter pct={(100 * g.powerW) / (g.powerLimitW || 1)} width="100%" height={7} danger={101} /><span>{g.powerW}/{g.powerLimitW}W</span>
                    </div>
                    <div className="flex min-h-5 flex-wrap gap-1.5">
                      {procs.length ? procs.map((p) => <Badge key={p} tone="blue" className="h-5 text-[11px]">{p}</Badge>) : <span className="mono text-[11px] text-fg-4">idle</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </>
  );
}
