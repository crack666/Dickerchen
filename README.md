# Dickerchen 💪

Eine Progressive Web App für Push-up Challenges mit sozialen Features, intelligenten Push-Notifications und automatischen Updates. Perfekt für Fitness-Gruppen, die sich gegenseitig motivieren wollen.

**🎯 Das Ziel:** 100 Push-ups täglich = 36.500 im Jahr!

**🌐 Live:** https://dickerchen.fly.dev

---

## ✨ Features

### 📱 **Progressive Web App (PWA)**
- **Installierbar** auf Handy, Tablet und Desktop
- **Offline-fähig** durch Service Worker Caching
- **App-ähnliches Erlebnis** mit eigener Icon und Splash Screen
- **Push-Notifications** auch bei geschlossener App

### 💪 **Push-up Tracking**
- **Quick-Add Buttons:** 10, 20, 30 Push-ups oder individuelle Anzahl
- **Tagesziel Tracking:** Fortschrittsbalken und motivierende Nachrichten
- **Historisches Logging:** Alle Sets mit Zeitstempel
- **Flexibles Ziel:** Standard 100/Tag, anpassbar

### 🏆 **Gamification & Social**
- **Heute-Leaderboard:** Wer hat heute am meisten geschafft?
- **Allzeit-Statistiken:** Gesamte Push-up Counts aller Zeiten
- **Kalender-Ansicht:** Visuelle Darstellung von Erfolgs- und Fehltagen
- **Benutzer-Profile:** Detaillierte Ansicht mit Tagesprotokollen

### 🔔 **Intelligente Push-Notifications**
- **Personalisierte Anstups-Nachrichten:** 15 verschiedene, lustige Motivationstexte
- **Sender-Identifikation:** Du siehst immer, wer dich angestupst hat
- **Cross-Browser Support:** Funktioniert zwischen verschiedenen Geräten
- **Smart Timing:** Berücksichtigt Benutzeraktivität
- **Hybride Zustellung:** GitHub Actions + Server Fallback für Fly.io
- **Nicht-nervig:** Zufällige Zeiten, Rate Limiting, User-Kategorisierung

### 🔄 **Auto-Refresh System**
- **Page Visibility API:** Automatisches Update beim App-Wechsel
- **Pull-to-Refresh:** Mobile-freundliche Aktualisierung
- **Periodische Updates:** Alle 60 Sekunden (dezent im Hintergrund)
- **Smart Interaction Detection:** Pausiert bei Modals, Eingaben etc.

### 🎮 **UX Features**
- **Responsive Design:** Optimiert für Mobile und Desktop
- **Schnelle Navigation:** Tab-System für Heute/Allzeit
- **Teilen-Funktion:** Social Media Integration
- **Debug-Tools:** Notification-Status und Logs für Troubleshooting

---

## 🛠️ Technische Architektur

### **Frontend**
- **Vanilla JavaScript** - Keine Frameworks, maximale Performance
- **Service Worker** - Offline-Funktionalität und Push-Handling
- **Web Manifest** - PWA-Installation und Theming
- **CSS Grid/Flexbox** - Responsive Layout
- **Web APIs:** Notification API, Page Visibility API, Web Share API

### **Backend**
- **Node.js + Express** - RESTful API Server
- **PostgreSQL** - Persistente Datenhaltung mit relationalen Strukturen
- **web-push** - VAPID-basierte Push-Notifications
- **CORS + HTTPS** - Sichere Cross-Origin Requests

### **Infrastructure**
- **Docker** - Containerisierte Deployment
- **Fly.io** - PaaS mit automatischer HTTPS-Terminierung
- **WSL2 Development** - Windows-Linux Hybrid Development

---

## 🚀 Installation & Development

### **Lokale Entwicklung**

1. **PostgreSQL mit Docker starten:**
   ```bash
   docker run --name dickerchen-postgres \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=dickerchen \
     -p 5432:5432 -d postgres:15
   ```

2. **Dependencies installieren:**
   ```bash
   cd backend
   npm install
   ```

3. **Environment Setup:**
   ```bash
   cp .env.example .env
   # Bearbeite .env mit deinen VAPID Keys und DB Connection
   ```

4. **Server starten:**
   ```bash
   npm start
   ```

5. **App öffnen:** http://localhost:3001

### **VAPID Keys generieren** (für Push-Notifications):
```bash
npx web-push generate-vapid-keys
```

### **Lokale HTTPS** (optional, für PWA-Testing):
```bash
# Selbst-signierte Zertifikate erstellen
openssl req -x509 -newkey rsa:2048 -keyout backend/key.pem -out backend/cert.pem -days 365 -nodes
```

---

## 🌐 Production Deployment (Fly.io)

### **Erstmaliges Setup:**

1. **Fly CLI installieren:**
   ```bash
   # Linux/WSL
   curl -L https://fly.io/install.sh | sh
   export PATH="$HOME/.fly/bin:$PATH"
   
   # Login
   fly auth login
   ```

2. **App deployen:**
   ```bash
   fly launch
   # Folge dem interaktiven Setup
   fly deploy
   ```

3. **PostgreSQL hinzufügen:**
   ```bash
   fly postgres create dickerchen-db
   fly postgres attach dickerchen-db
   ```

4. **Environment Variables setzen:**
   ```bash
   fly secrets set VAPID_PUBLIC_KEY="your-public-key"
   fly secrets set VAPID_PRIVATE_KEY="your-private-key"
   ```

### **Updates deployen:**
```bash
git push origin main
fly deploy
```

---

## 📊 API Endpoints

### **Users**
- `GET /api/users` - Alle Benutzer
- `POST /api/users` - Neuen Benutzer erstellen

### **Push-ups**
- `GET /api/pushups/:userId` - Heutige Push-ups eines Users
- `POST /api/pushups` - Push-ups hinzufügen
- `GET /api/pushups/:userId/total` - Gesamte Push-ups (allzeit)
- `GET /api/calendar/:userId/:year/:month` - Kalender-Daten

### **Notifications**
- `GET /api/vapid-public-key` - VAPID Public Key
- `POST /api/subscribe` - Push-Subscription registrieren
- `POST /api/send-notification` - Notification versenden
- `POST /api/motivate-all` - Broadcast an alle User

### **Debug**
- `GET /api/test` - API Health Check
- `GET /api/debug/subscriptions` - Push-Subscription Status

---

## 🎯 Lessons Learned & Best Practices

### **PWA Development**
- **Service Worker Caching:** Network-first für Daten, Cache-first für Assets
- **Push Notifications:** Immer VAPID verwenden, nie API Keys in Frontend
- **Installation:** Web Manifest + Service Worker sind Minimum Requirements

### **Fly.io Deployment**
- **Environment Variables:** Nutze `fly secrets set` für sensible Daten
- **HTTPS:** Automatisch durch Fly.io, keine lokalen Zertifikate nötig
- **Database:** PostgreSQL-Addon besser als externe Services
- **Volumes:** Nicht nötig für stateless Apps mit PostgreSQL

### **Cross-Platform Challenges**
- **WSL2 + Windows:** Port-forwarding für LAN-Testing einrichten
- **Push Notifications:** Verschiedene Browser verhalten sich unterschiedlich
- **Service Worker Updates:** Cache-busting durch Versioning

### **Performance Optimizations**
- **Auto-Refresh:** Nur bei User-Inaktivität, nie während Interaktionen
- **API Calls:** Batch-Requests für Leaderboard-Updates
- **Mobile:** Touch-Events für Pull-to-Refresh ohne Frameworks

---

## 🐛 Troubleshooting

### **Push Notifications funktionieren nicht:**
1. Browser-Console auf Fehler prüfen
2. Debug-Tool in App nutzen (`/api/debug/subscriptions`)
3. VAPID Keys korrekt gesetzt?
4. Service Worker registriert?

### **PWA installiert sich nicht:**
1. HTTPS erforderlich (außer localhost)
2. Web Manifest korrekt?
3. Service Worker aktiv?
4. Browser unterstützt PWA?

### **Fly.io Deployment Probleme:**
1. `fly logs` für Error-Details
2. Environment Variables mit `fly secrets list`
3. Database Connection mit `fly postgres connect`

### **WSL2 LAN-Zugriff:**
```powershell
# Windows PowerShell als Admin
netsh interface portproxy add v4tov4 listenport=3001 listenaddress=0.0.0.0 connectport=3001 connectaddress=172.X.X.X
```

---

## 🤝 Contributing

1. Fork das Repository
2. Feature Branch erstellen: `git checkout -b feature/amazing-feature`
3. Änderungen committen: `git commit -m 'Add amazing feature'`
4. Branch pushen: `git push origin feature/amazing-feature`
5. Pull Request erstellen

---

## 📄 License

MIT License - siehe [LICENSE](LICENSE) für Details.

---

## 🙏 Acknowledgments

- **Web Push Protocol** für plattformübergreifende Notifications
- **Fly.io** für einfaches, kostenloses Hosting
- **PostgreSQL Community** für die beste Open-Source Database
- Alle Beta-Tester der Dickerchen-Challenge! 💪
