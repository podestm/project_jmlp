#!/bin/bash
# =============================================================================
# Týdenní záloha produkce JMLP do Google Drive (jmlp-backup.timer, nebo /backup
# v Discord botovi).
#
#   gdrive:project_jmlp_cz/backup/jmlp-db-YYYY-MM-DD.sql.gz   drží 4 poslední
#   gdrive:project_jmlp_cz/backup/files/                      jedna aktuální kopie
#                                                             nahraných dokumentů
# Nastavení: /opt/jmlp-ops/.env (DISCORD_WEBHOOK_URL), /opt/jmlp-ops/rclone.conf
# Log: /opt/jmlp-ops/logs/backup_YYYYmmdd_HHMMSS.log (+ výsledek na Discord)
# =============================================================================
set -euo pipefail

OPS=/opt/jmlp-ops
PROD_DB=jmlp-db
PROD_DOCS_VOLUME=jmlp_documents_data
RCLONE_CONF=$OPS/rclone.conf
DEST=gdrive:project_jmlp_cz/backup
KEEP=4
NAME="jmlp-db-$(date +%F).sql.gz"
DUMP="/var/tmp/$NAME"
mkdir -p "$OPS/logs"
LOG="$OPS/logs/backup_$(date +%Y%m%d_%H%M%S).log"
DISCORD_WEBHOOK_URL=$(grep -s '^DISCORD_WEBHOOK_URL=' "$OPS/.env" | cut -d= -f2- || true)
DB_SIZE="-"; DOCS_SIZE="-"

exec > >(tee -a "$LOG") 2>&1
log() { echo "[$(date '+%F %T')] $*"; }
rc() { rclone --config "$RCLONE_CONF" "$@"; }

notify() {  # notify <ok|fail> <popis>
    [[ -n "$DISCORD_WEBHOOK_URL" ]] || return 0
    local title color
    if [[ $1 == ok ]]; then title="✅ JMLP záloha - úspěch"; color=65280
    else title="❌ JMLP záloha - chyba"; color=16711680; fi
    local payload
    payload=$(python3 -c 'import json,sys; print(json.dumps({"embeds":[{"title":sys.argv[1],"color":int(sys.argv[2]),
        "description":sys.argv[3],"fields":[{"name":"Databáze","value":sys.argv[4],"inline":True},
        {"name":"Dokumenty","value":sys.argv[5],"inline":True}],"footer":{"text":"jmlp.cz → Google Drive project_jmlp_cz/backup"}}]}))' \
        "$title" "$color" "$2" "$DB_SIZE" "$DOCS_SIZE")
    curl -s -o /dev/null -F "payload_json=$payload" -F "file=@$LOG;type=text/plain" "$DISCORD_WEBHOOK_URL" || true
}
trap 'code=$?; rm -f "$DUMP"; if [[ $code -ne 0 ]]; then log "CHYBA (kód $code)"; notify fail "Záloha selhala, log v příloze."; fi' EXIT

log "Dump produkční DB..."
docker exec "$PROD_DB" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --lock-tables --routines --triggers --no-tablespaces \
    --default-character-set=utf8mb4 "$MYSQL_DATABASE"' 2>/dev/null | gzip -6 > "$DUMP"
if [[ $(gzip -dc "$DUMP" | tail -n 1 | grep -c "Dump completed") -ne 1 ]]; then
    log "Dump není kompletní, zálohu neukládám."
    exit 1
fi
DB_SIZE=$(du -h "$DUMP" | cut -f1)

log "Nahrávám $NAME ($DB_SIZE)..."
rc copyto "$DUMP" "$DEST/$NAME"

log "Mažu starší než $KEEP posledních..."
rc lsf "$DEST" --files-only --include 'jmlp-db-*.sql.gz' | sort | head -n -"$KEEP" | while read -r old; do
    log "  maže se $old"
    rc deletefile "$DEST/$old"
done

log "Synchronizuju dokumenty do files/..."
DOCS_PATH=$(docker volume inspect -f '{{ .Mountpoint }}' "$PROD_DOCS_VOLUME")
DOCS_SIZE=$(du -sh "$DOCS_PATH" | cut -f1)
rc sync "$DOCS_PATH" "$DEST/files"

# Staré logy pryč (půl roku stačí).
find "$OPS/logs" -name 'backup_*.log' -mtime +180 -delete

log "Hotovo."
notify ok "Týdenní záloha proběhla v pořádku."
