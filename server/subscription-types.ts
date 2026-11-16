// Shared by the hub and the dashboard: no Node imports here.

export interface Limit {
  kind: string; // weekly_all | weekly_scoped | five_hour ...
  group: string;
  percent: number;
  severity: string;
  resetsAt: string | null;
  scope: string | null; // e.g. "Fable" for a model-scoped weekly limit
  active: boolean;
}

export interface ClaudeAccount {
  id: string;
  email: string;
  name: string;
  org: string;
  plan: string; // e.g. "Max 20x", "Pro", "Team"
  paused: boolean;
  usage?: {
    fiveHour: { percent: number; resetsAt: string | null } | null;
    week: { percent: number; resetsAt: string | null } | null;
    limits: Limit[];
    fetchedAt: number;
  };
  error?: string;
  addedAt: number;
}

export interface OpenRouterStatus {
  connected: boolean;
  label?: string;
  totalCredits?: number; // $ bought
  totalUsage?: number; // $ spent
  keyLimit?: number | null; // per-key cap, if any
  keyUsage?: number;
  fetchedAt?: number;
  error?: string;
}
