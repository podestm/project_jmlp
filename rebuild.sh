#!/bin/bash
# =============================================================================
# JMLP Rebuild Script - Rebuild a restart služeb
#
# Použití:
#   ./rebuild.sh              # Rebuild všech služeb
#   ./rebuild.sh all          # Rebuild všech služeb
#   ./rebuild.sh frontend     # Rebuild jen frontend
#   ./rebuild.sh backend      # Rebuild jen backend
#   ./rebuild.sh db           # Rebuild jen databáze (⚠️ smaže data!)
#   ./rebuild.sh --help       # Nápověda
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
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

# Rebuild jedné služby
rebuild_service() {
    local service=$1

    log_info "Rebuild služby: $service"

    log_info "Zastavuji $service..."
    docker compose -f "$COMPOSE_FILE" stop "$service"

    log_info "Odstraňuji kontejner $service..."
    docker compose -f "$COMPOSE_FILE" rm -f "$service"

    log_info "Builduji a spouštím $service..."
    docker compose -f "$COMPOSE_FILE" up --build -d "$service"

    sleep 5
    docker compose -f "$COMPOSE_FILE" ps "$service"

    log_success "$service rebuild hotov!"
}

# Rebuild všeho
rebuild_all() {
    log_info "Rebuild všech služeb..."

    log_info "Zastavuji vše..."
    docker compose -f "$COMPOSE_FILE" down

    log_info "Builduji a spouštím vše..."
    docker compose -f "$COMPOSE_FILE" up --build -d

    log_info "Čekám na start..."
    sleep 10

    docker compose -f "$COMPOSE_FILE" ps

    local IP
    IP=$(hostname -I | awk '{print $1}')

    echo ""
    log_success "Rebuild dokončen!"
    echo -e "  Frontend:  ${GREEN}http://${IP}:3000${NC}"
    echo -e "  Backend:   ${GREEN}http://${IP}:8000${NC}"
    echo -e "  Admin:     ${GREEN}http://${IP}:3000/admin${NC}"
}

# Nápověda
show_help() {
    echo "JMLP Rebuild Script"
    echo ""
    echo "Použití:"
    echo "  ./rebuild.sh              - Rebuild všech služeb"
    echo "  ./rebuild.sh all          - Rebuild všech služeb"
    echo "  ./rebuild.sh frontend     - Rebuild jen frontend"
    echo "  ./rebuild.sh backend      - Rebuild jen backend"
    echo "  ./rebuild.sh db           - Rebuild jen databáze (⚠️ smaže data!)"
    echo "  ./rebuild.sh --help       - Tato nápověda"
    echo ""
    echo "Pro první nastavení s importem dat: ./build.sh"
}

# Main
case "${1:-all}" in
    "frontend")
        rebuild_service "frontend"
        ;;
    "backend")
        rebuild_service "backend"
        ;;
    "db")
        log_warn "Rebuild databáze smaže všechna data!"
        read -p "Pokračovat? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rebuild_service "db"
        else
            log_info "Zrušeno."
        fi
        ;;
    "all"|"")
        rebuild_all
        ;;
    "--help"|"-h")
        show_help
        ;;
    *)
        log_error "Neznámá služba: $1"
        echo ""
        show_help
        exit 1
        ;;
esac