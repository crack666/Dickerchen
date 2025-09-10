# Dickerchen - Deployment Best Practices

## 🚀 Lessons Learned aus dem TrueNAS-Migration

### 1. **Environment-Variable-Handling**
- ✅ **Dockerfile**: Immer `.env` kopieren mit `COPY .env ./`
- ✅ **Git**: Alle `.env*` Dateien ignorieren (`**/.env*`)
- ✅ **Docker-Compose**: Alle Environment-Variablen zentral definieren
- ❌ **Vermeiden**: `.env` Dateien im Git-Repository

### 2. **Netzwerk-Konfiguration**
- ✅ **TrueNAS**: PostgreSQL läuft im `host` Netzwerk
- ✅ **Container**: Verwende Host-IP (`192.168.178.172`) statt `127.0.0.1`
- ✅ **Docker-Compose**: Definiere explizite Netzwerke
- ❌ **Vermeiden**: `host.docker.internal` (nur Docker Desktop)

### 3. **Deployment-Sicherheit**
- ✅ **rsync Excludes**: `**/.env*` um alle Environment-Dateien auszuschließen
- ✅ **Git-Sicherheit**: `.gitignore` mit `**/.env*`
- ✅ **Backup**: Wichtige Dateien vor Deployment sichern

### 4. **Monitoring & Healthchecks**
- ✅ **Health-Endpoint**: `/health` für Datenbank-Tests
- ✅ **Docker Healthcheck**: Automatische Container-Überprüfung
- ✅ **Deployment-Tests**: Automatische Tests nach Deployment

### 5. **Dockerfile Best Practices**
- ✅ **Single Responsibility**: Ein CMD pro Container
- ✅ **Layer Optimization**: Abhängigkeiten zuerst kopieren
- ✅ **Environment-Variablen**: Explizit in Compose definieren

## 🛠️ Deployment-Workflow

### Lokale Entwicklung:
```bash
cd backend
cp .env.example .env  # Konfiguriere lokale .env
node server.js        # Starte Entwicklungsserver
```

### Production Deployment:
```bash
cd backend
./deploy-to-truenas.sh  # Automatisches Deployment mit Tests
```

### Troubleshooting:
```bash
# Container-Status prüfen
docker ps | grep dickerchen

# Logs anzeigen
docker logs dickerchen

# Healthcheck testen
curl http://192.168.178.172:8080/health

# Datenbank testen
curl http://192.168.178.172:8080/api/debug/subscriptions
```

## 📋 Checklist vor Deployment

- [ ] `.env` auf TrueNAS ist korrekt konfiguriert
- [ ] Datenbank ist erreichbar (`192.168.178.172:5432`)
- [ ] Docker-Compose Environment-Variablen sind vollständig
- [ ] Dockerfile kopiert `.env` korrekt
- [ ] rsync excludes alle sensitiven Dateien
- [ ] Healthcheck-Endpoint ist verfügbar

## 🔧 Automatische Verbesserungen

Das Deployment-Script führt jetzt automatisch durch:
1. **Datei-Synchronisation** (ohne .env Dateien)
2. **Container-Neubau** mit aktuellen Änderungen
3. **Healthcheck-Tests** nach dem Deployment
4. **Erfolgs-/Fehlermeldungen** mit detaillierten Hinweisen

## 🎯 Zukünftige Verbesserungen

- [ ] **CI/CD Pipeline** mit automatischen Tests
- [ ] **Rollback-Mechanismus** für fehlgeschlagene Deployments
- [ ] **Blue-Green Deployment** für Zero-Downtime
- [ ] **Monitoring-Integration** (Prometheus/Grafana)
- [ ] **Backup-Strategie** für Datenbank und Konfiguration
