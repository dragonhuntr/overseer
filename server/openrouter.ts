// OpenRouter credit balance. Key is pasted in the dashboard and stored on the hub (0600).
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const POLL_MS = 5 * 60_000;

import type { OpenRouterStatus } from './subscription-types';
export type { OpenRouterStatus };

export class OpenRouter {
  private key = '';
  private status: OpenRouterStatus = { connected: false };

  constructor(private file: string) {
    try { this.key = JSON.parse(readFileSync(file, 'utf8')).key ?? ''; } catch { /* none */ }
    if (process.env.OPENROUTER_API_KEY && !this.key) this.key = process.env.OPENROUTER_API_KEY;
    this.loop();
  }

  get(): OpenRouterStatus {
    return { ...this.status, connected: !!this.key };
  }

  async setKey(key: string) {
    const prev = this.key;
    this.key = key.trim();
    await this.poll();
    if (this.status.error) { this.key = prev; throw new Error(this.status.error); }
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ key: this.key }));
    chmodSync(this.file, 0o600);
  }

  clear() {
    this.key = '';
    this.status = { connected: false };
    writeFileSync(this.file, JSON.stringify({ key: '' }));
  }

  private async req(path: string) {
    const r = await fetch(`https://openrouter.ai/api/v1${path}`, {
      headers: { Authorization: `Bearer ${this.key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`OpenRouter ${path} → HTTP ${r.status}`);
    return ((await r.json()) as any).data;
  }

  private async poll() {
    if (!this.key) return;
    try {
      const key = await this.req('/key'); // works with any key
      let credits: any = null;
      try { credits = await this.req('/credits'); } catch { /* some keys can't read account credits */ }
      this.status = {
        connected: true,
        label: key?.label,
        keyLimit: key?.limit ?? null,
        keyUsage: key?.usage,
        totalCredits: credits?.total_credits,
        totalUsage: credits?.total_usage,
        fetchedAt: Date.now(),
      };
    } catch (e) {
      this.status = { ...this.status, connected: true, error: (e as Error).message };
    }
  }

  private async loop() {
    await this.poll();
    setTimeout(() => this.loop(), POLL_MS);
  }
}
