#!/bin/sh
# Install the overseer agent as a service: launchd on macOS, systemd on Linux.
#   sh install.sh <hub-url> <token> <id> <name> [place] [group]
set -eu
HUB=$1 TOKEN=$2 ID=$3 NAME=$4 PLACE=${5:-Tailnet} GROUP=${6:-tailnet}
SRC=$(cd "$(dirname "$0")" && pwd)
DEST="$HOME/.overseer-agent"
mkdir -p "$DEST"
cp "$SRC/agent.sh" "$SRC/collect.sh" "$DEST/"
umask 077
cat > "$DEST/env" <<ENV
OVERSEER_HUB=$HUB
OVERSEER_TOKEN=$TOKEN
OVERSEER_ID=$ID
OVERSEER_NAME="$NAME"
OVERSEER_PLACE="$PLACE"
OVERSEER_GROUP=$GROUP
ENV
umask 022
# wrapper loads env so the service definitions stay token-free
cat > "$DEST/run.sh" <<'RUN'
#!/bin/sh
set -a; . "$(dirname "$0")/env"; set +a
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
exec sh "$(dirname "$0")/agent.sh"
RUN
chmod +x "$DEST"/*.sh

if [ "$(uname -s)" = Darwin ]; then
  PLIST="$HOME/Library/LaunchAgents/sh.overseer.agent.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>sh.overseer.agent</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>$DEST/run.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DEST/agent.log</string>
  <key>StandardErrorPath</key><string>$DEST/agent.log</string>
</dict></plist>
PL
  launchctl bootout "gui/$(id -u)/sh.overseer.agent" 2>/dev/null || true
  # bootout is async; bootstrap fails with "Input/output error" if the old job is still around
  i=0; while launchctl print "gui/$(id -u)/sh.overseer.agent" >/dev/null 2>&1 && [ $i -lt 50 ]; do sleep 0.1; i=$((i+1)); done
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "launchd agent sh.overseer.agent installed"
else
  # systemd: system unit when passwordless sudo exists, otherwise a user unit + linger
  # (linger keeps user services running at boot without a login session)
  if sudo -n true 2>/dev/null; then
    UNIT_DIR=/etc/systemd/system SCTL="sudo systemctl" RUNAS="User=$(id -un)" TARGET=multi-user.target WRITE="sudo tee"
  else
    UNIT_DIR="$HOME/.config/systemd/user" SCTL="systemctl --user" RUNAS="" TARGET=default.target WRITE="tee"
    mkdir -p "$UNIT_DIR"
    loginctl enable-linger "$(id -un)" 2>/dev/null || echo "warning: could not enable linger; agent stops when you log out"
  fi
  $WRITE "$UNIT_DIR/overseer-agent.service" >/dev/null <<SD
[Unit]
Description=overseer metrics agent
After=network-online.target

[Service]
$RUNAS
ExecStart=/bin/sh $DEST/run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=$TARGET
SD
  $SCTL daemon-reload
  $SCTL enable overseer-agent
  $SCTL restart overseer-agent
  echo "systemd unit overseer-agent installed ($SCTL)"
fi
