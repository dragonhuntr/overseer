import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, KeyRound, Pause, Play, Plus, Unplug, X } from 'lucide-react';
import { Dot } from './kit/badge';
import { Button } from './kit/button';
import { Dialog } from './kit/dialog';
import { EmptyState } from './kit/empty';
import { TextInput } from './kit/input';
import { Switch } from './kit/switch';
import { Tooltip } from './kit/tooltip';
import { cn } from './kit/cn';
import type { ClaudeAccount, OpenRouterStatus } from '../server/subscription-types';
import { Meter, Panel, PlanBadge, ProviderIcon } from './ui';

interface Subs { claude: ClaudeAccount[]; openrouter: OpenRouterStatus }

async function post<T = any>(path: string, body: object): Promise<T> {
  const r = await fetch(`/api/subscriptions/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  return data;
}

function useSubscriptions() {
  const [subs, setSubs] = useState<Subs | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/subscriptions');
      if (r.ok) setSubs(await r.json());
    } catch { /* hub unreachable */ }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);
  return [subs, refresh] as const;
}

function resetIn(iso: string | null | undefined) {
  if (!iso) return undefined;
  const s = Math.max(0, (Date.parse(iso) - Date.now()) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `in ${d}d ${h}h` : `in ${h}h ${m}m`;
}

function Gauge({ label, pct, reset, empty }: { label: string; pct: number | null; reset?: string; empty?: string }) {
  const hot = pct != null && pct >= 90;
  return (
    <div className="mono flex min-w-0 flex-col gap-1 text-[11px]">
      <div className="flex justify-between">
        <span className="text-fg-4">{label}</span>
        <span className={cn('tabular-nums', hot ? 'text-tone-red' : 'text-fg-2')}>{pct == null ? '–' : `${pct}%`}</span>
      </div>
      <Meter pct={pct} width="100%" height={8} />
      <div className="truncate text-fg-4">{pct == null ? empty ?? '\u00a0' : reset ?? '\u00a0'}</div>
    </div>
  );
}

const fableLimit = (a: ClaudeAccount) => a.usage?.limits.find((l) => l.scope?.toLowerCase() === 'fable');

function accountTone(a: ClaudeAccount): 'muted' | 'danger' | 'warn' | 'ok' {
  if (a.paused) return 'muted';
  if (a.error) return 'danger';
  const pcts = [a.usage?.fiveHour?.percent ?? 0, a.usage?.week?.percent ?? 0, ...(a.usage?.limits.map((l) => l.percent) ?? [])];
  if (Math.max(...pcts) >= 100) return 'danger';
  if (Math.max(...pcts) >= 80 || a.usage?.limits.some((l) => l.severity !== 'normal')) return 'warn';
  return 'ok';
}

/** A square ghost icon button with its name as a tooltip. */
function IconAction({ label, children, ...rest }: { label: string; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <Tooltip content={label}>
      <Button variant="ghost" square aria-label={label} {...rest}>{children}</Button>
    </Tooltip>
  );
}

function ClaudeRow({ a, fable, first, last, onChange }: {
  a: ClaudeAccount; fable: boolean; first: boolean; last: boolean; onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const act = async (path: string, body: object) => {
    setBusy(true);
    try { await post(path, body); onChange(); } finally { setBusy(false); }
  };
  const f = fableLimit(a);
  const week = fable
    ? { label: 'fable', pct: f ? f.percent : null, reset: resetIn(f?.resetsAt), empty: 'no fable limit' }
    : { label: 'week', pct: a.usage?.week?.percent ?? null, reset: resetIn(a.usage?.week?.resetsAt), empty: 'no data' };
  return (
    <div className={cn('acct group min-h-[68px] border-t border-line-soft px-5 py-3 first:border-t-0', a.paused && 'opacity-55')}>
      <Dot tone={accountTone(a)} />
      <div className="min-w-0">
        <div className="mb-0.5 truncate text-[14px] font-medium" title={a.email}>{a.name}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-[12px]">
          <PlanBadge plan={a.plan} />
          <span className={cn('truncate', a.error ? 'text-tone-red' : 'text-fg-3')} title={a.error ?? a.email}>
            {a.paused ? 'paused' : a.error ? 'can’t read usage' : a.email}
          </span>
        </div>
      </div>
      <Gauge label="5h" pct={a.paused ? null : a.usage?.fiveHour?.percent ?? (a.usage ? 0 : null)}
        reset={resetIn(a.usage?.fiveHour?.resetsAt)} empty={a.paused ? 'paused' : 'no data'} />
      <Gauge label={week.label} pct={a.paused ? null : week.pct} reset={week.reset} empty={a.paused ? 'paused' : week.empty} />
      <div className="flex justify-end gap-0.5 opacity-40 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100" aria-busy={busy}>
        <IconAction label="Move up" disabled={first || busy} onClick={() => act('claude/move', { id: a.id, dir: -1 })}><ArrowUp /></IconAction>
        <IconAction label="Move down" disabled={last || busy} onClick={() => act('claude/move', { id: a.id, dir: 1 })}><ArrowDown /></IconAction>
        <IconAction label={a.paused ? 'Resume' : 'Pause'} disabled={busy} onClick={() => act('claude/pause', { id: a.id, paused: !a.paused })}>
          {a.paused ? <Play /> : <Pause />}
        </IconAction>
        <IconAction label="Disconnect" disabled={busy} onClick={() => setConfirming(true)}><X /></IconAction>
      </div>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        size="sm"
        title={`Disconnect ${a.name}?`}
        description="Overseer stops reading this account's usage and forgets its login. You can connect it again later."
        footer={<>
          <Button onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="danger-solid" icon={<Unplug />} loading={busy}
            onClick={async () => { await act('claude/remove', { id: a.id }); setConfirming(false); }}>Disconnect</Button>
        </>}
      />
    </div>
  );
}

function ConnectClaude({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    post<{ url: string }>('claude/login', {}).then((r) => setUrl(r.url)).catch((e) => setErr(e.message));
  }, []);
  const submit = async () => {
    setBusy(true); setErr('');
    try { await post('claude/complete', { code }); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-3 border-b border-line-soft bg-sunken px-5 py-4 text-[14px]">
      <ol className="m-0 flex list-decimal flex-col gap-3 pl-5 marker:text-fg-4">
        <li>
          <a className={cn('inline-flex items-center gap-1 font-medium text-(--blue-ink) no-underline hover:underline', !url && 'pointer-events-none opacity-50')}
            href={url || undefined} target="_blank" rel="noreferrer" aria-disabled={!url}>
            Log in to Claude <ExternalLink size={13} />
          </a>{' '}
          <span className="text-fg-2">with the account to add (use a private window to pick a different one).</span>
        </li>
        <li>
          <span className="text-fg-2">Paste the code it shows:</span>
          <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (code.includes('#')) submit(); }}>
            <TextInput className="mono min-w-48 flex-1" value={code} onChange={(e) => setCode(e.target.value)} placeholder="code#state" autoFocus invalid={!!err} />
            <Button type="submit" variant="primary" disabled={!code.includes('#')} loading={busy}>Connect</Button>
            <Button onClick={onCancel}>Cancel</Button>
          </form>
        </li>
      </ol>
      {err && <div className="text-[13px] text-tone-red">{err}</div>}
      <div className="text-[12px] text-fg-3">Overseer gets its own read-only login (profile scope only). It can read usage, not use your quota.</div>
    </div>
  );
}

function OpenRouterRow({ s, onChange }: { s: OpenRouterStatus; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (k: string) => {
    setBusy(true); setErr('');
    try { await post('openrouter/key', { key: k }); setEditing(false); setKey(''); onChange(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  if (!s.connected || editing) {
    return (
      <div className="credit px-5 py-4">
        <div className="flex items-center gap-3 text-[14px] font-medium"><ProviderIcon id="openrouter" size={16} /> OpenRouter</div>
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (key) save(key); }}>
          <TextInput className="mono min-w-40 flex-1" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-or-v1-…" invalid={!!err} />
          <Button type="submit" variant="primary" disabled={!key} loading={busy}>Connect</Button>
          {editing && <Button onClick={() => setEditing(false)}>Cancel</Button>}
          {err && <span className="text-[13px] text-tone-red">{err}</span>}
        </form>
        <div className="text-right text-[13px]">
          <a className="inline-flex items-center gap-1 text-(--blue-ink) no-underline hover:underline" href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer">Get a key <ExternalLink size={12} /></a>
        </div>
      </div>
    );
  }

  const total = s.totalCredits ?? s.keyLimit ?? null;
  const used = s.totalCredits != null ? s.totalUsage ?? 0 : s.keyUsage ?? 0;
  const left = total != null ? total - used : null;
  const leftPct = total ? Math.round((left! / total) * 100) : null;
  return (
    <div className="credit px-5 py-4">
      <div className="flex items-center gap-3 text-[14px] font-medium">
        <ProviderIcon id="openrouter" size={16} /> OpenRouter
        <IconAction label="Change key" onClick={() => setEditing(true)}><KeyRound /></IconAction>
      </div>
      <div className="mono flex flex-col gap-1.5 text-[11px]">
        <div className="flex justify-between text-fg-3">
          <span>used ${used.toFixed(2)}</span>
          <span>{s.error ? <span className="text-tone-red">{s.error}</span> : leftPct != null ? `${leftPct}% left` : 'no limit set'}</span>
        </div>
        <Meter pct={leftPct != null ? 100 - leftPct : 0} width="100%" height={8} danger={101}
          color={leftPct != null && leftPct < 30 ? 'var(--tone-amber-solid)' : 'var(--tone-blue-solid)'} />
      </div>
      <div className="text-right text-[18px] font-semibold tabular-nums tracking-[-0.01em] whitespace-nowrap">
        {left != null ? <>${left.toFixed(2)} <span className="text-[12px] font-normal text-fg-3">of ${total!.toFixed(2)}</span></> : <span className="text-[13px] font-normal text-fg-3">${used.toFixed(2)} used</span>}
      </div>
    </div>
  );
}

export function Subscriptions() {
  const [subs, refresh] = useSubscriptions();
  const [fable, setFable] = useState(false);
  const [adding, setAdding] = useState(false);
  const claude = subs?.claude ?? [];
  const or = subs?.openrouter ?? { connected: false };
  const active = claude.filter((a) => !a.paused);
  const ready = active.filter((a) => accountTone(a) !== 'danger').length;
  const hasFable = claude.some(fableLimit);
  const orLeft = or.totalCredits != null ? or.totalCredits - (or.totalUsage ?? 0) : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] leading-6 font-semibold tracking-[-0.01em]">Subscriptions</h2>
          <p className="mt-0.5 text-[14px] text-fg-2">
            <span className="text-fg">{claude.length}</span> Claude account{claude.length === 1 ? '' : 's'}
            {claude.length > 0 && <> · {ready} of {active.length} ready</>}
            {orLeft != null && <> · OpenRouter <span className="text-fg">${orLeft.toFixed(2)}</span> left</>}
          </p>
        </div>
        <Tooltip content={hasFable ? 'Show the Fable-only weekly limit' : 'No connected account has a Fable limit'}>
          <label className={cn('flex items-center gap-2 text-[14px] text-fg-2', hasFable ? 'cursor-pointer' : 'opacity-50')}>
            <Switch checked={fable} onCheckedChange={setFable} disabled={!hasFable} aria-label="Fable limit" />
            Fable limit
          </label>
        </Tooltip>
      </div>

      <Panel className="[container:accts/inline-size]">
        <div className="flex min-h-14 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line px-5 py-3">
          <ProviderIcon id="claude" size={16} />
          <span className="text-[14px] font-medium">Claude</span>
          <span className="text-[13px] text-fg-3">{claude.length ? `${ready} of ${active.length} ready` : 'subscriptions'}</span>
          {!adding && <Button className="ml-auto" icon={<Plus />} onClick={() => setAdding(true)}>Connect account</Button>}
        </div>
        {adding && <ConnectClaude onDone={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}
        {claude.map((a, i) => (
          <ClaudeRow key={a.id} a={a} fable={fable} first={i === 0} last={i === claude.length - 1} onChange={refresh} />
        ))}
        {!claude.length && !adding && (
          <EmptyState icon={Unplug} title="No Claude accounts connected" className="py-10"
            action={<Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>Connect account</Button>} />
        )}

        <div className="flex min-h-14 flex-wrap items-center gap-x-2.5 gap-y-1 border-y border-line px-5 py-3">
          <span className="text-[14px] font-medium">Credits</span>
          <span className="text-[13px] text-fg-3">pay as you go</span>
          {orLeft != null && <span className="ml-auto whitespace-nowrap"><span className="text-[18px] font-semibold tabular-nums">${orLeft.toFixed(2)}</span> <span className="text-[12px] text-fg-3">left</span></span>}
        </div>
        <OpenRouterRow s={or} onChange={refresh} />
      </Panel>
    </section>
  );
}
