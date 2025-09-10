#!/bin/bash

# 🚀 Dickerchen TrueNAS Update Script
# Überträgt alle Dateien und aktualisiert die App automatisch

set -e  # Exit on any error

# =============================================================================
# CONFIGURATION
# =============================================================================
TRUENAS_IP="192.168.178.172"
TRUENAS_USER="root"
TRUENAS_PATH="/mnt/DataPool/apps/dickerchen"
LOCAL_PATH="/mnt/c/Users/crack.crackdesk/source/repos/bht/Dickerchen"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# FUNCTIONS
# =============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "Dockerfile" ]] || [[ ! -d "backend" ]] || [[ ! -d "public" ]]; then
        log_error "Not in Dickerchen directory! Please run from: $LOCAL_PATH"
        exit 1
    fi
    
    # Check if TrueNAS is reachable
    if ! ping -c 1 "$TRUENAS_IP" > /dev/null 2>&1; then
        log_error "TrueNAS ($TRUENAS_IP) is not reachable!"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

stop_container() {
    log_info "Stopping Dickerchen container on TrueNAS..."
    
    ssh "$TRUENAS_USER@$TRUENAS_IP" << 'EOF'
        if docker ps | grep -q dickerchen; then
            echo "Stopping dickerchen container..."
            docker stop dickerchen || true
            docker rm dickerchen || true
        else
            echo "Dickerchen container not running"
        fi
EOF
    
    log_success "Container stopped"
}

transfer_files() {
    log_info "Transferring files to TrueNAS..."
    
    # Create backup of current version
    log_info "Creating backup of current version..."
    ssh "$TRUENAS_USER@$TRUENAS_IP" << EOF
        if [ -d "$TRUENAS_PATH/source" ]; then
            cp -r $TRUENAS_PATH/source $TRUENAS_PATH/source.backup.\$(date +%Y%m%d_%H%M%S)
            echo "Backup created"
        fi
EOF
    
    # Transfer core application files
    log_info "Transferring Dockerfile..."
    scp Dockerfile "$TRUENAS_USER@$TRUENAS_IP:$TRUENAS_PATH/source/"
    
    log_info "Transferring backend files..."
    scp -r backend/* "$TRUENAS_USER@$TRUENAS_IP:$TRUENAS_PATH/source/backend/"
    
    log_info "Transferring public files..."
    scp -r public/* "$TRUENAS_USER@$TRUENAS_IP:$TRUENAS_PATH/source/public/"
    
    # Transfer compose file
    log_info "Updating docker-compose.yml..."
    ssh "$TRUENAS_USER@$TRUENAS_IP" << 'EOF'
cat > /mnt/DataPool/apps/dickerchen/source/docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'
services:
  dickerchen:
    container_name: dickerchen
    build:
      context: /mnt/DataPool/apps/dickerchen/source
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    volumes:
      - /mnt/DataPool/apps/dickerchen/data:/app/data
      - /mnt/DataPool/apps/dickerchen/logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
COMPOSE_EOF
EOF
    
    log_success "Files transferred successfully"
}

set_permissions() {
    log_info "Setting correct permissions..."
    
    ssh "$TRUENAS_USER@$TRUENAS_IP" << EOF
        chown -R apps:apps $TRUENAS_PATH/
        chmod -R 755 $TRUENAS_PATH/
EOF
    
    log_success "Permissions set"
}

rebuild_container() {
    log_info "Rebuilding Dickerchen container..."
    
    ssh "$TRUENAS_USER@$TRUENAS_IP" << EOF
        cd $TRUENAS_PATH/source
        
        # Clean up old images
        echo "Cleaning up old Docker images..."
        docker image prune -f || true
        
        # Build new image
        echo "Building new Dickerchen image..."
        docker-compose build --no-cache
        
        # Start container
        echo "Starting Dickerchen container..."
        docker-compose up -d
EOF
    
    log_success "Container rebuilt and started"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait a moment for container to start
    sleep 10
    
    # Check if container is running
    ssh "$TRUENAS_USER@$TRUENAS_IP" << 'EOF'
        if docker ps | grep -q dickerchen; then
            echo "✅ Container is running"
            docker ps | grep dickerchen
        else
            echo "❌ Container is not running"
            echo "Container logs:"
            docker logs dickerchen 2>/dev/null || echo "No logs available"
            exit 1
        fi
EOF
    
    # Test HTTP endpoint
    log_info "Testing HTTP endpoint..."
    if curl -s "http://$TRUENAS_IP:8080" > /dev/null; then
        log_success "✅ Dickerchen is responding at http://$TRUENAS_IP:8080"
    else
        log_warning "⚠️  HTTP endpoint not responding yet (may need more time to start)"
    fi
    
    log_success "Deployment verification completed"
}

show_status() {
    log_info "=== DEPLOYMENT SUMMARY ==="
    echo "🎯 App: Dickerchen"
    echo "🖥️  Server: $TRUENAS_IP"
    echo "🔗 URL: http://$TRUENAS_IP:8080"
    echo "📁 Path: $TRUENAS_PATH"
    echo "📊 Status: Check TrueNAS Apps WebUI"
    echo ""
    echo "Useful commands:"
    echo "  • View logs: docker logs -f dickerchen"
    echo "  • Restart: docker-compose restart"
    echo "  • Stop: docker-compose down"
    echo "  • Start: docker-compose up -d"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================
main() {
    echo "=============================================="
    echo "🚀 Dickerchen TrueNAS Update Script"
    echo "=============================================="
    echo ""
    
    check_prerequisites
    echo ""
    
    log_warning "This will update Dickerchen on TrueNAS ($TRUENAS_IP)"
    read -p "Continue? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Update cancelled"
        exit 0
    fi
    
    echo ""
    stop_container
    echo ""
    transfer_files
    echo ""
    set_permissions
    echo ""
    rebuild_container
    echo ""
    verify_deployment
    echo ""
    show_status
    
    log_success "🎉 Dickerchen update completed successfully!"
}

# Run main function
main "$@"
