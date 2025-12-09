#!/bin/bash

# JMLP Production Rebuild Script
# Usage: ./rebuild.sh [service_name] or ./rebuild.sh all

set -e  # Exit on any error

COMPOSE_FILE="docker-compose.server.yml"
PROJECT_NAME="jmlp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to rebuild specific service
rebuild_service() {
    local service=$1
    
    echo_info "Rebuilding service: $service"
    
    # Stop the service
    echo_info "Stopping $service..."
    docker-compose -f $COMPOSE_FILE stop $service
    
    # Remove the container (but keep volumes)
    echo_info "Removing $service container..."
    docker-compose -f $COMPOSE_FILE rm -f $service
    
    # Build and start the service
    echo_info "Building and starting $service..."
    docker-compose -f $COMPOSE_FILE up --build -d $service
    
    # Wait a moment for health checks
    sleep 5
    
    # Check status
    echo_info "Checking $service status..."
    docker-compose -f $COMPOSE_FILE ps $service
    
    echo_success "$service rebuild completed!"
}

# Function to rebuild all services
rebuild_all() {
    echo_info "Starting full rebuild of all services..."
    
    # Stop all services
    echo_info "Stopping all services..."
    docker-compose -f $COMPOSE_FILE down
    
    # Build and start all services
    echo_info "Building and starting all services..."
    docker-compose -f $COMPOSE_FILE up --build -d
    
    # Wait for services to start
    echo_info "Waiting for services to start..."
    sleep 10
    
    # Show final status
    echo_info "Final status:"
    docker-compose -f $COMPOSE_FILE ps
    
    echo_success "Full rebuild completed!"
    echo_info "Application available at: http://localhost:8080"
    echo_info "Admin panel at: http://localhost:8080/admin"
}

# Function to show help
show_help() {
    echo "JMLP Production Rebuild Script"
    echo ""
    echo "Usage:"
    echo "  ./rebuild.sh                 - Rebuild all services"
    echo "  ./rebuild.sh all            - Rebuild all services"
    echo "  ./rebuild.sh frontend       - Rebuild only frontend"
    echo "  ./rebuild.sh backend        - Rebuild only backend" 
    echo "  ./rebuild.sh db             - Rebuild only database"
    echo "  ./rebuild.sh --help         - Show this help"
    echo ""
    echo "Services:"
    echo "  frontend  - React app with nginx (port 8080)"
    echo "  backend   - FastAPI server (internal port 8000)"
    echo "  db        - MySQL database (port 3307)"
}

# Main script logic
case "${1:-all}" in
    "frontend")
        rebuild_service "frontend"
        ;;
    "backend")
        rebuild_service "backend"
        ;;
    "db")
        echo_warning "Rebuilding database will reset all data!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rebuild_service "db"
        else
            echo_info "Database rebuild cancelled."
        fi
        ;;
    "all"|"")
        rebuild_all
        ;;
    "--help"|"-h")
        show_help
        ;;
    *)
        echo_error "Unknown service: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

echo_success "Script completed successfully!"