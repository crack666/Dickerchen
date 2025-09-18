# 🏋️ Multi-Sport Erweiterung - Detaillierter Implementierungsplan

## 🎯 Ziel
Dickerchen von einer reinen Push-up App zu einer Multi-Sport App erweitern mit Push-ups, Squats und Sit-ups.

## 📊 Verfügbare Bilder
✅ **Bereits verschoben nach `/public/`:**
- `pushup_strong.png` / `pushup_weak.png`
- `squats_strong.png` / `squats1_weak.png` 
- `siutps_strong.png` / `situps1_weak.png`

---

## 🗃️ **Phase 1: Datenbank-Migration**

### 1.1 Neue Tabellen erstellen
```sql
-- Squats Tabelle (analog zu pushups)
CREATE TABLE squats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  count INTEGER NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sit-ups Tabelle (analog zu pushups)
CREATE TABLE situps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  count INTEGER NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Migration-Logic im Backend
- Erweitere `initializeDatabase()` Funktion
- Safe Migration mit IF NOT EXISTS
- Logging für neue Tabellen

**Files zu ändern:**
- `backend/server.js` (initializeDatabase Funktion)

---

## 🔄 **Phase 2: Backend API Generalisierung**

### 2.1 Aktueller Zustand analysieren
**Bestehende Push-up Endpunkte:**
- `GET /api/pushups/:userId` - Heutige Push-ups
- `POST /api/pushups` - Push-ups hinzufügen  
- `GET /api/pushups/:userId/total` - Gesamte Push-ups
- `GET /api/pushups/:userId/yearly-potential` - Yearly Potential
- `GET /api/calendar/:userId/:year/:month` - Kalender
- `GET /api/leaderboard` - Leaderboard

### 2.2 Generalisierte API-Struktur
**Option A: Exercise-Parameter (Empfohlen)**
```
GET /api/exercises/:exerciseType/:userId
POST /api/exercises/:exerciseType  
GET /api/exercises/:exerciseType/:userId/total
GET /api/exercises/:exerciseType/:userId/yearly-potential
GET /api/calendar/:exerciseType/:userId/:year/:month
GET /api/leaderboard/:exerciseType
```

**Option B: Backward-Compatible mit Redirect**
- Alte `/api/pushups/*` Routen bleiben
- Neue `/api/exercises/pushups/*` Routen
- Interne Weiterleitung für Kompatibilität

### 2.3 Zentrale Exercise-Helper Funktionen
```javascript
// Neue Helper-Funktionen
function getExerciseTable(exerciseType) {
  const tables = {
    'pushups': 'pushups',
    'squats': 'squats', 
    'situps': 'situps'
  };
  return tables[exerciseType] || null;
}

function validateExerciseType(exerciseType) {
  return ['pushups', 'squats', 'situps'].includes(exerciseType);
}
```

**Files zu ändern:**
- `backend/server.js` (alle Exercise-Endpunkte)

---

## 🎨 **Phase 3: Frontend UI-Erweiterung**

### 3.1 Exercise-Switcher im Header
**Aktuell:**
```html
<div class="header-container">
  <h1>💪 Dickerchen</h1>
</div>
```

**Neu:**
```html
<div class="header-container">
  <div class="exercise-switcher">
    <button class="exercise-btn active" data-exercise="pushups">
      <img src="pushup_strong.png" alt="Push-ups" class="exercise-icon">
      <span>Push-ups</span>
    </button>
    <button class="exercise-btn" data-exercise="squats">
      <img src="squats_strong.png" alt="Squats" class="exercise-icon">
      <span>Squats</span>
    </button>
    <button class="exercise-btn" data-exercise="situps">
      <img src="siutps_strong.png" alt="Sit-ups" class="exercise-icon">
      <span>Sit-ups</span>
    </button>
  </div>
  <h1 id="exercise-title">💪 Push-ups</h1>
</div>
```

### 3.2 Dynamische Ziel-Anzeige
**Goal-Container mit Exercise-spezifischen Bildern:**
```html
<div class="goal-container">
  <img id="exercise-image" src="pushup_weak.png" alt="Exercise" class="exercise-main-image">
  <div class="goal-info">
    <div class="goal-text">Tagesziel: <span id="daily-goal">100</span></div>
    <div class="progress-bar">...</div>
  </div>
</div>
```

### 3.3 Dynamische Action-Buttons
**Quick-Add Buttons mit Exercise-Icons:**
```html
<div class="action-buttons">
  <button class="action-btn" onclick="addExercise(10)">
    <img src="pushup_strong.png" alt="+10" class="btn-icon">
    +10
  </button>
  <button class="action-btn" onclick="addExercise(20)">
    <img src="pushup_strong.png" alt="+20" class="btn-icon">
    +20
  </button>
  <button class="action-btn" onclick="addExercise(30)">
    <img src="pushup_strong.png" alt="+30" class="btn-icon">
    +30
  </button>
</div>
```

**Files zu ändern:**
- `public/index.html` (HTML-Struktur)
- `public/styles.css` (Exercise-Switcher Styling)
- `public/app.js` (Exercise-Switching Logic)

---

## ⚙️ **Phase 4: Frontend JavaScript-Logic**

### 4.1 Globale Exercise-State
```javascript
// Globaler State
let currentExercise = 'pushups';
let currentUserId = 1;

// Exercise-spezifische Konfiguration
const exerciseConfig = {
  pushups: {
    name: 'Push-ups',
    emoji: '💪',
    strongImage: 'pushup_strong.png',
    weakImage: 'pushup_weak.png',
    defaultGoal: 100
  },
  squats: {
    name: 'Squats', 
    emoji: '🦵',
    strongImage: 'squats_strong.png',
    weakImage: 'squats1_weak.png',
    defaultGoal: 100
  },
  situps: {
    name: 'Sit-ups',
    emoji: '🏋️',
    strongImage: 'siutps_strong.png', 
    weakImage: 'situps1_weak.png',
    defaultGoal: 100
  }
};
```

### 4.2 Exercise-Switching Functions
```javascript
function switchExercise(exerciseType) {
  currentExercise = exerciseType;
  updateUI();
  loadCurrentExerciseData();
  saveExercisePreference();
}

function updateUI() {
  const config = exerciseConfig[currentExercise];
  
  // Update Title
  document.getElementById('exercise-title').textContent = 
    `${config.emoji} ${config.name}`;
    
  // Update main image
  updateExerciseImage();
  
  // Update button icons
  updateButtonIcons();
  
  // Update active switcher button
  updateSwitcherButtons();
}
```

### 4.3 Angepasste API-Calls
```javascript
// Generalisierte API-Funktionen
async function addExercise(count) {
  const response = await fetch('/api/exercises/' + currentExercise, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId: currentUserId, 
      count: count 
    })
  });
  // ...
}

async function loadExerciseData() {
  const response = await fetch(`/api/exercises/${currentExercise}/${currentUserId}`);
  // ...
}
```

**Files zu ändern:**
- `public/app.js` (komplette Überarbeitung für Multi-Exercise)

---

## 📱 **Phase 5: UI/UX Verbesserungen**

### 5.1 CSS für Exercise-Switcher
```css
.exercise-switcher {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  justify-content: center;
}

.exercise-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border: 2px solid #ddd;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.exercise-btn.active {
  border-color: #4CAF50;
  background-color: #f0f8f0;
}

.exercise-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 5px;
}
```

### 5.2 Responsive Design
- Mobile-optimierte Exercise-Switcher
- Touch-friendly Button-Größen
- Kompakte Darstellung auf kleinen Screens

**Files zu ändern:**
- `public/styles.css` (Exercise-Switcher + Responsive)

---

## 🔔 **Phase 6: Notifications-Anpassung**

### 6.1 Exercise-spezifische Notifications
```javascript
// notification-manager.js Erweiterung
const exerciseMotivations = {
  pushups: [
    "💪 Zeit für Push-ups! Deine Arme warten...",
    "🔥 Push-up Time! Zeig deine Kraft!",
    // ... bestehende pushup messages
  ],
  squats: [
    "🦵 Squat-Time! Deine Beine brauchen Action!",
    "💥 Kniebeugen machen stark - leg los!",
    "🏋️ Squat-Challenge wartet auf dich!"
  ],
  situps: [
    "🏋️ Sit-up Time! Dein Core wartet!",
    "💪 Bauchmuskel-Training - jetzt oder nie!",
    "🔥 Sit-ups für einen starken Core!"
  ]
};
```

### 6.2 Intelligente Exercise-Detection
- User-präferierte Exercise erkennen
- Notifications für die meist-genutzte Exercise
- Fallback auf Push-ups für Backward-Compatibility

**Files zu ändern:**
- `backend/notification-manager.js`

---

## 📊 **Phase 7: Statistics & Leaderboard**

### 7.1 Exercise-spezifische Statistiken
- Separate Leaderboards pro Exercise
- Combined Leaderboard mit Punktesystem?
- Exercise-spezifische Yearly Potential

### 7.2 Calendar-Integration
- Farbkodierung pro Exercise
- Multi-Exercise Tagesansicht
- Exercise-Filter im Kalender

**Files zu ändern:**
- `public/app.js` (Statistics Functions)
- `backend/server.js` (Leaderboard/Calendar Endpunkte)

---

## 🧪 **Phase 8: Testing & Migration**

### 8.1 Backward Compatibility Testing
- Bestehende Push-up Daten bleiben funktional
- Alte API-Endpunkte weiterhin verfügbar
- Smooth Migration für bestehende User

### 8.2 Database Migration Testing
- Safe Migration ohne Datenverlust
- Rollback-Plan für emergencies
- Performance Testing mit mehreren Tabellen

---

## 🚀 **Implementierungs-Reihenfolge**

### **Sprint 1: Backend Foundation** (1-2 Tage)
1. ✅ Bilder nach `/public/` verschieben
2. Datenbank-Migration (neue Tabellen)
3. Generalisierte API-Endpunkte
4. Backward-Compatibility sicherstellen

### **Sprint 2: Frontend Core** (1-2 Tage)  
5. Exercise-Switcher UI
6. Grundlegende Exercise-Switching Logic
7. API-Integration für neue Endpunkte
8. Basis-Funktionalität testen

### **Sprint 3: Polish & Features** (1 Tag)
9. UI/UX Verbesserungen
10. Exercise-spezifische Images
11. Responsive Design
12. Goal-Achievement Logic

### **Sprint 4: Advanced Features** (Optional)
13. Notifications-Anpassung
14. Statistics-Erweiterung
15. Performance-Optimierung
16. Comprehensive Testing

---

## 🚨 **Risiken & Considerations**

### **Database Performance**
- 3x mehr Tabellen = 3x mehr Queries
- Indexing für Performance
- Connection Pooling prüfen

### **Frontend Complexity**
- State Management wird komplexer
- Exercise-Switching Performance
- Mobile UI/UX Herausforderungen

### **Backward Compatibility**
- Bestehende User nicht verwirren
- Graduelle Einführung überlegen
- Migration-Pfad für User Preferences

### **API Design**
- URL-Struktur konsistent halten
- Versionierung überlegen
- Documentation updaten

---

## ✅ **Erfolgskriterien**

1. ✅ **Functional:** Alle 3 Exercises einzeln trackbar
2. ✅ **UX:** Intuitive Exercise-Umschaltung
3. ✅ **Performance:** Keine Verschlechterung
4. ✅ **Compatibility:** Bestehende Push-up Daten funktionieren
5. ✅ **Mobile:** Touch-friendly auf allen Geräten
6. ✅ **Data:** Separate Statistics pro Exercise

---

Sollen wir mit **Sprint 1** starten? 🚀
