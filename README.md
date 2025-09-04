# Dickerchen 💪

Eine einfache, spaßige Motivations-App für Push-ups mit Push-Erinnerungen und Gemeinschaftsgefühl.

## Features

- 📱 **Progressive Web App (PWA)** - Installierbar auf Handy und Desktop
- 💪 **Push-up Tracking** - Einfache Erfassung deiner täglichen Push-ups (10, 20, 30 oder eigene Anzahl)
- 🏆 **Gamification** - Tagesziele, Erfolge und Leaderboard
- 📅 **Kalender** - Visualisierung deines Fortschritts über Monate
- 🔔 **Push-Notifications** - Motivierende Erinnerungen
- 👥 **Social Features** - Vergleiche dich mit Freunden im Leaderboard
- 🎯 **Anstupsen** - Motiviere deine Freunde mit Nachrichtenen

Eine spaßige PWA zur Motivation für Liegestütze („Dicke“).

## Features

- Erfasse deine täglichen Liegestütze (10, 20, 30 oder eigene Anzahl)
- Sieh deinen Fortschritt zum Tagesziel
- Vergleiche dich mit Freunden
- Erhalte Push-Benachrichtigungen für Motivation
- Mobile-first Design
- Persistente Daten mit PostgreSQL

## Lokale Entwicklung

1. PostgreSQL starten:
   ```
   docker run --name dickerchen-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=dickerchen -p 5432:5432 -d postgres:15
   ```

2. Backend starten:
   ```
   cd backend
   npm install
   npm start
   ```

3. Öffne http://localhost:3001 im Browser.

## Deployment auf fly.io

1. flyctl installieren und anmelden:
   ```
   curl -L https://fly.io/install.sh | sh
   export PATH="$HOME/.fly/bin:$PATH"
   fly auth login
   ```

2. App deployen:
   ```
   fly launch
   fly deploy
   ```

3. Datenbank hinzufügen (optional):
   ```
   fly postgres create
   fly postgres attach <db-name>
   ```

## Technologien

- Frontend: Vanilla JS, PWA
- Backend: Node.js, Express, PostgreSQL
- Deployment: Docker, fly.io
