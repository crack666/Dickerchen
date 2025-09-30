# 🚀 Release Workflow für Dickerchen

## Neue Version deployen

### 1. Version automatisch erhöhen
```bash
./update-version.sh
```
**Das macht automatisch:**
- Erhöht Patch-Version (z.B. 1.2.3 → 1.2.4)
- Aktualisiert `VERSION` Datei
- Aktualisiert `public/version.js` (Frontend)
- Aktualisiert `backend/server.js` (API Endpoint)
- Aktualisiert `public/sw.js` (Service Worker)

### 2. Änderungen committen
```bash
git add .
git commit -m "🚀 Release v$(cat VERSION)"
git push
```

### 3. Deployment starten
```bash
./deploy.sh
```

## Manuelle Version setzen

Für Major/Minor Updates:
```bash
# Neue Version in VERSION Datei setzen
echo "2.0.0" > VERSION

# Dann Update-Script ausführen
./update-version.sh

# Committen und deployen
git add .
git commit -m "🚀 Major Release v2.0.0"
git push
./deploy.sh
```

## Update-Mechanismus

### Wie Clients Updates erkennen:

1. **Server Version Check** (`/api/version`):
   - Client fragt Server nach aktueller Version
   - Vergleicht mit eigener Version (`window.APP_VERSION`)
   - Nutzt echte Semantic Version Comparison

2. **Cache Busting**:
   - Alle Assets werden mit `?v=X.Y.Z` geladen
   - Bei neuer Version werden alle Caches geleert

3. **Service Worker**:
   - Registriert neue Version automatisch
   - Löscht alte Caches
   - Lädt neue Assets

### Update-Benachrichtigung

- Erscheint nur bei echten Version-Unterschieden
- Nutzt Semantic Versioning (1.2.4 > 1.2.3)
- Keine False Positives mehr durch String-Vergleiche
- Benutzer kann Update ablehnen oder sofort anwenden

### Debugging

Console Logs zeigen:
```
🔍 Version check: Client=1.2.3, Server=1.2.4
🚀 New version available: 1.2.4 > 1.2.3
📢 Showing update notification for version 1.2.4
```

## Wichtige Dateien

- `VERSION`: Single Source of Truth
- `public/version.js`: Frontend Version + Cache Busting
- `backend/server.js`: API Version Endpoint
- `public/sw.js`: Service Worker Cache Management
- `update-version.sh`: Automatisches Update-Script
