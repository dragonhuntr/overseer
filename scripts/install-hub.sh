#!/bin/sh
# Runs ON the hub machine (macOS): installs the hub as a launchd service.
set -eu
DIR=$(cd "$(dirname "$0")/.." && pwd)
BUN=$(command -v bun || echo "$HOME/.bun/bin/bun")
ENVF="$DIR/.env"
if [ ! -f "$ENVF" ]; then
  umask 077
  cat > "$ENVF" <<ENV
PORT=7420
OVERSEER_TOKEN=$(openssl rand -hex 24)
HUB_ID=${HUB_ID:-$(hostname -s | tr -c 'A-Za-z0-9._\n-' '-')}
HUB_NAME="${HUB_NAME:-$(scutil --get ComputerName 2>/dev/null || hostname -s)}"
HUB_GROUP=${HUB_GROUP:-tailnet}
HUB_PLACE="${HUB_PLACE:-Tailnet}"
ENV
  umask 022
fi
cat > "$DIR/scripts/run-hub.sh" <<RUN
#!/bin/sh
set -a; . "$ENVF"; set +a
cd "$DIR"
exec "$BUN" server/index.ts
RUN
chmod +x "$DIR/scripts/run-hub.sh"
PLIST="$HOME/Library/LaunchAgents/sh.overseer.hub.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>sh.overseer.hub</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>$DIR/scripts/run-hub.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/hub.log</string>
  <key>StandardErrorPath</key><string>$DIR/hub.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/sh.overseer.hub" 2>/dev/null || true
i=0; while launchctl print "gui/$(id -u)/sh.overseer.hub" >/dev/null 2>&1 && [ $i -lt 50 ]; do sleep 0.1; i=$((i+1)); done  # bootout is async
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "hub running: launchd sh.overseer.hub on :$(grep ^PORT= "$ENVF" | cut -d= -f2)"
