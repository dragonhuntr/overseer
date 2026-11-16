# overseer

A small self-hosted dashboard for the machines you run: CPU, memory and disk on each one, NVIDIA GPUs, GitHub Actions
self-hosted runners, and how much of your Claude and OpenRouter usage is left.

Made for a homelab on a private network such as a [Tailscale](https://tailscale.com) tailnet. Nothing to install on the
machines but a POSIX shell script.

## How it works

```
 agents (sh + curl)  ──push every 3s──▶  hub (Bun, :7420)  ◀──poll──  dashboard (React, served by the hub)
 pull hosts (ssh)    ◀──────pull───────
```

- **Agents** (`agent/`) run on each machine. Every 3 seconds `collect.sh` prints raw stats from standard OS tools
  (`/proc` on Linux, `sysctl`/`vm_stat` on macOS, `df`, and `nvidia-smi` if it is there) and `agent.sh` POSTs them to the
  hub with a bearer token.
- **The hub** (`server/`) parses the stats, keeps a short CPU history, marks a machine offline after 15 seconds without a
  push, reports on itself, and serves the dashboard and its API.
- **The dashboard** (`src/`) groups machines by the group each agent reports, draws the hub between the first two
  groups, and lists GPUs, runners and subscriptions below.

## Requirements

- [Bun](https://bun.sh) 1.1+ on the hub and wherever you build.
- Agents: `sh`, `curl`, `awk`. Linux (systemd) or macOS (launchd).
- `scripts/install-hub.sh` sets the hub up as a launchd service, so as written the hub runs on **macOS**. On Linux, run
  `bun server/index.ts` under systemd or any process manager, with the variables from `.env.example`.

## Quick start

```sh
bun install
bun run build                       # builds the dashboard into dist/
cp .env.example .env                # set OVERSEER_TOKEN to a long random string
set -a; . ./.env; set +a
bun run hub                         # http://localhost:7420
```

The hub reports on itself at once. To work on the dashboard, run `bun run dev` beside it; it proxies `/api` to
`http://localhost:7420`, or to another hub with `HUB=http://host:7420 bun run dev`.

### Run the hub as a service (macOS)

On the hub machine, from a copy of this repo:

```sh
bun install && bun run build
sh scripts/install-hub.sh           # writes .env with a random token on first run, then starts launchd's sh.overseer.hub
```

`HUB_ID`, `HUB_NAME`, `HUB_GROUP` and `HUB_PLACE` set how the hub lists itself (defaults: its hostname, "tailnet").

To build here and deploy to a hub over ssh: `bun run deploy <ssh-host>` (or set `OVERSEER_HUB_HOST`). It rsyncs the repo
to `~/overseer` there, leaving its `.env`, `data/` and `pull.json` alone, and reinstalls the service.

### Add a machine

Copy `agent/` to the machine and run:

```sh
sh agent/install.sh <hub-url> <token> <id> <name> [place] [group]
# e.g.
sh agent/install.sh http://hub.tailnet-name.ts.net:7420 "$OVERSEER_TOKEN" gpu-box "GPU box" "Home" tailnet
```

It installs to `~/.overseer-agent` (the token is kept in a `0600` env file there) and starts a launchd agent on macOS or a
systemd unit on Linux (a system unit with passwordless sudo, otherwise a user unit with lingering).

`group` decides where the machine is shown. `tailnet`, `ovh` and `gcloud` get their own names and glyphs; any other id is
shown as written.

### Machines that can't reach the hub

For a machine that can't push (a device shared into your tailnet, say), the hub can pull over ssh instead. Copy
`pull.example.json` to `pull.json` on the hub and list the hosts. The hub runs `ssh <ssh> collect` every 3 seconds, so
give the hub's key a forced command on the target, in its `~/.ssh/authorized_keys`:

```
command="sh ~/collect.sh",no-port-forwarding,no-pty ssh-ed25519 AAAA... overseer-pull
```

## Subscriptions

**OpenRouter:** paste an API key in the dashboard to see credits used and left. The key is stored in `data/` on the hub.

**Claude (unofficial):** "Connect account" logs the hub into a Claude Pro, Max or Team account to show its 5-hour and
weekly limits. **This uses the same OAuth client and the same undocumented usage endpoint as Claude Code's `/usage`
command. It is not a public API, it is not supported by Anthropic, and it can change or stop working at any time.** The
hub asks for the `user:profile` scope only, so it can read usage but not spend it, and keeps its own login per account
(refresh tokens in `data/claude-accounts.json`, mode `0600`). Use it at your own risk; if you'd rather not, just don't
connect an account.

## Security

- **The dashboard and its API have no login.** Anyone who can reach the hub's port can see your machines and the email
  addresses of connected Claude accounts, and can connect, pause or remove accounts and change the OpenRouter key. Keep
  the hub on a private network (a tailnet, a LAN, a VPN). Don't expose port 7420 to the internet.
- Only `/api/push` needs the token. If agents push through a Cloudflare Tunnel, the hub refuses every other path on
  requests that came through it (those with a `cf-connecting-ip` header).
- The POST endpoints accept `application/json` only, so a page on another site can't call them from a browser without a
  CORS preflight, which the hub never approves.
- Secrets live in `.env` and `data/` on the hub. Both are in `.gitignore` and are never deployed.

## Layout

| Path | What |
| --- | --- |
| `agent/` | `collect.sh` (prints stats), `agent.sh` (push loop), `install.sh` (service install) |
| `server/` | the hub: `index.ts` (HTTP, push, pull), `parse.ts` (stats parsing), `claude.ts`, `openrouter.ts` |
| `src/` | the dashboard (React 19, Tailwind v4) |
| `src/kit/` | the dashboard's small component kit: buttons, badges, dialog, tooltip, switch, tokens and control styles |
| `scripts/` | `install-hub.sh` (launchd service on the hub), `deploy-hub.sh` (build + rsync + install) |

## Credits

Controls are from [UI SDK](https://www.npmjs.com/package/@ui-sdk/react); icons from [Lucide](https://lucide.dev); type is
[Geist](https://vercel.com/font). Parts of `src/kit/` are adapted from [opendesk](https://github.com/useopendesk/opendesk)
(Apache License 2.0): see `src/kit/NOTICE`.

## License

MIT (see `LICENSE`). The opendesk-derived parts of `src/kit/` remain under Apache-2.0 (`src/kit/NOTICE`).
