# TrueNAS WebUI Installation - Dickerchen App

## Voraussetzungen ✅
- [x] Datenbank Backup erstellt (backup_20250930_153232.sql)
- [x] Manueller Container gestoppt und entfernt
- [x] Docker Image `dickerchen:latest` auf TrueNAS verfügbar
- [x] PostgreSQL Container läuft (`ix-postgres-postgres-1`)

## Installation über TrueNAS WebUI

### Schritt 1: IX App installieren
1. In TrueNAS WebUI gehen: **Apps** → **Available Applications**
2. Nach **"IX App"** suchen und installieren
3. App-Name: **"Dickerchen"**

### Schritt 2: Container Konfiguration
**Application Name:** `Dickerchen`

**Container Images:**
- **Image Repository:** `dickerchen`
- **Image Tag:** `latest`
- **Image Pull Policy:** `IfNotPresent`

### Schritt 3: Container Entrypoint (leer lassen)
- Entrypoint: (leer)
- Container Command: (leer)
- Container Args: (leer)

### Schritt 4: Container Environment Variables
```
NODE_ENV=production
PORT=8080
HOST=0.0.0.0
TZ=Europe/Berlin
DATABASE_URL=postgres://dickerchen_user:ZsG9Dp8VcE2L4fH9@192.168.178.172:5432/dickerchen_prod
VAPID_PUBLIC_KEY=BPHINd4gAVyoITIyd-43r6Z8YMLaudxm0veA3GUZK0T9-3ZQZqVkTRHb930dDWhMI2atc9itf6BWLfaMn-JZQKw
VAPID_PRIVATE_KEY=PIPx-UzdhYI1J_7CRwO8soLNMmkd6dxxesvyS4vrpgU
VAPID_EMAIL=mailto:behr.lennart@gmail.com
NOTIFICATION_SECRET=4c1ca735cbc83d806bba706a5770c724e8d43efca0252d6919a230bf6fe19ad7
```

### Schritt 5: Networking
**Port Forwarding:**
- Container Port: `8080`
- Node Port: `8080`
- Protocol: `TCP`

**DNS Configuration:**
- DNS Policy: `Default`

### Schritt 6: Storage and Persistence
**Host Path Volumes:**

1. **Data Volume:**
   - Host Path: `/mnt/DataPool/apps/dickerchen/data`
   - Mount Path: `/app/data`
   - Read Only: `No`

2. **Logs Volume:**
   - Host Path: `/mnt/DataPool/apps/dickerchen/logs`
   - Mount Path: `/app/logs`
   - Read Only: `No`

### Schritt 7: Workload Details (Advanced)
**Restart Policy:** `Unless-Stopped`

**Security Context:**
- Run as User: `1000`
- Run as Group: `1000`
- FS Group: `1000`

### Schritt 8: App Metadata (Labels)
```
truenas.app.name=Dickerchen
truenas.app.description=Personal Fitness Tracking App
truenas.app.version=1.0.0
truenas.app.icon=https://dickerchen.crackhost.com/favicon.ico
truenas.app.category=productivity
homepage.group=Fitness
homepage.name=Dickerchen
homepage.href=http://192.168.178.172:8080
homepage.description=Personal Fitness Tracking
```

### Schritt 9: Resource Limits (Optional)
**CPU Resources:**
- CPU Limit: `1000m` (1 CPU)
- CPU Burst: `1000m`

**Memory Resources:**
- Memory Limit: `512Mi`

## Nach der Installation

### Verifikation:
1. **Container Status prüfen:** Apps → Installed Applications → Dickerchen
2. **Logs checken:** Container Details → Logs
3. **App testen:** http://192.168.178.172:8080
4. **WebUI Management:** Start/Stop/Restart über TrueNAS WebUI

### Troubleshooting:
- Falls Image nicht gefunden: `docker images` auf TrueNAS prüfen
- Falls Verbindung zur DB fehlschlägt: PostgreSQL Container Status prüfen
- Falls Port-Konflikt: Anderen Port verwenden (z.B. 8081)

## Alternative: Docker-Compose Import
Falls IX App kompliziert ist, kann die `truenas-ix-app.yml` auch direkt importiert werden:
1. Apps → Custom App → Import Docker Compose
2. YAML-Inhalt einfügen
3. Deploy

## Backup Restore (falls nötig):
```bash
docker exec ix-postgres-postgres-1 psql -U dickerchen_user -d dickerchen_prod < /mnt/DataPool/apps/dickerchen/backup_20250930_153232.sql
```