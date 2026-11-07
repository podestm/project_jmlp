#!/bin/bash
# =============================================================================
# Automatické nasazení větve dev na test preprodtest.jmlp.cz.
# Spouští jmlp-test-deploy.timer každých 5 minut jako uživatel podm12.
#
# Když je v origin/dev něco nového: fast-forward /opt/jmlp-test a přestaví
# jen to, čeho se změna týká (frontend / backend). Produkce se nikdy nemění.
# Pozastavení: touch /opt/jmlp-test/.deploy-paused   (zrušit: rm ...)
# =============================================================================
set -euo pipefail

REPO=/opt/jmlp-test
COMPOSE="docker compose -f $REPO/docker-compose.test.yml"
PAUSE_FLAG=$REPO/.deploy-paused
MIN_FREE_MB=900   # build frontendu bere hodně RAM; produkce má přednost

log() { echo "[$(date '+%F %T')] $*"; }

[[ -e "$PAUSE_FLAG" ]] && { log "Pozastaveno ($PAUSE_FLAG)."; exit 0; }

exec 9>/tmp/jmlp-test-deploy.lock
flock -n 9 || { log "Předchozí nasazení ještě běží."; exit 0; }

cd "$REPO"
git fetch -q origin dev
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse origin/dev)
[[ "$OLD" == "$NEW" ]] && exit 0

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    log "V $REPO jsou ruční změny, nenasazuji."; exit 1
fi

# Nasadit jen commit, na kterém na GitHubu prošlo CI (.github/workflows/ci.yml).
# Běží / ještě nezačalo -> zkusí se příště; spadlo -> nenasazuje se, dokud nepřijde
# opravený commit. Nouzové obejití: touch $REPO/.deploy-skip-ci (zrušit: rm ...).
CI_JOBS="frontend backend harness"
if [[ -e "$REPO/.deploy-skip-ci" ]]; then
    log "Kontrola CI vypnutá ($REPO/.deploy-skip-ci)."
else
    SLUG=$(git remote get-url origin | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
    CI=$(curl -fsSL --max-time 20 -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$SLUG/commits/$NEW/check-runs?per_page=100" \
      | python3 -c '
import json, sys
jobs = sys.argv[1].split()
runs = {r["name"]: r for r in json.load(sys.stdin).get("check_runs", [])}
if any(j not in runs or runs[j]["status"] != "completed" for j in jobs):
    print("pending")
elif all(runs[j]["conclusion"] == "success" for j in jobs):
    print("success")
else:
    print("failure:" + ",".join(j for j in jobs if runs[j]["conclusion"] != "success"))
' "$CI_JOBS" 2>/dev/null) || CI="unknown"
    case "$CI" in
        success) log "CI ${NEW:0:7}: prošlo." ;;
        pending) log "CI ${NEW:0:7}: ještě běží, zkusím příště."; exit 0 ;;
        failure*) log "CI ${NEW:0:7}: SELHALO (${CI#failure:}), nenasazuji."; exit 0 ;;
        *) log "CI ${NEW:0:7}: stav nelze zjistit (soukromé repo nebo výpadek GitHubu), nenasazuji."; exit 0 ;;
    esac
fi

FREE=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
if (( FREE < MIN_FREE_MB )); then
    log "Málo volné paměti ($FREE MB < $MIN_FREE_MB MB), zkusím příště."; exit 0
fi

CHANGED=$(git diff --name-only "$OLD" "$NEW")
git merge -q --ff-only origin/dev
log "dev ${OLD:0:7} -> ${NEW:0:7}"

SERVICES=()
grep -q '^frontend/' <<<"$CHANGED" && SERVICES+=(frontend)
grep -q '^backend/' <<<"$CHANGED" && SERVICES+=(backend)
grep -q '^docker-compose.test.yml$' <<<"$CHANGED" && SERVICES=(frontend backend db)

if (( ${#SERVICES[@]} == 0 )); then
    log "Bez změn v aplikaci, nic nepřestavuji."; exit 0
fi

log "Přestavuji: ${SERVICES[*]}"
nice -n 15 $COMPOSE build "${SERVICES[@]}"
$COMPOSE up -d "${SERVICES[@]}"
docker image prune -f >/dev/null
log "Hotovo, test běží na ${NEW:0:7}."
