#!/usr/bin/env bash
# Capacity test: how many live-timing viewers and registrations per second the app sustains.
#
#   harness/load/run.sh [live|registration|all]     (default: all)
#
# Starts a disposable copy of the production stack (docker-compose.load.yml, synthetic data),
# raises the load step by step and stops at the first step that misses the target:
#   live:          p95 <= 1000 ms, errors < 1 %   (1 req/s = 5 viewers polling every 5 s)
#   registration:  p95 <= 2000 ms, errors < 1 %
# A watchdog polls production health the whole time and aborts the test if production slows down.
# Results: .harness/state/load/<timestamp>/ (results.jsonl, summary.md). Everything is removed at the end.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../lib/common.sh"
cd "$ROOT" || exit 1

MODE="${1:-all}"
PROJECT=jmlp-harness-load
COMPOSE=(docker compose -p "$PROJECT" -f harness/load/docker-compose.load.yml)
NET="${PROJECT}_default"
K6_IMAGE=grafana/k6:0.54.0
PROD_HEALTH="${PROD_HEALTH:-http://127.0.0.1:8080/health}"   # production frontend on this host
PROD_MAX_S="${PROD_MAX_S:-1.5}"                               # watchdog limit for one health check
read -ra LIVE_STEPS <<< "${LIVE_STEPS:-20 40 80 120 160 200 260 320 400 500 650 800}"   # requests per second
read -ra REG_STEPS <<< "${REG_STEPS:-1 2 4 8 12 16 24 32}"                               # registrations per second
OUT=".harness/state/load/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
ABORT="$OUT/ABORTED"

log() { printf '[load %s] %s\n' "$(date +%T)" "$*" | tee -a "$OUT/run.log" >&2; }

cleanup() {
  [ -n "${WATCHDOG:-}" ] && kill "$WATCHDOG" 2>/dev/null
  docker rm -f jmlp-harness-load-k6 >/dev/null 2>&1
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1
  log "load stack removed"
}
trap cleanup EXIT

# --- production watchdog -------------------------------------------------------------------------
curl -fsS -o /dev/null --max-time 5 "$PROD_HEALTH" || { log "production health check fails before the test, not starting"; exit 1; }
(
  slow=0
  while :; do
    t=$(curl -fsS -o /dev/null -w '%{time_total}' --max-time 5 "$PROD_HEALTH" 2>/dev/null || echo 99)
    if awk "BEGIN{exit !($t > $PROD_MAX_S)}"; then slow=$((slow + 1)); else slow=0; fi
    if [ "$slow" -ge 2 ]; then
      echo "production health ${t}s > ${PROD_MAX_S}s twice in a row" > "$ABORT"
      docker kill jmlp-harness-load-k6 >/dev/null 2>&1
      exit 0
    fi
    sleep 2
  done
) &
WATCHDOG=$!

# --- stack --------------------------------------------------------------------------------------
log "building and starting the load stack (synthetic data)"
"${COMPOSE[@]}" build -q backend frontend || exit 1
"${COMPOSE[@]}" up -d db >/dev/null || exit 1
SEED=$("${COMPOSE[@]}" run --rm -T backend python seed.py 2>>"$OUT/run.log" | tail -1)
echo "$SEED" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null || { log "seeding failed (see run.log)"; exit 1; }
log "seeded: $SEED"
RACE_ID=$(echo "$SEED" | python3 -c 'import json,sys; print(json.load(sys.stdin)["open_race_id"])')
"${COMPOSE[@]}" up -d backend frontend >/dev/null || exit 1
for _ in $(seq 1 60); do
  docker run --rm --network "$NET" curlimages/curl:8.10.1 -fsS -o /dev/null --max-time 3 http://frontend/races/live 2>/dev/null && break
  sleep 2
done

k6() { # k6 <script> <env...>
  local script=$1; shift
  docker run --rm --name jmlp-harness-load-k6 --network "$NET" --memory 256m --cpus 0.75 \
    -v "$ROOT/harness/load:/scripts:ro" "${@/#/-e}" "$K6_IMAGE" run --quiet --no-color /scripts/"$script" 2>>"$OUT/run.log" | tail -1
}
sample_cpu() { # background: CPU % of the load backend and production backend every ~3 s
  while :; do
    docker stats --no-stream --format '{{.Name}} {{.CPUPerc}}' \
      | awk '/harness-load-backend/{gsub("%","",$2); l=$2} /^jmlp-backend /{gsub("%","",$2); p=$2} END{print l+0, p+0}'
  done
}

pass() { # pass <json> <max_p95_ms>
  python3 - "$1" "$2" <<'EOF'
import json, sys
r = json.loads(sys.argv[1]); limit = int(sys.argv[2])
target = r.get("target_rps") or r.get("target_per_s")
ok = r["p95_ms"] <= limit and r["error_rate"] < 0.01 and r.get("dropped", 0) <= max(1, target)
sys.exit(0 if ok else 1)
EOF
}

# --- capacity search ----------------------------------------------------------------------------
search() { # search <name> <script> <p95 limit> <steps...>
  local name=$1 script=$2 limit=$3; shift 3
  local best="" step=0
  for rate in "$@"; do
    [ -e "$ABORT" ] && break
    step=$((step + 1))
    local res cpu_log="$OUT/cpu-$name-$rate.txt"
    sample_cpu > "$cpu_log" & local sampler=$!
    if [ "$name" = live ]; then
      res=$(k6 "$script" RATE="$rate" DURATION=45s)
    else
      res=$(k6 "$script" RATE="$rate" DURATION=20s RACE_ID="$RACE_ID" STEP="$step")
    fi
    kill "$sampler" 2>/dev/null; wait "$sampler" 2>/dev/null
    local cpu prod_cpu
    cpu=$(awk 'BEGIN{m=0} $1>m{m=$1} END{print m}' "$cpu_log")
    prod_cpu=$(awk 'BEGIN{m=0} $2>m{m=$2} END{print m}' "$cpu_log")
    [ -e "$ABORT" ] && { log "ABORTED by watchdog: $(cat "$ABORT")"; break; }
    if ! echo "$res" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; then
      log "$name step $rate: no result (see run.log)"; break
    fi
    res=$(echo "$res" | python3 -c "import json,sys; d=json.load(sys.stdin); d['backend_cpu_pct']=$cpu; d['prod_backend_cpu_pct']=$prod_cpu; print(json.dumps(d))")
    echo "$res" >> "$OUT/results.jsonl"
    if pass "$res" "$limit"; then
      best="$rate"; log "$name $rate/s: OK   $res"
    else
      log "$name $rate/s: MISS $res"; break
    fi
  done
  echo "$best"
}

LIVE_MAX="" REG_MAX=""
if [ "$MODE" = live ] || [ "$MODE" = all ]; then
  LIVE_MAX=$(search live live.js 1000 "${LIVE_STEPS[@]}")
fi
if { [ "$MODE" = registration ] || [ "$MODE" = all ]; } && [ ! -e "$ABORT" ]; then
  REG_MAX=$(search registration registration.js 2000 "${REG_STEPS[@]}")
  # Integrity: every registration stored once, none lost or duplicated.
  DUPES=$("${COMPOSE[@]}" exec -T db mysql -uapp -papp jmlpcz_load -N -e \
    "SELECT COUNT(*) FROM (SELECT racer_id FROM fuj_jmlp_race_registration WHERE race_id=$RACE_ID GROUP BY racer_id HAVING COUNT(*)>1) d" 2>/dev/null)
  STORED=$("${COMPOSE[@]}" exec -T db mysql -uapp -papp jmlpcz_load -N -e \
    "SELECT COUNT(*) FROM fuj_jmlp_race_registration WHERE race_id=$RACE_ID" 2>/dev/null)
  log "registrations stored: $STORED, duplicated racers: $DUPES"
fi

{
  echo "# Load test $(date -Is)"
  echo
  echo "- Commit: $(git rev-parse --short HEAD); host: $(nproc) CPU, $(free -m | awk '/Mem:/{print $2}') MB RAM (shared with production)"
  [ -e "$ABORT" ] && echo "- **Aborted by the production watchdog:** $(cat "$ABORT")"
  [ "$LIVE_MAX" = "${LIVE_STEPS[-1]}" ] && LIVE_MAX="at least $LIVE_MAX"   # top step passed: limit not reached
  [ "${REG_MAX:-}" = "${REG_STEPS[-1]}" ] && REG_MAX="at least $REG_MAX"
  [ -n "$LIVE_MAX" ] && echo "- Live timing: sustained **${LIVE_MAX} req/s ≈ $(( ${LIVE_MAX##* } * 5 )) viewers** (p95 ≤ 1 s, errors < 1 %)"
  [ -z "$LIVE_MAX" ] && [ "$MODE" != registration ] && echo "- Live timing: no step passed"
  [ -n "$REG_MAX" ] && echo "- Registrations: sustained **${REG_MAX}/s** (p95 ≤ 2 s, errors < 1 %); stored ${STORED:-?}, duplicates ${DUPES:-?}"
  echo
  echo "| scenario | load | achieved | p95 ms | p99 ms | errors | load backend CPU % (max) | prod backend CPU % (max) |"
  echo "|---|---|---|---|---|---|---|---|"
  python3 - "$OUT/results.jsonl" <<'EOF'
import json, sys
for line in open(sys.argv[1]):
    r = json.loads(line)
    load = f"{r['target_rps']} req/s ({r['viewers']} viewers)" if r["scenario"] == "live" else f"{r['target_per_s']} reg/s"
    achieved = r.get("achieved_rps", r.get("attempted"))
    print(f"| {r['scenario']} | {load} | {achieved} | {r['p95_ms']} | {r['p99_ms']} | {r['error_rate']:.2%} | {r['backend_cpu_pct']} | {r['prod_backend_cpu_pct']} |")
EOF
} > "$OUT/summary.md" 2>/dev/null
cat "$OUT/summary.md"
