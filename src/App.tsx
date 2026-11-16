import { useEffect, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { PageHeader } from './kit/page-header';
import { TooltipProvider } from './kit/tooltip';
import { groupFor, hub as placeholderHub, type Group, type LiveMachine, type Machine } from './data';
import { Sidebar, type Theme } from './Sidebar';
import { Topology, type HubInfo } from './Topology';
import { Gpus } from './Gpus';
import { Runners } from './Runners';
import { Subscriptions } from './Subscriptions';

const POLL_MS = 3000;
const toMachine = (l: LiveMachine): Machine => ({
  id: l.id, name: l.name, status: l.status, cpu: l.cpu, mem: l.mem, cores: l.cores, memGb: l.memGb,
  latencyMs: l.latencyMs ?? undefined, place: l.place, gpus: l.gpus, runners: l.runners ?? [], disks: l.disks ?? [], uptimeSec: l.uptimeSec, hub: l.hub,
});

/** One group per OVERSEER_GROUP the machines report, in the order first seen. */
function groupMachines(live: LiveMachine[]): Group[] {
  const groups = new Map<string, Group>();
  for (const m of live) {
    const id = m.group || 'tailnet';
    if (!groups.has(id)) groups.set(id, { ...groupFor(id), machines: [] });
    groups.get(id)!.machines.push(toMachine(m));
  }
  return [...groups.values()];
}

function useLiveMachines() {
  const [live, setLive] = useState<LiveMachine[] | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/machines');
        if (r.ok && !stop) setLive(await r.json());
      } catch { /* hub unreachable: keep last snapshot */ }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, []);
  return live;
}

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('theme') as Theme) || 'dark'; } catch { return 'dark'; }
  });
  // The theme is the `dark` class on <html>; "system" follows the OS live.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
    apply();
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
    if (theme !== 'system') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return [theme, setTheme];
}

export default function App() {
  const live = useLiveMachines();
  const [theme, setTheme] = useTheme();

  const liveHub = live?.find((m) => m.hub);
  const servers = groupMachines(live?.filter((m) => !m.hub) ?? []);
  const hubGroupId = liveHub?.group || 'tailnet';
  const hubGroup = groupFor(hubGroupId);

  const hub: HubInfo = liveHub
    ? {
        name: liveHub.name, place: `${liveHub.place || hubGroup.name} · this hub`, provider: hubGroup.provider,
        cpu: liveHub.cpu ?? 0, cores: liveHub.cores, memGb: liveHub.memGb,
        memUsedGb: ((liveHub.mem ?? 0) / 100) * liveHub.memGb, history: liveHub.history, live: true,
        diskFreeGb: liveHub.disks?.length ? [...liveHub.disks].sort((a, b) => b.sizeGb - a.sizeGb)[0].freeGb : undefined,
      }
    : { ...placeholderHub, history: [], live: false };
  const hubMachine: Machine = liveHub
    ? toMachine(liveHub)
    : { id: placeholderHub.name, name: placeholderHub.name, status: 'asleep', cpu: null, mem: null, cores: 0, memGb: 0, demo: true, hub: true };

  const allMachines = [hubMachine, ...servers.flatMap((g) => g.machines)];

  const up = allMachines.filter((m) => m.status === 'up').length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid min-h-dvh grid-cols-[264px_minmax(0,1fr)] bg-canvas text-fg max-[800px]:grid-cols-1">
        <Sidebar
          servers={servers}
          hubMachine={hubMachine}
          hubGroupId={hubGroupId}
          theme={theme}
          setTheme={setTheme}
        />
        <main className="min-w-0">
          <PageHeader icon={<LayoutGrid />} title="Machines" count={`${up} / ${allMachines.length} up`} className="sticky top-0 z-10" />
          <div className="mx-auto flex max-w-[1460px] flex-col gap-12 px-8 py-8 max-[800px]:px-4 max-[800px]:py-5">
            <div className="flex flex-col gap-4">
              <Topology groups={servers} hub={hub} />
              <Gpus machines={allMachines} />
              <Runners machines={allMachines} />
            </div>
            <Subscriptions />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
