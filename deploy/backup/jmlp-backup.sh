#!/bin/bash
# =============================================================================
# Týdenní záloha produkce JMLP do Google Drive (jmlp-backup.timer).
#
#   gdrive:project_jmlp_cz/backup/jmlp-db-YYYY-MM-DD.sql.gz   drží 4 poslední
#   gdrive:project_jmlp_cz/backup/files/                      jedna aktuální kopie
#                                                             nahraných dokumentů
# rclone remote "gdrive" je v /opt/jmlp-backup/rclone.conf (viz README).
# =============================================================================
set -euo pipefail

PROD_DB=jmlp-db
PROD_DOCS_VOLUME=jmlp_documents_data
RCLONE_CONF=/opt/jmlp-backup/rclone.conf
DEST=gdrive:project_jmlp_cz/backup
KEEP=4
NAME="jmlp-db-$(date +%F).sql.gz"
DUMP="/var/tmp/$NAME"

log() { echo "[$(date '+%F %T')] $*"; }
rc() { rclone --config "$RCLONE_CONF" "$@"; }
trap 'rm -f "$DUMP"' EXIT

log "Dump produkční DB..."
docker exec "$PROD_DB" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --lock-tables --routines --triggers --no-tablespaces \
    --default-character-set=utf8mb4 "$MYSQL_DATABASE"' 2>/dev/null | gzip -6 > "$DUMP"
if [[ $(gzip -dc "$DUMP" | tail -n 1 | grep -c "Dump completed") -ne 1 ]]; then
    log "Dump není kompletní, zálohu neukládám."
    exit 1
fi

log "Nahrávám $NAME ($(du -h "$DUMP" | cut -f1))..."
rc copyto "$DUMP" "$DEST/$NAME"

log "Mažu starší než $KEEP posledních..."
rc lsf "$DEST" --files-only --include 'jmlp-db-*.sql.gz' | sort | head -n -"$KEEP" | while read -r old; do
    log "  maže se $old"
    rc deletefile "$DEST/$old"
done

log "Synchronizuju dokumenty do files/..."
DOCS_PATH=$(docker volume inspect -f '{{ .Mountpoint }}' "$PROD_DOCS_VOLUME")
rc sync "$DOCS_PATH" "$DEST/files"

log "Hotovo."
