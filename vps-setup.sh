# VPS Setup für mehrere Dickerchen-Apps
# Dieses Script richtet einen VPS für Multi-App-Hosting ein

#!/bin/bash

# System aktualisieren
sudo apt update && sudo apt upgrade -y

# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose installieren
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Nginx installieren (Reverse Proxy)
sudo apt install nginx -y

# PostgreSQL installieren
sudo apt install postgresql postgresql-contrib -y

# Certbot für SSL installieren
sudo apt install certbot python3-certbot-nginx -y

echo "✅ VPS Setup abgeschlossen!"
echo "Nächste Schritte:"
echo "1. PostgreSQL konfigurieren: sudo -u postgres psql"
echo "2. Datenbanken für jede App erstellen"
echo "3. Nginx für Multi-Domain konfigurieren"
echo "4. SSL-Zertifikate mit certbot beantragen"
