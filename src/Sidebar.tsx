import { useState } from 'react';
import { LayoutGrid, ChevronDown, Sun, Moon, Monitor } from 'lucide-react';
import { Dot } from './kit/badge';
import { Segmented } from './kit/segmented';
import { cn } from './kit/cn';
import { groupFor, type Group, type Machine } from './data';
import { Avatar, ProviderIcon, Tag } from './ui';

export type Theme = 'light' | 'dark' | 'system';

const statusText = (m: Machine) =>
  m.status === 'asleep' ? 'asleep' : m.status === 'down' ? 'offline' : `${Math.round(m.cpu ?? 0)}%`;

/** A nav row in the chrome: the site's left-nav look (subtle ink, a 4% hover, a 7% fill when current). */
const row = 'flex h-8 no-underline w-full items-center gap-2.5 px-2 text-left text-[14px] text-fg-2 hover:bg-chrome-hover hover:text-fg';

function GroupList({ g, extra = [] }: { g: Group; extra?: Machine[] }) {
  const [open, setOpen] = useState(true);
  const all = [...extra, ...g.machines];
  const up = all.filter((m) => m.status === 'up').length;
  return (
    <div className="mb-1">
      <button className={row} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="grid w-4 shrink-0 place-items-center text-fg-3"><ProviderIcon id={g.provider} /></span>
        <span className="truncate">{g.name}</span>
        <span className="mono text-[11px] text-fg-4">{`${up}/${all.length}`}</span>
        <ChevronDown size={14} className={cn('ml-auto text-fg-4 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && all.map((m) => (
        <a key={m.id} className={cn(row, 'pl-4')} href={`#${m.id}`}>
          <span className="grid w-4 shrink-0 place-items-center"><Avatar name={m.name} size={14} /></span>
          <span className="truncate">{m.name}</span>
          {m.hub && <Tag kind="hub" />}
          {m.demo && <Tag kind="demo" />}
          <span className={cn('mono ml-auto text-[11px] tabular-nums', m.status === 'down' ? 'text-tone-red' : 'text-fg-4')}>{statusText(m)}</span>
        </a>
      ))}
    </div>
  );
}

export function Sidebar({ servers, hubMachine, hubGroupId, theme, setTheme }: {
  servers: Group[]; hubMachine: Machine; hubGroupId: string; theme: Theme; setTheme: (t: Theme) => void;
}) {
  const machines = servers.flatMap((g) => g.machines);
  const all = [hubMachine, ...machines];
  const total = all.length;
  const online = all.filter((m) => m.status === 'up').length;
  // the hub is listed in its own group, which may have no other machines
  const hubInServers = servers.some((g) => g.id === hubGroupId);
  const hubOnly: Group = { ...groupFor(hubGroupId), machines: [] };

  return (
    <aside className="sticky top-0 flex h-dvh flex-col border-r border-chrome-line bg-chrome max-[800px]:static max-[800px]:h-auto max-[800px]:border-r-0 max-[800px]:border-b">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-chrome-line px-4">
        <Avatar name="overseer-hub" size={18} />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">overseer</span>
      </div>

      <nav className="shrink-0 px-2 pt-3">
        <a className={cn(row, 'bg-chrome-active text-fg')} href="#" aria-current="page">
          <LayoutGrid size={16} strokeWidth={1.75} className="shrink-0" />
          <span>All machines</span>
          <span className="mono ml-auto text-[11px] text-fg-3">{online}/{total}</span>
        </a>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-5 pb-4">
        <div className="label-mono mb-1.5 px-2">Servers</div>
        {servers.map((g) => <GroupList key={g.id} g={g} extra={g.id === hubGroupId ? [hubMachine] : []} />)}
        {!hubInServers && <GroupList g={hubOnly} extra={[hubMachine]} />}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-chrome-line px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-fg-2">
          <Dot tone="ok" /> {online} online · {total - online} not reporting
        </div>
        <Segmented
          aria-label="Theme"
          value={theme}
          onChange={setTheme}
          className="self-start"
          options={([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']] as const).map(([value, Icon, name]) => ({
            value,
            icon: <Icon size={14} aria-hidden />,
            label: <span className="sr-only">{name}</span>,
          }))}
        />
      </div>
    </aside>
  );
}
