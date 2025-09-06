# Dickerchen - Push-up Challenge App

## 🔔 Intelligente Benachrichtigungen

**📊 Status:** ✅ **System aktiv und funktionsbereit**

Das System sendet personalisierte, zeitgesteuerte Benachrichtigungen, die sich an das User-Verhalten anpassen.

### Wie es funktioniert

1. **GitHub Actions** weckt den Server zu verschiedenen Tageszeiten
2. **Intelligente Algorithmen** kategorisieren User und wählen passende Nachrichten
3. **Zeitbasierte Filter** verhindern späte Benachrichtigungen
4. **Nachrichten-Historie** vermeidet Wiederholungen
5. **Skalierbare Limits** pro User-Kategorie

### Zeit-Slots (Smart Scheduling)

- **🌅 Morgen**: 9:00-11:00 Berlin-Zeit (zufällig)
- **☀️ Nachmittag**: 15:00-18:00 Berlin-Zeit (zufällig)
- **🌙 Abend**: 17:30-19:30 Berlin-Zeit (zufällig)

**Warum zufällige Zeiten?**
- Nicht alle User haben den gleichen Tagesrhythmus
- Vermeidet "Notification-Spam" zur gleichen Zeit
- Server wird natürlich durch User-Aktivität aufgewacht
- Realistischere und weniger nervige Erfahrung

### Intelligente Verteilung

#### Zufällige Batch-Größen
- **3-10 User** pro Batch (nicht alle gleichzeitig)
- **Zufällige Reihenfolge** (ORDER BY RANDOM())
- **Verzögerungen** bis 30 Sekunden zwischen Benachrichtigungen

#### Smart Filtering
- **User-Historie** verhindert Wiederholungen
- **Kategorie-spezifische Limits** (New: 1, Advanced: 3)
- **Zeit-Slot basierte Kriterien** (Morgen: 0 Push-ups, Abend: 40-90 Push-ups)

### User-Kategorien

#### 🐣 Neue User (weniger als 7 Tage aktiv)
- **Limit**: 1 Benachrichtigung pro Slot
- **Fokus**: Sanfte Einführung in die Routine

#### 👤 Gelegenheits-User
- **Limit**: 1 Benachrichtigung pro Slot
- **Fokus**: Regelmäßige Erinnerung

#### 💪 Aktive User (machen regelmäßig Push-ups)
- **Limit**: 2 Benachrichtigungen pro Slot
- **Fokus**: Motivation und Fortschritt

#### 🏆 Fortgeschrittene User (über 1000 Push-ups gesamt)
- **Limit**: 3 Benachrichtigungen pro Slot
- **Fokus**: Herausforderung und Spitzenleistung

### Beispiel-Nachrichten

#### Neue User - Morgen
- "Guten Morgen Max! Start in den Tag mit deinen Dicken! 🌅"
- "Max, der Tag beginnt - Zeit für Push-ups! 💪"

#### Aktive User - Nachmittag
- "Hey Anna! Du bist bei 75 - weiter so! 💪"
- "Anna, du machst das super! Mehr Dicken? 🏋️‍♂️"

#### Fortgeschrittene - Abend
- "Wow Tom! 95 Dicken heute - Wahnsinn! 🏆"
- "Tom, du dominierst! Mehr als 100? 💥"

### Hybride Lösung für Fly.io Free Tier

#### 🎯 **GitHub Actions (Primär)**
- **Regelmäßige Checks** alle 2 Stunden während aktiver Zeiten
- **Smart Time Detection** basierend auf Berlin-Zeit
- **Server Wake-up** vor jeder Notification
- **Graceful Fallback** wenn Server schläft

#### 🔄 **Server Fallback (Backup)**
- **Timer im Server** alle 2 Stunden
- **Nur wenn Server aktiv** ist (durch User-Traffic)
- **Basic Rate Limiting** verhindert Spam
- **Automatische Zeit-Slot Erkennung**

#### 📊 **Warum diese Kombination?**
- ✅ **Zuverlässig**: GitHub Actions als primäre Lösung
- ✅ **Fly.io-kompatibel**: Kein künstliches "Aufwecken" nötig
- ✅ **Redundant**: Server kann auch selbst Notifications senden
- ✅ **Kosteneffizient**: Free Tier optimiert
- ✅ **Smart**: Passt sich an User-Aktivität an

### Zeitplan

```yaml
# GitHub Actions Schedule (Berlin Time)
- 9:00, 11:00, 13:00, 15:00, 17:00, 19:00

# Server Fallback (wenn aktiv)
- Alle 2 Stunden während Server läuft
```

### Monitoring

Beide Systeme loggen ihre Aktivität:
```
🔔 Smart notifications at Mon Sep 6 15:00:00 UTC 2025 - Time slot: afternoon
⏰ Fallback notification check - Time slot: afternoon
✅ Smart notifications sent successfully
```

### 📊 **Aktueller System-Status**

#### ✅ **GitHub Actions Workflow**
- **Status:** Aktiv (ID: 186967262)
- **Letzte Ausführung:** 6. September 2025 - Erfolgreich ✅
- **Schedule:** Alle 2 Stunden (9:00, 11:00, 13:00, 15:00, 17:00, 19:00 Berlin-Zeit)
- **Secret:** NOTIFICATION_SECRET konfiguriert

#### ✅ **Server Fallback System**
- **Status:** Aktiv
- **Timer:** Alle 2 Stunden (wenn Server läuft)
- **API-Endpunkte:** Funktionsbereit
- **Test-Endpunkt:** `/api/trigger-fallback` verfügbar

#### ✅ **Smart Features**
- **User-Kategorisierung:** Aktiv
- **Rate Limiting:** Implementiert
- **Zufällige Zeiten:** Aktiviert
- **Nachrichten-Rotation:** Funktioniert

### Technische Details

#### Fly.io Suspendierung & Hybride Lösung
- **Problem**: Apps werden bei Inaktivität suspendiert
- **Lösung**: GitHub Actions weckt Server vor jeder Benachrichtigung
- **Fallback**: Server kann auch selbst Notifications senden (wenn aktiv)
- **Hybrid**: Beide Systeme arbeiten zusammen für maximale Zuverlässigkeit

#### Modulare Architektur
- **NotificationManager Klasse**: `backend/notification-manager.js`
- **User-Kategorisierung**: Automatisch basierend auf Aktivität
- **Nachrichten-Rotation**: Verhindert Wiederholungen
- **Zeit-Filter**: 8:00 - 19:00 Berlin-Zeit
- **Server Fallback**: `setInterval` alle 2 Stunden (wenn Server läuft)

#### Sicherheit
- **Bearer Token Authentication**
- **Rate Limiting** pro User-Kategorie
- **Historie-Tracking** für 7 Tage

### Monitoring

Benachrichtigungen werden detailliert geloggt:
```
🔔 Sending afternoon notifications...
Found 5 users needing afternoon notifications
✅ Sent afternoon notification to Max (new)
✅ Sent afternoon notification to Anna (active)
🎯 Sent goal encouragement to Tom
✅ afternoon notifications completed
```

### Anpassungen

#### Limits ändern
```javascript
// In notification-manager.js
getMaxNotificationsPerSlot(user) {
  const category = this.getUserCategory(user);
  const limits = {
    new: 1,      // Ändere diese Werte
    casual: 1,
    active: 2,
    advanced: 3
  };
  return limits[category] || 1;
}
```

#### Neue Nachrichten hinzufügen
```javascript
// In generateNotificationMessage()
const messageSets = {
  new: {
    morning: [
      'Neue Nachricht hier...',
      // Weitere Nachrichten
    ],
    // ...
  }
};
```

#### Zeit-Slots anpassen
```yaml
# In .github/workflows/daily-notifications.yml
- cron: '0 8 * * *'  # 10:00 Berlin-Zeit
```

### Testen

#### Lokaler Test
```bash
# Teste alle Zeit-Slots
curl -X POST http://localhost:3001/api/test-notifications/morning
curl -X POST http://localhost:3001/api/test-notifications/afternoon
curl -X POST http://localhost:3001/api/test-notifications/evening

# Teste Server Fallback (manuell triggern)
curl -X POST http://localhost:3001/api/trigger-fallback
```

#### Manueller GitHub Actions Test
```yaml
# Repository → Actions → Daily Notifications → Run workflow
# Wähle Zeit-Slot aus (wird automatisch erkannt)
```

#### Live Test auf Fly.io
```bash
# Teste direkt auf dem Live-Server
curl -X POST https://dickerchen.fly.dev/api/test-notifications/afternoon \
  -H "Authorization: Bearer DEIN_SECRET"

# Teste Fallback-System
curl -X POST https://dickerchen.fly.dev/api/trigger-fallback \
  -H "Authorization: Bearer DEIN_SECRET"
```

### Performance

- **Datenbank-Abfragen**: Optimiert mit einem Query pro Zeit-Slot
- **Push-API**: Batch-Verarbeitung für mehrere Subscriptions
- **Historie**: Automatische Bereinigung nach 7 Tagen
- **Fehlerbehandlung**: Graceful handling von ungültigen Subscriptions
- **NotificationManager Klasse:** `backend/notification-manager.js`
- **Intelligente Filter:** Zeit, User-Aktivität, Push-up Fortschritt
- **Fehlerbehandlung:** Ungültige Subscriptions werden automatisch entfernt

#### Sicherheit
- **Bearer Token Authentication** für den Notification-Endpoint
- **Zeitbasierte Filter** verhindern Spam
- **Einmal pro Tag** pro User-Typ

### Monitoring

Die Benachrichtigungen werden in den Server-Logs protokolliert:
```
🔔 Sending daily reminders...
Found 3 users needing reminders
Sent reminder to Max
Found 2 users close to goal
Sent encouragement to Anna
✅ Daily reminders sent successfully
```

### Anpassungen

Du kannst die Benachrichtigungen in `notification-manager.js` anpassen:
- **Zeiten ändern:** `maxNotificationHour = 19`
- **Nachrichten:** Im `messages` Objekt
- **Filter:** In den `getUsersNeedingNotifications()` Methoden
