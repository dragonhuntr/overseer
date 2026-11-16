// Parses the raw section output of agent/collect.sh into machine stats.

export interface Gpu {
  index: number;
  name: string;
  util: number;
  memUsedMb: number;
  memTotalMb: number;
  tempC: number;
  powerW: number;
  powerLimitW: number;
  fan: number | null;
  procs: { pid: number; name: string; memMb: number }[];
}

export interface Runner {
  name: string;
  repo: string;
  state: 'busy' | 'idle' | 'offline';
  /** job running now */
  job?: string;
  since?: number;
  /** most recent finished job */
  last?: { job: string; result: string; at: number };
}

export interface Disk {
  mount: string;
  label: string;
  sizeGb: number;
  usedGb: number;
  freeGb: number;
  pct: number;
}

export interface LiveMachine {
  id: string;
  name: string;
  group: string;
  place: string;
  os: 'linux' | 'darwin';
  hub: boolean;
  status: 'up' | 'down';
  cpu: number | null;
  mem: number | null;
  cores: number;
  memGb: number;
  latencyMs: number | null;
  uptimeSec: number | null;
  gpus: Gpu[];
  runners: Runner[];
  disks: Disk[];
  history: number[];
  lastSeen: number;
}

type Stats = Pick<LiveMachine, 'cpu' | 'mem' | 'cores' | 'memGb' | 'uptimeSec' | 'gpus' | 'runners' | 'disks'>;

export function sections(out: string) {
  const map: Record<string, string[]> = {};
  let cur = '';
  for (const line of out.split('\n')) {
    if (line.startsWith('##')) { cur = line.slice(2).trim(); map[cur] = []; }
    else if (cur && line.trim()) map[cur].push(line.trim());
  }
  return map;
}

const num = (s: string | undefined) => {
  const n = Number(s);
  return s != null && s !== '' && Number.isFinite(n) ? n : null;
};

function procName(path: string) {
  const base = path.split('/').pop() ?? path;
  if (/vllm/i.test(base)) return 'vllm';
  return base.replace(/::.*/, '');
}

function parseGpus(s: Record<string, string[]>): Gpu[] {
  const uuidToIndex = new Map<string, number>();
  const gpus: Gpu[] = (s.GPU ?? []).map((line) => {
    const [index, uuid, name, util, used, tot, temp, pw, pl, fan] = line.split(',').map((x) => x.trim());
    uuidToIndex.set(uuid, Number(index));
    return {
      index: Number(index),
      name: (name ?? '').replace(/^NVIDIA\s+(GeForce\s+)?/, ''),
      util: num(util) ?? 0,
      memUsedMb: num(used) ?? 0,
      memTotalMb: num(tot) ?? 0,
      tempC: num(temp) ?? 0,
      powerW: Math.round(num(pw) ?? 0),
      powerLimitW: Math.round(num(pl) ?? 0),
      fan: num(fan),
      procs: [],
    };
  });
  for (const line of s.APPS ?? []) {
    const [uuid, pid, pname, mem] = line.split(',').map((x) => x.trim());
    const g = gpus.find((x) => x.index === uuidToIndex.get(uuid));
    g?.procs.push({ pid: Number(pid), name: procName(pname ?? ''), memMb: num(mem) ?? 0 });
  }
  return gpus;
}

const TS = /(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)Z: /;
const ts = (s: string) => Date.parse(s.replace(' ', 'T') + 'Z');

export function parseRunners(s: Record<string, string[]>): Runner[] {
  return (s.RUNNERS ?? []).map((line) => {
    const [name, repo, on, lastLine = '', doneLine = ''] = line.split('|');
    const r: Runner = { name, repo, state: on === '1' ? 'idle' : 'offline' };
    const done = doneLine.match(new RegExp(TS.source + 'Job (.+) completed with result: (\\w+)'));
    if (done) r.last = { job: done[2], result: done[3], at: ts(done[1]) };
    const running = lastLine.match(new RegExp(TS.source + 'Running job: (.+)$'));
    if (running && on === '1') Object.assign(r, { state: 'busy', job: running[2].trim(), since: ts(running[1]) });
    return r;
  });
}

export function parseDisks(s: Record<string, string[]>): Disk[] {
  const gb = (kb: number) => Math.round((kb / 1024 / 1024) * 10) / 10;
  return (s.DISK ?? []).map((line) => {
    const [mount, size, used, avail] = line.split('|');
    const sizeKb = Number(size), usedKb = Number(used);
    const label = mount === '/System/Volumes/Data' ? 'Macintosh HD' : mount.startsWith('/Volumes/') ? mount.slice(9) : mount;
    return { mount, label, sizeGb: gb(sizeKb), usedGb: gb(usedKb), freeGb: gb(Number(avail)), pct: sizeKb ? Math.round((100 * usedKb) / sizeKb) : 0 };
  }).filter((d) => d.sizeGb > 0);
}

export function parseStats(
  os: 'linux' | 'darwin',
  s: Record<string, string[]>,
  prevCpu: Map<string, { idle: number; total: number }>,
  id: string,
  prevCpuPct: number | null,
): Stats {
  if (os === 'linux') {
    // CPU % from /proc/stat deltas between pushes
    const f = (s.STAT?.[0] ?? '').split(/\s+/).slice(1).map(Number);
    const idle = (f[3] ?? 0) + (f[4] ?? 0);
    const total = f.reduce((a, b) => a + b, 0);
    const p = prevCpu.get(id);
    prevCpu.set(id, { idle, total });
    const cpu = p && total > p.total ? Math.round(100 * (1 - (idle - p.idle) / (total - p.total))) : prevCpuPct;
    const kb = (k: string) => num(s.MEM?.find((l) => l.startsWith(k))?.split(/\s+/)[1]) ?? 0;
    const memTotal = kb('MemTotal');
    const memAvail = kb('MemAvailable');
    return {
      cpu,
      mem: memTotal ? Math.round(100 * (1 - memAvail / memTotal)) : null,
      cores: num(s.NPROC?.[0]) ?? 0,
      memGb: Math.round(memTotal / 1024 / 1024),
      uptimeSec: num(s.UP?.[0]?.split(' ')[0]),
      gpus: parseGpus(s),
      runners: parseRunners(s),
      disks: parseDisks(s),
    };
  }

  const cores = num(s.NPROC?.[0]) ?? 1;
  const cpuSum = num(s.PSCPU?.[0]) ?? 0;
  const memTotal = num(s.MEMTOTAL?.[0]) ?? 0;
  // "used" as Activity Monitor counts it: active + wired + compressed
  const pageSize = num(s.VM?.[0]?.match(/page size of (\d+)/)?.[1]) ?? 16384;
  const pages = (label: string) => num(s.VM?.find((l) => l.startsWith(label))?.split(':')[1]?.replace('.', '').trim()) ?? 0;
  const used = (pages('Pages active') + pages('Pages wired down') + pages('Pages occupied by compressor')) * pageSize;
  const boot = num(s.BOOT?.[0]?.match(/sec = (\d+)/)?.[1]);
  return {
    cpu: Math.min(100, Math.round(cpuSum / cores)),
    mem: memTotal ? Math.round((100 * used) / memTotal) : null,
    cores,
    memGb: Math.round(memTotal / 1024 ** 3),
    uptimeSec: boot ? Math.round(Date.now() / 1000 - boot) : null,
    gpus: parseGpus(s),
    runners: parseRunners(s),
      disks: parseDisks(s),
  };
}
