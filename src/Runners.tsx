import { useEffect, useState } from 'react';
import { Badge, Dot } from './kit/badge';
import { cn } from './kit/cn';
import type { Machine } from './data';
import { Panel, SectionLabel } from './ui';

function ago(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

const resultClass = (r: string) => (r === 'Succeeded' ? 'text-tone-green' : r === 'Canceled' || r === 'Skipped' ? 'text-fg-4' : 'text-tone-red');
const stateTone = { busy: 'warn', idle: 'ok', offline: 'danger' } as const;

export function Runners({ machines }: { machines: Machine[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const hosts = machines.filter((m) => m.runners?.length);
  if (!hosts.length) return null;
  return (
    <>
      {hosts.map((m) => {
        const runners = m.runners!;
        const busy = runners.filter((r) => r.state === 'busy').length;
        const offline = runners.filter((r) => r.state === 'offline').length;
        return (
          <Panel className="p-5" key={m.id}>
            <SectionLabel note={`${runners.length} GitHub Actions · ${busy} busy${offline ? ` · ${offline} offline` : ''}`}>CI runners · {m.name}</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
              {runners.map((r) => (
                <a
                  className={cn(
                    'flex min-w-0 flex-col gap-1.5 border bg-surface no-underline px-3.5 py-3 transition-colors hover:bg-hover',
                    r.state === 'busy' ? 'border-tone-amber-solid/50' : 'border-line',
                    r.state === 'offline' && 'opacity-60',
                  )}
                  key={r.name}
                  href={`https://github.com/${r.repo}/actions`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Dot tone={stateTone[r.state]} pulse={r.state === 'busy'} />
                    <span className="truncate text-[14px] font-medium">{r.repo.split('/')[1] ?? r.repo}</span>
                    <Badge tone={stateTone[r.state]} className="ml-auto h-[18px] px-1 text-[11px]">{r.state}</Badge>
                  </div>
                  <div className="mono truncate text-[11px] text-fg-3">{r.name} · {r.repo.split('/')[0]}</div>
                  <div className="mono mt-0.5 flex min-w-0 items-center gap-2 text-[12px]">
                    {r.state === 'busy' && r.job ? (
                      <>
                        <Badge tone="blue" className="h-5 min-w-0 text-[11px]"><span className="truncate">{r.job}</span></Badge>
                        <span className="ml-auto whitespace-nowrap text-fg-3">running {r.since ? ago(r.since, now) : ''}</span>
                      </>
                    ) : r.last ? (
                      <>
                        <span className={cn('font-semibold', resultClass(r.last.result))}>{r.last.result === 'Succeeded' ? '✓' : r.last.result === 'Failed' ? '✗' : '–'}</span>
                        <span className="truncate">{r.last.job}</span>
                        <span className="ml-auto whitespace-nowrap text-fg-3">{r.last.result.toLowerCase()} · {ago(r.last.at, now)} ago</span>
                      </>
                    ) : (
                      <span className="text-fg-4">no jobs yet</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </Panel>
        );
      })}
    </>
  );
}
