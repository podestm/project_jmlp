#!/bin/bash
# =============================================================================
# Kopie produkce do testu (preprodtest.jmlp.cz). Spouští jmlp-test-sync.timer
# každé 2 hodiny.
#
#  1. mysqldump produkční DB (jen čtení, krátký zámek MyISAM tabulek)
#  2. testovací DB smazat, znovu založit a nahrát dump
#  3. nahrané dokumenty zkopírovat do svazku testu
#  4. restart testovacího backendu -> doběhnou migrace větve dev
#
# Směr je vždy jen PROD -> TEST. Do produkce skript nikdy nepíše.
# Pozastavení (např. v den závodu nebo při delším testování):
#   touch /opt/jmlp-test/.sync-paused     (zrušit: rm ...)
# =============================================================================
set -euo pipefail

PROD_DB=jmlp-db
TEST_DB=jmlp-test-db
TEST_BACKEND=jmlp-test-backend
PROD_DOCS_VOLUME=jmlp_documents_data
TEST_DOCS_VOLUME=jmlp-test_documents_data
PAUSE_FLAG=/opt/jmlp-test/.sync-paused
DUMP=/var/tmp/jmlp-sync.sql.gz

log() { echo "[$(date '+%F %T')] $*"; }

if [[ -e "$PAUSE_FLAG" ]]; then
    log "Pozastaveno ($PAUSE_FLAG), nic nedělám."
    exit 0
fi

# Pojistka: cíl musí být testovací kontejner, nikdy produkce.
[[ "$TEST_DB" == *test* && "$TEST_DB" != "$PROD_DB" ]] || { log "Chybné nastavení cíle"; exit 1; }

exec 9>/var/lock/jmlp-test-sync.lock
flock -n 9 || { log "Předchozí běh ještě neskončil."; exit 0; }

trap 'rm -f "$DUMP"' EXIT

log "Dump produkce..."
docker exec "$PROD_DB" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --lock-tables --routines --triggers --no-tablespaces \
    --default-character-set=utf8mb4 "$MYSQL_DATABASE"' 2>/dev/null | gzip -1 > "$DUMP"
# Prázdný nebo useknutý dump nenahrávat (test by přišel o data zbytečně).
if [[ $(gzip -dc "$DUMP" | tail -n 1 | grep -c "Dump completed") -ne 1 ]]; then
    log "Dump není kompletní, test nechávám beze změny."
    exit 1
fi
log "Dump hotový ($(du -h "$DUMP" | cut -f1))."

log "Nahrávám do testu..."
docker exec "$TEST_DB" sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e \
    "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"' 2>/dev/null
gzip -dc "$DUMP" | docker exec -i "$TEST_DB" sh -c \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 "$MYSQL_DATABASE"' 2>/dev/null

log "Kopíruju dokumenty..."
docker run --rm \
    -v "$PROD_DOCS_VOLUME":/src:ro \
    -v "$TEST_DOCS_VOLUME":/dst \
    alpine:3.20 sh -c 'find /dst -mindepth 1 -delete && cp -a /src/. /dst/'

log "Restart testovacího backendu (migrace dev)..."
docker restart "$TEST_BACKEND" >/dev/null

log "Hotovo."
