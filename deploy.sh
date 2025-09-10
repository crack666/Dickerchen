#!/bin/bash

# 🚀 Dickerchen Deployment Script für TrueNAS
# ============================================
# Ein einziges Script für alle Deployment-Szenarien
# - Vollständiges Deployment mit Neubau
# - Schnelles Update ohne Neubau
# - Automatische Tests und Validierung

set -e  # Script beenden bei Fehlern

# Konfiguration
TRUENAS_HOST="192.168.178.172"
TRUENAS_USER="root"
REMOTE_PATH="/mnt/DataPool/apps/dickerchen"
LOCAL_APP_URL="http://192.168.178.172:8080"

# Farben für Ausgaben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hilfsfunktionen
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Passwort einmal abfragen
read_password() {
    if [ -z "$SSH_PASSWORD" ]; then
        echo -n "🔐 SSH-Passwort für $TRUENAS_USER@$TRUENAS_HOST: "
        read -s SSH_PASSWORD
        echo ""
    fi
}

# SSH-Befehl mit gespeichertem Passwort ausführen
ssh_cmd() {
    sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$TRUENAS_USER@$TRUENAS_HOST" "$1"
}

# rsync mit gespeichertem Passwort ausführen
rsync_cmd() {
    sshpass -p "$SSH_PASSWORD" rsync -avz --delete \
        --exclude='node_modules/' \
        --exclude='.env' \
        --exclude='**/.env' \
        --exclude='**/.env.*' \
        --exclude='.git/' \
        --exclude='*.log' \
        --exclude='.DS_Store' \
        -e "ssh -o StrictHostKeyChecking=no" \
        ./ "$TRUENAS_USER@$TRUENAS_HOST:$REMOTE_PATH/"
}

# Healthcheck durchführen
check_health() {
    log_info "Testing application health..."
    if curl -s --max-time 10 "$LOCAL_APP_URL/health" | grep -q "healthy"; then
        log_success "Application is healthy!"
        return 0
    else
        log_error "Application is not healthy!"
        return 1
    fi
}

# Hauptmenü
show_menu() {
    echo "🚀 Dickerchen Deployment Script"
    echo "================================"
    echo "1) Vollständiges Deployment (mit Neubau)"
    echo "2) Schnelles Update (ohne Neubau)"
    echo "3) Nur testen (kein Deployment)"
    echo "4) Container-Logs anzeigen"
    echo "5) Beenden"
    echo ""
    echo -n "Wähle eine Option (1-5): "
}

# Vollständiges Deployment
full_deployment() {
    log_info "Starting full deployment with container rebuild..."

    # Passwort abfragen
    read_password

    # Prüfen ob sshpass installiert ist
    if ! command -v sshpass &> /dev/null; then
        log_error "sshpass ist nicht installiert!"
        log_info "Installiere mit: sudo apt-get install sshpass"
        exit 1
    fi

    # In Projekt-Root wechseln
    cd "$(dirname "$0")/.."

    # Dateien synchronisieren
    log_info "Synchronizing files to TrueNAS..."
    if rsync_cmd; then
        log_success "Files synchronized successfully"
    else
        log_error "File synchronization failed!"
        exit 1
    fi

    # Container stoppen und neu starten
    log_info "Stopping and rebuilding containers..."
    if ssh_cmd "cd /mnt/DataPool/apps/dickerchen && docker compose -f truenas-dickerchen.yml down && docker compose -f truenas-dickerchen.yml up --build -d"; then
        log_success "Containers rebuilt and started"
    else
        log_error "Container rebuild failed!"
        exit 1
    fi

    # Warten und testen
    log_info "Waiting for application to be ready..."
    sleep 15

    if check_health; then
        log_success "🎉 Full deployment completed successfully!"
        log_info "🌐 Test your app: $LOCAL_APP_URL"
        log_info "🔍 Debug info: $LOCAL_APP_URL/api/debug/subscriptions"
    else
        log_error "Deployment completed but application is not healthy!"
        log_info "Check logs with option 4 or run: docker logs dickerchen"
        exit 1
    fi
}

# Schnelles Update
quick_update() {
    log_info "Starting quick update..."

    # Passwort abfragen
    read_password

    # Prüfen ob sshpass installiert ist
    if ! command -v sshpass &> /dev/null; then
        log_error "sshpass ist nicht installiert!"
        log_info "Installiere mit: sudo apt-get install sshpass"
        exit 1
    fi

    # In Projekt-Root wechseln
    cd "$(dirname "$0")/.."

    # Nur geänderte Dateien synchronisieren
    log_info "Synchronizing changed files..."
    if rsync_cmd; then
        log_success "Files synchronized successfully"
    else
        log_error "File synchronization failed!"
        exit 1
    fi

    # Container neu starten
    log_info "Restarting containers..."
    if ssh_cmd "cd /mnt/DataPool/apps/dickerchen && docker compose -f truenas-dickerchen.yml restart"; then
        log_success "Containers restarted"
    else
        log_error "Container restart failed!"
        exit 1
    fi

    # Warten und testen
    log_info "Waiting for application to be ready..."
    sleep 5

    if check_health; then
        log_success "🎉 Quick update completed successfully!"
        log_info "🌐 Test your app: $LOCAL_APP_URL"
    else
        log_error "Update completed but application is not healthy!"
        exit 1
    fi
}

# Nur testen
test_only() {
    log_info "Testing current deployment..."

    if check_health; then
        log_success "✅ Application is running and healthy!"
        log_info "🌐 App URL: $LOCAL_APP_URL"
        log_info "🔍 Debug URL: $LOCAL_APP_URL/api/debug/subscriptions"

        # Zusätzliche Tests
        log_info "Testing API endpoints..."
        if curl -s "$LOCAL_APP_URL/api/test" | grep -q "API is working"; then
            log_success "API test endpoint working"
        else
            log_warning "API test endpoint not responding"
        fi
    else
        log_error "❌ Application is not healthy!"
        log_info "Check container status and logs"
    fi
}

# Container-Logs anzeigen
show_logs() {
    log_info "Fetching container logs..."
    read_password

    echo "=== Dickerchen Container Logs ==="
    ssh_cmd "docker logs dickerchen --tail 20"
    echo "=== End of Logs ==="
}

# Hauptprogramm
main() {
    while true; do
        show_menu
        read -r choice

        case $choice in
            1)
                full_deployment
                break
                ;;
            2)
                quick_update
                break
                ;;
            3)
                test_only
                break
                ;;
            4)
                show_logs
                ;;
            5)
                log_info "Goodbye! 👋"
                exit 0
                ;;
            *)
                log_error "Ungültige Option. Bitte 1-5 wählen."
                sleep 2
                ;;
        esac
    done
}

# Script starten
main "$@"
