// Claude subscription usage (Pro / Max / Team) for accounts the hub logs into itself.
//
// Uses the same OAuth flow and usage endpoint as Claude Code's `/usage`. This is NOT a
// documented public API: it can change without notice. The hub keeps its own login per
// account (never Claude Code's), because refreshing a token invalidates the previous one.
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const AUTHORIZE_URL = 'https://claude.com/cai/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';
const API = 'https://api.anthropic.com';
const SCOPES = ['user:profile']; // read-only: enough for usage + plan, can't spend quota
const POLL_MS = 120_000;

import type { ClaudeAccount, Limit } from './subscription-types';
export type { ClaudeAccount, Limit };

interface Stored extends ClaudeAccount {
  access: string;
  refresh: string;
  expiresAt: number;
}

export class ClaudeAccounts {
  private accounts: Stored[] = [];
  private pending = new Map<string, { verifier: string; at: number }>();

  constructor(private file: string) {
    try { this.accounts = JSON.parse(readFileSync(file, 'utf8')); } catch { /* none yet */ }
    this.loop();
  }

  private save() {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.accounts, null, 1));
    chmodSync(this.file, 0o600); // holds refresh tokens
  }

  /** public view: never includes tokens */
  list(): ClaudeAccount[] {
    return this.accounts.map(({ access, refresh, expiresAt, ...pub }) => pub);
  }

  startLogin() {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(24).toString('base64url');
    const now = Date.now();
    for (const [k, v] of this.pending) if (now - v.at > 15 * 60_000) this.pending.delete(k);
    this.pending.set(state, { verifier, at: now });
    const u = new URL(AUTHORIZE_URL);
    u.searchParams.set('code', 'true');
    u.searchParams.set('client_id', CLIENT_ID);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', REDIRECT_URI);
    u.searchParams.set('scope', SCOPES.join(' '));
    u.searchParams.set('code_challenge', challenge);
    u.searchParams.set('code_challenge_method', 'S256');
    u.searchParams.set('state', state);
    return { url: u.toString() };
  }

  /** `pasted` is what the callback page shows: "<code>#<state>" */
  async completeLogin(pasted: string): Promise<ClaudeAccount> {
    const [code, state] = pasted.trim().split('#');
    const p = state && this.pending.get(state);
    if (!code || !p) throw new Error('That code does not match a login started here. Start again.');
    this.pending.delete(state);
    const tok = await tokenRequest({
      grant_type: 'authorization_code', code, state, client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI, code_verifier: p.verifier,
    });
    const acc: Stored = {
      id: '', email: '', name: '', org: '', plan: '', paused: false, addedAt: Date.now(),
      access: tok.access_token, refresh: tok.refresh_token, expiresAt: Date.now() + tok.expires_in * 1000,
    };
    await this.loadProfile(acc);
    const existing = this.accounts.findIndex((a) => a.id === acc.id);
    if (existing >= 0) this.accounts[existing] = { ...this.accounts[existing], ...acc, paused: this.accounts[existing].paused };
    else this.accounts.push(acc);
    await this.poll(acc).catch(() => {});
    this.save();
    const { access, refresh, expiresAt, ...pub } = acc;
    return pub;
  }

  setPaused(id: string, paused: boolean) {
    const a = this.accounts.find((x) => x.id === id);
    if (!a) return false;
    a.paused = paused;
    this.save();
    return true;
  }

  remove(id: string) {
    const n = this.accounts.length;
    this.accounts = this.accounts.filter((a) => a.id !== id);
    if (this.accounts.length !== n) this.save();
    return this.accounts.length !== n;
  }

  move(id: string, dir: -1 | 1) {
    const i = this.accounts.findIndex((a) => a.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.accounts.length) return false;
    [this.accounts[i], this.accounts[j]] = [this.accounts[j], this.accounts[i]];
    this.save();
    return true;
  }

  private async ensureFresh(a: Stored) {
    if (Date.now() < a.expiresAt - 5 * 60_000) return;
    const tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: a.refresh, client_id: CLIENT_ID, scope: SCOPES.join(' ') });
    a.access = tok.access_token;
    if (tok.refresh_token) a.refresh = tok.refresh_token; // rotates: persist immediately
    a.expiresAt = Date.now() + tok.expires_in * 1000;
    this.save();
  }

  private async api(a: Stored, path: string) {
    await this.ensureFresh(a);
    const r = await fetch(API + path, {
      headers: { Authorization: `Bearer ${a.access}`, 'anthropic-beta': 'oauth-2025-04-20', 'User-Agent': 'overseer' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
    return r.json() as Promise<any>;
  }

  private async loadProfile(a: Stored) {
    const p = await this.api(a, '/api/oauth/profile');
    a.id = p.account?.uuid ?? a.id;
    a.email = p.account?.email ?? '';
    a.name = p.account?.display_name || p.account?.full_name || a.email;
    a.org = p.organization?.name ?? '';
    a.plan = planLabel(p.organization ?? {}, p.account ?? {});
  }

  private async poll(a: Stored) {
    try {
      const u = await this.api(a, '/api/oauth/usage');
      const win = (w: any) => (w ? { percent: Math.round(w.utilization ?? 0), resetsAt: w.resets_at ?? null } : null);
      a.usage = {
        fiveHour: win(u.five_hour),
        week: win(u.seven_day),
        limits: (u.limits ?? []).map((l: any): Limit => ({
          kind: l.kind, group: l.group, percent: Math.round(l.percent ?? 0), severity: l.severity ?? 'normal',
          resetsAt: l.resets_at ?? null, active: !!l.is_active,
          scope: l.scope?.model?.display_name ?? l.scope?.surface ?? null,
        })),
        fetchedAt: Date.now(),
      };
      a.error = undefined;
    } catch (e) {
      a.error = (e as Error).message;
    }
  }

  private async loop() {
    for (const a of this.accounts) if (!a.paused) await this.poll(a);
    if (this.accounts.length) this.save();
    setTimeout(() => this.loop(), POLL_MS);
  }
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'overseer' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`login failed (HTTP ${r.status}): ${text.slice(0, 200)}`);
  return JSON.parse(text) as { access_token: string; refresh_token: string; expires_in: number };
}

function planLabel(org: any, account: any): string {
  const tier: string = org.rate_limit_tier ?? '';
  const type: string = org.organization_type ?? '';
  if (/max_20x/.test(tier)) return 'Max 20x';
  if (/max_5x/.test(tier)) return 'Max 5x';
  if (type.includes('team')) return org.seat_tier === 'premium' ? 'Team Premium' : 'Team';
  if (type.includes('enterprise')) return 'Enterprise';
  if (account.has_claude_max) return 'Max';
  if (account.has_claude_pro || type.includes('pro')) return 'Pro';
  return org.plan_display_name || type || 'Claude';
}
