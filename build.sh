#!/bin/bash
# =============================================================================
# JMLP Build Script - První nastavení vývojové instance
#
# Co dělá:
#   1. Zkontroluje předpoklady (Docker, Python, GCS credentials)
#   2. Nainstaluje potřebné Python knihovny
#   3. Spustí všechny kontejnery (docker compose up --build)
#   4. Počká na MySQL ready
#   5. Stáhne nejnovější zálohu z Google Cloud Storage
#   6. Obnoví databázi a dokumenty ze zálohy
#
# Použití:
#   ./build.sh                  # Nejnovější záloha
#   ./build.sh 20260218         # Záloha z konkrétního dne
#
# Vyžaduje:
#   - Docker + Docker Compose
#   - Python3
#   - Složka secret/ obsahující:
#       - .env                  (konfigurace prostředí)
#       - jmlp-475213-*.json    (GCS service account)
#     Tyto soubory NEJSOU v gitu - musí se připravit ručně.
# =============================================================================

set -e

# Barvy
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# Konfigurace
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_DIR="${SCRIPT_DIR}/secret"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
ENV_FILE="${SECRET_DIR}/.env"
CREDENTIALS_FILE="${SECRET_DIR}/jmlp-475213-f33b4254fe6f.json"
GCS_BUCKET="jmlp-backup"
GCS_PREFIX="backups/"
TEMP_DIR="${SCRIPT_DIR}/.restore_temp"
DATE_FILTER="${1:-}"

# Cleanup dočasných souborů
cleanup() {
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# ============================================================================
# Kontroly
# ============================================================================

check_prerequisites() {
    log_info "Kontroluji předpoklady..."

    # Docker
    if ! command -v docker &>/dev/null; then
        log_error "Docker není nainstalován!"
        exit 1
    fi

    # Docker Compose
    if ! docker compose version &>/dev/null; then
        log_error "Docker Compose není k dispozici!"
        exit 1
    fi

    # Python3
    if ! command -v python3 &>/dev/null; then
        log_error "Python3 není nainstalován!"
        exit 1
    fi

    # secret/ složka
    if [[ ! -d "$SECRET_DIR" ]]; then
        log_error "Složka secret/ nenalezena!"
        log_error "Vytvoř secret/ a vlož do ní .env a GCS JSON klíč."
        exit 1
    fi

    # .env v secret/
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error ".env nenalezen v secret/!"
        log_error "Vlož secret/.env s konfigurací (viz README)."
        exit 1
    fi

    # GCS credentials v secret/
    if [[ ! -f "$CREDENTIALS_FILE" ]]; then
        log_error "GCS credentials nenalezeny: $CREDENTIALS_FILE"
        log_error "Vlož GCS service account JSON do secret/ a spusť znovu."
        exit 1
    fi

    # Symlink .env do root projektu (docker compose ho potřebuje)
    if [[ ! -f "${SCRIPT_DIR}/.env" ]] || [[ ! -L "${SCRIPT_DIR}/.env" ]]; then
        ln -sf "${ENV_FILE}" "${SCRIPT_DIR}/.env"
        log_info "Vytvořen symlink .env -> secret/.env"
    fi

    # Python google-cloud-storage
    if ! python3 -c "from google.cloud import storage" 2>/dev/null; then
        log_info "Instaluji google-cloud-storage..."
        pip3 install google-cloud-storage 2>/dev/null \
            || python3 -m pip install google-cloud-storage 2>/dev/null \
            || { log_error "Nepodařilo se nainstalovat google-cloud-storage"; exit 1; }
    fi

    log_success "Předpoklady OK"
}

# ============================================================================
# Docker kontejnery
# ============================================================================

start_containers() {
    log_info "Spouštím kontejnery (docker compose up --build)..."

    cd "$SCRIPT_DIR"
    docker compose -f "$COMPOSE_FILE" up --build -d

    log_success "Kontejnery spuštěny"
}

wait_for_mysql() {
    log_info "Čekám na MySQL..."

    local DB_CONTAINER
    DB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q db)

    local retries=30
    while [[ $retries -gt 0 ]]; do
        if docker exec "$DB_CONTAINER" mysqladmin ping -uroot -p"${MYSQL_ROOT_PASSWORD:-default-dev-root-password}" --silent 2>/dev/null; then
            log_success "MySQL je připravena"
            return 0
        fi
        retries=$((retries - 1))
        sleep 2
    done

    log_error "MySQL se nespustila do 60s!"
    docker compose -f "$COMPOSE_FILE" logs db | tail -20
    exit 1
}

# ============================================================================
# GCS zálohy - nalezení a stažení
# ============================================================================

find_latest_backup() {
    log_info "Hledám zálohy na GCS (bucket: $GCS_BUCKET)..."

    BACKUP_INFO=$(python3 - "$CREDENTIALS_FILE" "$DATE_FILTER" << 'PYEOF'
import sys, json
from google.cloud import storage
from google.oauth2 import service_account

creds_file, date_filter = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ""
creds = service_account.Credentials.from_service_account_file(creds_file)
client = storage.Client(credentials=creds, project=creds.project_id)
bucket = client.bucket("jmlp-backup")
blobs = list(bucket.list_blobs(prefix="backups/"))

db_blobs = sorted([b for b in blobs if "jmlp_db_" in b.name and b.name.endswith(".sql.gz")],
                  key=lambda x: x.time_created, reverse=True)
doc_blobs = sorted([b for b in blobs if "jmlp_documents_" in b.name and b.name.endswith(".tar.gz")],
                   key=lambda x: x.time_created, reverse=True)

if date_filter:
    db_blobs = [b for b in db_blobs if date_filter in b.name]
    doc_blobs = [b for b in doc_blobs if date_filter in b.name]

if not db_blobs:
    print(json.dumps({"error": "Žádná záloha DB nenalezena"}))
    sys.exit(1)

result = {"db_blob": db_blobs[0].name, "db_size": db_blobs[0].size}
if doc_blobs:
    result["doc_blob"] = doc_blobs[0].name
    result["doc_size"] = doc_blobs[0].size
print(json.dumps(result))
PYEOF
    ) || { log_error "Nepodařilo se získat seznam záloh z GCS"; exit 1; }

    # Parse
    DB_BLOB=$(echo "$BACKUP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('db_blob',''))")
    DB_SIZE=$(echo "$BACKUP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('db_size',0))")
    DOC_BLOB=$(echo "$BACKUP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('doc_blob',''))")
    DOC_SIZE=$(echo "$BACKUP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('doc_size',0))")
    ERROR=$(echo "$BACKUP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',''))" 2>/dev/null)

    if [[ -n "$ERROR" ]]; then
        log_error "$ERROR"
        exit 1
    fi

    log_success "DB záloha: $DB_BLOB ($(numfmt --to=iec "$DB_SIZE" 2>/dev/null || echo "${DB_SIZE}B"))"
    [[ -n "$DOC_BLOB" ]] && log_success "Documents záloha: $DOC_BLOB ($(numfmt --to=iec "$DOC_SIZE" 2>/dev/null || echo "${DOC_SIZE}B"))"
}

download_backups() {
    mkdir -p "$TEMP_DIR"
    log_info "Stahuji zálohy z GCS..."

    python3 - "$CREDENTIALS_FILE" "$GCS_BUCKET" "$DB_BLOB" "$DOC_BLOB" "$TEMP_DIR" << 'PYEOF'
import sys
from google.cloud import storage
from google.oauth2 import service_account

creds_file, bucket_name, db_blob, doc_blob, temp_dir = sys.argv[1:6]
creds = service_account.Credentials.from_service_account_file(creds_file)
client = storage.Client(credentials=creds, project=creds.project_id)
bucket = client.bucket(bucket_name)

if db_blob:
    print(f"  Stahuji {db_blob} ...")
    bucket.blob(db_blob).download_to_filename(f"{temp_dir}/db_backup.sql.gz")
    print("  DB OK")

if doc_blob:
    print(f"  Stahuji {doc_blob} ...")
    bucket.blob(doc_blob).download_to_filename(f"{temp_dir}/documents_backup.tar.gz")
    print("  Documents OK")
PYEOF

    log_success "Zálohy staženy"
}

# ============================================================================
# Obnova dat
# ============================================================================

restore_database() {
    if [[ ! -f "$TEMP_DIR/db_backup.sql.gz" ]]; then
        log_warn "DB záloha nenalezena, přeskakuji..."
        return
    fi

    log_info "Obnovuji databázi..."

    # Rozbal
    gunzip -kf "$TEMP_DIR/db_backup.sql.gz"

    # Načti env
    source "${SCRIPT_DIR}/.env" 2>/dev/null || true
    local DB_PASS="${MYSQL_ROOT_PASSWORD:-default-dev-root-password}"
    local DB_NAME="${MYSQL_DATABASE:-jmlpcz}"
    local DB_CONTAINER
    DB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q db)

    # Kopíruj a importuj
    docker cp "$TEMP_DIR/db_backup.sql" "$DB_CONTAINER:/tmp/restore.sql"

    docker exec "$DB_CONTAINER" sh -c \
        "mysql -uroot -p'${DB_PASS}' -e 'DROP DATABASE IF EXISTS ${DB_NAME}; CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'"

    docker exec "$DB_CONTAINER" sh -c \
        "mysql -uroot -p'${DB_PASS}' ${DB_NAME} < /tmp/restore.sql"

    docker exec "$DB_CONTAINER" rm -f /tmp/restore.sql

    # Migrace: vytvoř tabulky, které nejsou v záloze
    log_info "Spouštím migrace..."
    docker exec "$DB_CONTAINER" sh -c \
        "mysql -uroot -p'${DB_PASS}' ${DB_NAME} -e \"
CREATE TABLE IF NOT EXISTS fuj_jmlp_folders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
\""

    log_success "Databáze obnovena"
}

restore_documents() {
    if [[ ! -f "$TEMP_DIR/documents_backup.tar.gz" ]]; then
        log_warn "Záloha dokumentů nenalezena, přeskakuji..."
        return
    fi

    log_info "Obnovuji dokumenty..."

    local VOLUME_NAME
    VOLUME_NAME=$(docker volume ls --format "{{.Name}}" | grep -E "documents_data$" | head -1)

    if [[ -z "$VOLUME_NAME" ]]; then
        log_error "Documents volume nenalezen!"
        return
    fi

    docker run --rm \
        -v "$VOLUME_NAME:/data" \
        -v "$TEMP_DIR:/backup:ro" \
        ubuntu \
        sh -c "rm -rf /data/* && tar xzf /backup/documents_backup.tar.gz --strip-components=1 -C /data 2>/dev/null || tar xzf /backup/documents_backup.tar.gz -C / 2>/dev/null"

    log_success "Dokumenty obnoveny"
}

# ============================================================================
# Hlavní program
# ============================================================================

main() {
    echo ""
    echo "============================================="
    echo "  JMLP Build - První nastavení instance"
    echo "============================================="
    echo ""

    check_prerequisites
    echo ""

    # 1. Spustit kontejnery
    start_containers
    wait_for_mysql
    echo ""

    # 2. Stáhnout zálohy
    find_latest_backup
    download_backups
    echo ""

    # 3. Obnovit data
    restore_database
    restore_documents
    echo ""

    # 4. Restart backend (aby se připojil k čerstvé DB)
    log_info "Restartuji backend..."
    docker compose -f "$COMPOSE_FILE" restart backend
    sleep 3

    # 5. Hotovo
    source "${SCRIPT_DIR}/.env" 2>/dev/null || true
    local IP
    IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo "============================================="
    log_success "BUILD DOKONČEN!"
    echo ""
    echo -e "  Frontend:  ${GREEN}http://${IP}:3000${NC}"
    echo -e "  Backend:   ${GREEN}http://${IP}:8000${NC}"
    echo -e "  API docs:  ${GREEN}http://${IP}:8000/docs${NC}"
    echo -e "  Admin:     ${GREEN}http://${IP}:3000/admin${NC}"
    echo ""
    echo -e "  DB záloha: ${BLUE}${DB_BLOB}${NC}"
    [[ -n "$DOC_BLOB" ]] && echo -e "  Documents: ${BLUE}${DOC_BLOB}${NC}"
    echo ""
    echo "  Pro rebuild: ./rebuild.sh"
    echo "============================================="
}

main "$@"
