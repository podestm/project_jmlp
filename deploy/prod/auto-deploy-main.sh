#!/bin/bash
# =============================================================================
# Automatické nasazení větve main na produkci jmlp.cz.
# Spouští jmlp-prod-deploy.timer každých 5 minut (návod: deploy/prod/README.md).
#
# Nový commit v origin/main se nasadí, jen když:
#   - na něm na GitHubu prošlo CI (frontend, backend, harness),
#   - není víkend (závody; obejití: touch $REPO/.deploy-allow-weekend),
#   - nejde o commit, který už jednou selhal ($STATE/failed),
#   - je dost volné paměti.
# Před nasazením: záloha DB a označení běžících image (pred-<commit>).
# Po nasazení: kontrola zdraví; když web do 3 minut neodpovídá, vrátí předchozí
# image i kód a commit si zapamatuje jako selhaný. DB se nevrací (migrace) -
# k ruční obnově je záloha z kroku před nasazením.
#
# Pozastavení: touch $REPO/.deploy-paused   (zrušit: rm ...)
# =============================================================================
set -euo pipefail

REPO=${REPO:-/opt/jmlp}
COMPOSE="docker compose -f $REPO/docker-compose.server.yml"
PROJECT=jmlp                       # compose projekt -> image jmlp-backend, jmlp-frontend
DB_CONTAINER=jmlp-db
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:8080/health}
STATE=${STATE:-/var/lib/jmlp-deploy}
BACKUPS=$STATE/backups
KEEP_BACKUPS=10
MIN_FREE_MB=900
HEALTH_TRIES=${HEALTH_TRIES:-18}  # x HEALTH_WAIT s
HEALTH_WAIT=${HEALTH_WAIT:-10}

log() { echo "[$(date '+%F %T')] $*"; }
notify() {  # Discord, pokud je v prostředí DISCORD_WEBHOOK_URL (EnvironmentFile služby)
    [[ -n "${DISCORD_WEBHOOK_URL:-}" ]] || return 0
    curl -fsS -o /dev/null --max-time 15 -H "Content-Type: application/json" \
        -d "$(python3 -c 'import json,sys;print(json.dumps({"content":sys.argv[1]}))' "$1")" \
        "$DISCORD_WEBHOOK_URL" || true
}

[[ -e "$REPO/.deploy-paused" ]] && { log "Pozastaveno ($REPO/.deploy-paused)."; exit 0; }
exec 9>/tmp/jmlp-prod-deploy.lock
flock -n 9 || { log "Předchozí nasazení ještě běží."; exit 0; }
mkdir -p "$BACKUPS"

cd "$REPO"
git fetch -q origin main
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse origin/main)
[[ "$OLD" == "$NEW" ]] && exit 0
[[ -f "$STATE/failed" && "$(cat "$STATE/failed")" == "$NEW" ]] && exit 0

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    log "V $REPO jsou ruční změny, nenasazuji."; exit 1
fi
if ! git merge-base --is-ancestor "$OLD" "$NEW"; then
    log "origin/main ${NEW:0:7} nenavazuje na ${OLD:0:7} (přepsaná historie?), nenasazuji."; exit 1
fi

if [[ $(date +%u) -ge 6 && ! -e "$REPO/.deploy-allow-weekend" ]]; then
    log "Víkend - produkci nenasazuji (obejití: $REPO/.deploy-allow-weekend)."; exit 0
fi

# Ze složky skriptu, ne z $REPO: první nasazení běží ze starého checkoutu, který ji ještě nemá.
source "$(dirname "$(readlink -f "$0")")/../lib/ci-gate.sh"
CI=$(ci_status "$REPO" "$NEW")
case "$CI" in
    success) log "CI ${NEW:0:7}: prošlo." ;;
    pending) log "CI ${NEW:0:7}: ještě běží, zkusím příště."; exit 0 ;;
    failure*) log "CI ${NEW:0:7}: SELHALO (${CI#failure:}), nenasazuji."; exit 0 ;;
    *) log "CI ${NEW:0:7}: stav nelze zjistit (výpadek GitHubu?), nenasazuji."; exit 0 ;;
esac

FREE=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
(( FREE >= MIN_FREE_MB )) || { log "Málo volné paměti ($FREE MB), zkusím příště."; exit 0; }

log "Nasazuji ${OLD:0:7} -> ${NEW:0:7}"

# 1. Záloha databáze (jen pro ruční obnovu; dokumenty se nasazením nemění).
DUMP="$BACKUPS/predeploy_$(date +%Y%m%d_%H%M%S)_${OLD:0:7}.sql.gz"
docker exec "$DB_CONTAINER" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --lock-tables --routines --triggers --no-tablespaces \
    --default-character-set=utf8mb4 "$MYSQL_DATABASE"' 2>/dev/null | gzip -1 > "$DUMP"
if [[ $(gzip -dc "$DUMP" | tail -n 1 | grep -c "Dump completed") -ne 1 ]]; then
    rm -f "$DUMP"; log "Záloha DB se nepovedla, nenasazuji."; notify "JMLP prod: záloha před nasazením ${NEW:0:7} selhala, nenasazeno."; exit 1
fi
ls -1t "$BACKUPS"/predeploy_*.sql.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
log "Záloha DB: $DUMP ($(du -h "$DUMP" | cut -f1))"

# 2. Označit běžící image, ať jde vrátit předchozí verzi.
for svc in backend frontend; do
    docker tag "$PROJECT-$svc:latest" "$PROJECT-$svc:pred-${OLD:0:7}"
done

# 3. Nový kód, build, start (DB se nerestartuje).
git merge -q --ff-only "$NEW"
nice -n 10 $COMPOSE build backend frontend
$COMPOSE up -d backend frontend

# 4. Kontrola zdraví: endpoint /health přes nginx frontendu a healthcheck obou kontejnerů.
healthy() {
    curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1 || return 1
    for c in "$PROJECT-backend" "$PROJECT-frontend"; do
        [[ "$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null)" == healthy ]] || return 1
    done
}
for _ in $(seq 1 "$HEALTH_TRIES"); do   # výchozí 18 x 10 s = 3 min
    if healthy; then
        log "Hotovo, produkce běží na ${NEW:0:7}."
        notify "JMLP prod: nasazeno ${NEW:0:7} ($(git log -1 --format=%s "$NEW"))."
        # Starší označené image pryč, poslední tři zůstávají.
        for svc in backend frontend; do
            docker images --format '{{.Tag}}' "$PROJECT-$svc" | grep '^pred-' | tail -n +4 \
                | xargs -r -I{} docker rmi "$PROJECT-$svc:{}" >/dev/null 2>&1 || true
        done
        docker image prune -f >/dev/null
        exit 0
    fi
    sleep "$HEALTH_WAIT"
done

# 5. Návrat na předchozí verzi.
log "Produkce po nasazení ${NEW:0:7} neodpovídá - vracím ${OLD:0:7}."
for svc in backend frontend; do
    docker tag "$PROJECT-$svc:pred-${OLD:0:7}" "$PROJECT-$svc:latest"
done
git reset -q --hard "$OLD"
$COMPOSE up -d --no-build backend frontend
echo "$NEW" > "$STATE/failed"
notify "JMLP prod: nasazení ${NEW:0:7} SELHALO, vrácena verze ${OLD:0:7}. Pokud proběhla migrace DB, může být nutná obnova ze zálohy $DUMP."
exit 1
