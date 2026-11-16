#!/bin/sh
# Pushes stats to the hub every $OVERSEER_INTERVAL seconds.
# env: OVERSEER_HUB (http://host:7420), OVERSEER_TOKEN, OVERSEER_ID/NAME/GROUP/PLACE
DIR=$(cd "$(dirname "$0")" && pwd)
: "${OVERSEER_HUB:?set OVERSEER_HUB}" "${OVERSEER_TOKEN:?set OVERSEER_TOKEN}"
INTERVAL=${OVERSEER_INTERVAL:-3}
export OVERSEER_RTT_MS=
while :; do
  # TCP connect time of the previous push ~ one network round trip to the hub
  t=$(sh "$DIR/collect.sh" | curl -sS -m 5 -o /dev/null -w '%{time_connect}' \
        -H "Authorization: Bearer $OVERSEER_TOKEN" -H 'Content-Type: text/plain' \
        --data-binary @- "$OVERSEER_HUB/api/push") \
    && OVERSEER_RTT_MS=$(awk -v t="$t" 'BEGIN{printf "%d", t*1000}') \
    || OVERSEER_RTT_MS=
  export OVERSEER_RTT_MS
  sleep "$INTERVAL"
done
