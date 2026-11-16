// Machine groups, built from what agents report (OVERSEER_GROUP), and the placeholder hub shown until the hub answers.

/** Groups with their own glyph; any other group id gets a generic server glyph. */
export type ProviderId = 'tailnet' | 'ovh' | 'gcloud' | 'server';
export type Status = 'up' | 'asleep' | 'down';
export type { Disk, Gpu, LiveMachine, Runner } from '../server/parse';
import type { Disk, Gpu, Runner } from '../server/parse';

export interface Machine {
  id: string;
  name: string;
  status: Status;
  cpu: number | null;
  mem: number | null;
  cores: number;
  memGb: number;
  latencyMs?: number;
  /** subtitle on the card, e.g. "Tailnet" or "Singapore" */
  place?: string;
  gpus?: Gpu[];
  runners?: Runner[];
  disks?: Disk[];
  uptimeSec?: number | null;
  /** placeholder, not a real machine */
  demo?: boolean;
  hub?: boolean;
}

export interface Group {
  id: string;
  name: string;
  provider: ProviderId;
  label: string; // topology header label
  machines: Machine[];
}

/** Display names for well-known group ids. Unknown ids are shown as written. */
const KNOWN: Record<string, { name: string; provider: ProviderId }> = {
  tailnet: { name: 'Tailnet', provider: 'tailnet' },
  ovh: { name: 'OVHcloud', provider: 'ovh' },
  gcloud: { name: 'Google Cloud', provider: 'gcloud' },
};

export function groupFor(id: string): Omit<Group, 'machines'> {
  const known = KNOWN[id];
  const name = known?.name ?? id;
  return { id, name, label: name, provider: known?.provider ?? 'server' };
}

/** Placeholder hub shown until the real hub answers (e.g. `bun run dev` with no hub running). */
export const hub = {
  name: 'overseer',
  provider: 'server' as ProviderId,
  place: 'Waiting for the hub…',
  cores: 0,
  memGb: 0,
  memUsedGb: 0,
  cpu: 0,
};
