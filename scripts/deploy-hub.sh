#!/bin/sh
# Build the dashboard and (re)deploy the hub to a macOS machine over ssh.
#   sh scripts/deploy-hub.sh <ssh-host>     (or set OVERSEER_HUB_HOST)
set -eu
HOST=${1:-${OVERSEER_HUB_HOST:-}}
[ -n "$HOST" ] || { echo "usage: sh scripts/deploy-hub.sh <ssh-host>" >&2; exit 1; }
cd "$(dirname "$0")/.."
bun run build
rsync -az --delete --exclude node_modules --exclude data --exclude .env --exclude hub.log --exclude pull.json --exclude .git ./ "$HOST:overseer/"
ssh "$HOST" 'export PATH=$HOME/.bun/bin:/opt/homebrew/bin:$PATH; sh overseer/scripts/install-hub.sh'
