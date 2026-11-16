// overseer hub: agents push raw stats here, the dashboard reads /api/machines.
//   bun run server/index.ts
// env: PORT (7420), OVERSEER_TOKEN (required for pushes), HUB_ID, HUB_NAME, HUB_PLACE, HUB_GROUP
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseStats, sections, type LiveMachine } from './parse';
import { ClaudeAccounts } from './claude';
import { OpenRouter } from './openrouter';

const PORT = Number(process.env.PORT ?? 7420);
const TOKEN = process.env.OVERSEER_TOKEN ?? '';
const STALE_MS = 15_000; // no push for this long => offline
const HISTORY = 60;
const ROOT = join(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');
const STATE = join(ROOT, 'data', 'machines.json');

if (!TOKEN) console.warn('OVERSEER_TOKEN is not set: pushes will be rejected');

const machines = new Map<string, LiveMachine>();
const prevCpu = new Map<string, { idle: number; total: number }>();

// remember machines across restarts so offline ones still show up
try {
  for (const m of JSON.parse(readFileSync(STATE, 'utf8')) as LiveMachine[]) machines.set(m.id, { ...m, history: m.history ?? [] });
} catch { /* first run */ }
let dirty = false;
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(STATE, JSON.stringify([...machines.values()]));
}, 10_000);

function ingest(raw: string, latencyFromClient?: number | null, overrides: Record<string, string> = {}) {
  const s = sections(raw);
  const meta: Record<string, string> = {
    ...Object.fromEntries((s.META ?? []).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })),
    ...overrides,
  };
  const id = (meta.id ?? '').replace(/[^\w.-]/g, '');
  if (!id) throw new Error('missing id');
  const prev = machines.get(id);
  const stats = parseStats(meta.os === 'linux' ? 'linux' : 'darwin', s, prevCpu, id, prev?.cpu ?? null);
  const history = [...(prev?.history ?? []), stats.cpu ?? 0].slice(-HISTORY);
  const m: LiveMachine = {
    id,
    name: meta.name || id,
    group: meta.group || 'tailnet',
    place: meta.place || '',
    os: meta.os === 'linux' ? 'linux' : 'darwin',
    hub: meta.hub === '1',
    status: 'up',
    latencyMs: latencyFromClient !== undefined ? latencyFromClient : num(meta.rtt_ms),
    ...stats,
    history,
    lastSeen: Date.now(),
  };
  machines.set(id, m);
  dirty = true;
}

const num = (s: string | undefined) => {
  const n = Number(s);
  return s != null && s !== '' && Number.isFinite(n) ? n : null;
};

// the hub reports on itself without an agent
async function selfReport() {
  const cmd = await Bun.file(join(ROOT, 'agent', 'collect.sh')).text();
  const proc = Bun.spawn(['sh', '-c', cmd], {
    stdout: 'pipe',
    env: {
      ...process.env,
      OVERSEER_ID: process.env.HUB_ID ?? 'hub',
      OVERSEER_NAME: process.env.HUB_NAME ?? 'hub',
      OVERSEER_GROUP: process.env.HUB_GROUP ?? 'tailnet',
      OVERSEER_PLACE: process.env.HUB_PLACE ?? 'Tailnet',
      OVERSEER_HUB: '1',
    },
  });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  try { ingest(out, 0); } catch (e) { console.error('self report failed', e); }
}
selfReport();
setInterval(selfReport, 3000);

// ---- pull: for machines that can't reach the hub (e.g. devices shared into the tailnet) ----
interface PullHost { id: string; name?: string; group?: string; place?: string; ssh: string; key?: string }
let pullHosts: PullHost[] = [];
try { pullHosts = JSON.parse(readFileSync(join(ROOT, 'pull.json'), 'utf8')); } catch { /* none */ }

/** TCP connect time to the host's ssh port ~ one network round trip */
async function rtt(host: string): Promise<number | null> {
  const t0 = performance.now();
  try {
    const sock = await Promise.race([
      Bun.connect({ hostname: host, port: 22, socket: { data() {} } }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    const ms = Math.round(performance.now() - t0);
    sock.end();
    return ms;
  } catch { return null; }
}

async function pull(h: PullHost) {
  const key = h.key?.replace(/^~/, homedir());
  const proc = Bun.spawn([
    'ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5',
    '-o', 'ControlMaster=auto', '-o', `ControlPath=${join(tmpdir(), `overseer-pull-${h.id}.sock`)}`, '-o', 'ControlPersist=120',
    ...(key ? ['-i', key] : []), h.ssh, 'collect',
  ], { stdout: 'pipe', stderr: 'pipe' });
  const timer = setTimeout(() => proc.kill(), 10_000);
  const [out, code, latency] = await Promise.all([new Response(proc.stdout).text(), proc.exited, rtt(h.ssh.split('@').pop()!)]);
  clearTimeout(timer);
  if (code !== 0) return; // goes stale -> shown offline
  const o: Record<string, string> = { id: h.id };
  if (h.name) o.name = h.name;
  if (h.group) o.group = h.group;
  if (h.place) o.place = h.place;
  try { ingest(out, latency, o); } catch (e) { console.error(`pull ${h.id} failed`, e); }
}
if (pullHosts.length) {
  const pullAll = () => Promise.all(pullHosts.map(pull)).finally(() => setTimeout(pullAll, 3000));
  pullAll();
}

function snapshot(): LiveMachine[] {
  const now = Date.now();
  return [...machines.values()].map((m) =>
    now - m.lastSeen > STALE_MS ? { ...m, status: 'down', cpu: null, mem: null, latencyMs: null, gpus: [], runners: [], disks: [] } : m,
  );
}

const claude = new ClaudeAccounts(join(ROOT, 'data', 'claude-accounts.json'));
const openrouter = new OpenRouter(join(ROOT, 'data', 'openrouter.json'));

const json = async (req: Request) => {
  // JSON-only: browsers can't send this cross-site without a CORS preflight we never approve
  if (!req.headers.get('content-type')?.includes('application/json')) throw new Error('expected application/json');
  return (await req.json()) as Record<string, any>;
};
const fail = (e: unknown, status = 400) => Response.json({ error: (e as Error).message }, { status });

async function subscriptionsApi(req: Request, pathname: string): Promise<Response | null> {
  if (pathname === '/api/subscriptions' && req.method === 'GET')
    return Response.json({ claude: claude.list(), openrouter: openrouter.get() });
  if (req.method !== 'POST' || !pathname.startsWith('/api/subscriptions/')) return null;
  try {
    const body = await json(req);
    switch (pathname) {
      case '/api/subscriptions/claude/login': return Response.json(claude.startLogin());
      case '/api/subscriptions/claude/complete': return Response.json(await claude.completeLogin(String(body.code ?? '')));
      case '/api/subscriptions/claude/pause': return Response.json({ ok: claude.setPaused(String(body.id), !!body.paused) });
      case '/api/subscriptions/claude/remove': return Response.json({ ok: claude.remove(String(body.id)) });
      case '/api/subscriptions/claude/move': return Response.json({ ok: claude.move(String(body.id), body.dir === -1 ? -1 : 1) });
      case '/api/subscriptions/openrouter/key':
        if (body.key) await openrouter.setKey(String(body.key)); else openrouter.clear();
        return Response.json(openrouter.get());
    }
  } catch (e) { return fail(e); }
  return null;
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(req) {
    const { pathname } = new URL(req.url);
    // Optional: if agents push through a Cloudflare Tunnel, only /api/push may come in that way.
    // The dashboard and its API have no login, so keep everything else on your private network.
    if (req.headers.has('cf-connecting-ip') && pathname !== '/api/push') return new Response('not found', { status: 404 });

    if (pathname === '/api/push' && req.method === 'POST') {
      if (!TOKEN || req.headers.get('authorization') !== `Bearer ${TOKEN}`) return new Response('unauthorized', { status: 401 });
      const body = await req.text();
      if (body.length > 256_000) return new Response('too large', { status: 413 });
      try { ingest(body); } catch (e) { return new Response((e as Error).message, { status: 400 }); }
      return new Response('ok');
    }
    if (pathname === '/api/push') return new Response('method not allowed', { status: 405 });
    if (pathname === '/api/machines') return Response.json(snapshot());
    const sub = await subscriptionsApi(req, pathname);
    if (sub) return sub;

    // static dashboard
    if (existsSync(DIST)) {
      const file = Bun.file(join(DIST, pathname === '/' ? 'index.html' : pathname.replace(/\.\.+/g, '')));
      if (await file.exists()) return new Response(file);
      return new Response(Bun.file(join(DIST, 'index.html')));
    }
    return new Response('dashboard not built: run `bun run build`', { status: 404 });
  },
});
console.log(`overseer hub listening on :${PORT}`);
