#!/bin/sh
# Prints raw machine stats in ##SECTION blocks. The hub parses them (server/parse.ts).
# Needs only POSIX sh + standard OS tools. nvidia-smi is optional.
OS=$(uname -s | tr 'A-Z' 'a-z')
echo '##META'
echo "id=${OVERSEER_ID:-$(hostname -s)}"
echo "name=${OVERSEER_NAME:-$(hostname -s)}"
echo "group=${OVERSEER_GROUP:-tailnet}"
echo "place=${OVERSEER_PLACE:-Tailnet}"
echo "os=$OS"
echo "hub=${OVERSEER_HUB:-0}"
echo "rtt_ms=${OVERSEER_RTT_MS:-}"
if [ "$OS" = linux ]; then
  echo '##STAT'; head -1 /proc/stat
  echo '##MEM'; grep -E '^(MemTotal|MemAvailable):' /proc/meminfo
  echo '##NPROC'; nproc
  echo '##UP'; cat /proc/uptime
else
  echo '##PSCPU'; ps -A -o %cpu= | awk '{s+=$1} END {print s}'
  echo '##NPROC'; sysctl -n hw.ncpu
  echo '##MEMTOTAL'; sysctl -n hw.memsize
  echo '##VM'; vm_stat
  echo '##BOOT'; sysctl -n kern.boottime
fi
if command -v nvidia-smi >/dev/null 2>&1; then
  echo '##GPU'; nvidia-smi --query-gpu=index,uuid,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit,fan.speed --format=csv,noheader,nounits 2>/dev/null
  echo '##APPS'; nvidia-smi --query-compute-apps=gpu_uuid,pid,process_name,used_memory --format=csv,noheader,nounits 2>/dev/null
fi
# Disks: mount|sizeKB|usedKB|availKB  (skips pseudo filesystems, boot partitions, volumes < 1 GB)
echo '##DISK'
if [ "$OS" = linux ]; then
  df -kPT -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null |
    awk 'NR>1 && $3 >= 1048576 && $7 !~ /^\/(boot|snap)(\/|$)/ && !seen[$1]++ { m=$7; for (i=8;i<=NF;i++) m=m" "$i; print m"|"$3"|"$4"|"$5 }'
else
  # APFS: real usage lives on the Data volume; size-avail matches what Finder shows
  df -kP 2>/dev/null |
    awk 'NR>1 && $2 >= 1048576 { m=$6; for (i=7;i<=NF;i++) m=m" "$i; if (m=="/System/Volumes/Data" || (m ~ /^\/Volumes\// && m !~ /\.timemachine/)) print m"|"$2"|"$2-$4"|"$4 }'
fi
# GitHub Actions self-hosted runners: name|repo|listener-up|last status line|last finished line
echo '##RUNNERS'
for d in "$HOME"/actions-runner*; do
  [ -f "$d/.runner" ] || continue
  name=$(sed -n 's/.*"agentName": *"\([^"]*\)".*/\1/p' "$d/.runner")
  repo=$(sed -n 's#.*"gitHubUrl": *"https://github.com/\([^"]*\)".*#\1#p' "$d/.runner")
  pgrep -f "$d/bin/Runner.Listener" >/dev/null 2>&1 && on=1 || on=0
  log=$(ls "$HOME"/Library/Logs/actions.runner.*."$name"/stdout.log 2>/dev/null | head -1)
  [ -n "$log" ] || log=$(ls -t "$d"/_diag/Runner_*.log 2>/dev/null | head -1)
  last=$(grep -E 'Running job:|completed with result:|Listening for Jobs' "$log" 2>/dev/null | tail -1)
  done_=$(grep -E 'completed with result:' "$log" 2>/dev/null | tail -1)
  echo "$name|$repo|$on|$last|$done_"
done
exit 0
