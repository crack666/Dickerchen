// app.js
const API_BASE = 'http://localhost:3001/api';

let userId = localStorage.getItem('userId') || null;
let userName = localStorage.getItem('userName') || null;
let dailyGoal = 100;

document.addEventListener('DOMContentLoaded', async () => {
  await initializeUser();

  // Tab switching
  document.getElementById('tab-today').addEventListener('click', () => switchTab('today'));
  document.getElementById('tab-alltime').addEventListener('click', () => switchTab('alltime'));

  loadProgress();
  loadLeaderboard();

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!userId) {
        alert('Bitte gib erst deinen Namen ein!');
        return;
      }
      // Request notification permission on user interaction
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            subscribeUser();
          }
        });
      }
      addPushup(parseInt(btn.dataset.count));
    });
  });
  
  const slider = document.getElementById('custom-slider');
  const sliderValue = document.getElementById('slider-value');
  slider.addEventListener('input', () => {
    sliderValue.textContent = slider.value;
  });
  
  document.getElementById('add-custom').addEventListener('click', () => {
    if (!userId) {
      alert('Bitte gib erst deinen Namen ein!');
      return;
    }
    const count = parseInt(slider.value);
    if (count > 0) addPushup(count);
  });

  // Modal functionality
  const modal = document.getElementById('user-modal');
  const closeBtn = document.getElementsByClassName('close')[0];
  closeBtn.onclick = () => modal.style.display = 'none';
  window.onclick = (event) => {
    if (event.target === modal) modal.style.display = 'none';
  };

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed'));
  }

  // Initialize calendar navigation
  initCalendarNavigation();

  // Add login button
  const loginBtn = document.createElement('button');
  loginBtn.id = 'login-btn';
  loginBtn.textContent = userId ? `Angemeldet als: ${userName}` : 'Namen eingeben';
  loginBtn.style.position = 'fixed';
  loginBtn.style.top = '10px';
  loginBtn.style.right = '10px';
  loginBtn.style.zIndex = '1000';
  loginBtn.addEventListener('click', () => {
    const newName = prompt('Gib deinen Namen ein:');
    if (newName) {
      createOrLoginUser(newName);
    }
  });
  document.body.appendChild(loginBtn);
});

async function initializeUser() {
  // Initialize UI even without user login
  // No automatic prompting, user must click login button
}

async function createOrLoginUser(name) {
  // Validate name
  if (!name || name.trim() === '' || name === 'undefined' || name === 'null') {
    alert('Bitte gib einen gültigen Namen ein!');
    return;
  }
  
  const trimmedName = name.trim();
  
  // Check if user exists
  const response = await fetch(`${API_BASE}/users`);
  const users = await response.json();
  const existingUser = users.find(u => u.name === trimmedName);
  
  if (existingUser) {
    // User exists, log in
    userId = existingUser.id;
    userName = existingUser.name;
    localStorage.setItem('userId', userId);
    localStorage.setItem('userName', userName);
    alert(`Willkommen zurück, ${userName}!`);
  } else {
    // Create new user
    try {
      const createResponse = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
      
      if (!createResponse.ok) {
        const error = await createResponse.json();
        alert(`Fehler: ${error.error}`);
        return;
      }
      
      const newUser = await createResponse.json();
      userId = newUser.id;
      userName = newUser.name;
      localStorage.setItem('userId', userId);
      localStorage.setItem('userName', userName);
      alert(`Willkommen, ${userName}! Du wurdest neu registriert.`);
    } catch (error) {
      alert('Fehler beim Erstellen des Benutzers. Bitte versuche es erneut.');
      return;
    }
  }
  
  // Update login button
  document.getElementById('login-btn').textContent = `Angemeldet als: ${userName}`;
  
  // Request notification permission after login
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        subscribeUser();
      }
    });
  }
  
  // Reload progress and leaderboard
  loadProgress();
  loadLeaderboard();
}

async function loadProgress() {
  if (!userId) {
    // Show default progress for non-logged users
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-text').textContent = `0 / ${dailyGoal}`;
    document.getElementById('motivation').textContent = 'Melde dich an, um deine Dicken zu tracken! 💪';
    document.getElementById('share-progress').style.display = 'none';
    return;
  }
  
  const response = await fetch(`${API_BASE}/pushups/${userId}`);
  const data = await response.json();
  const progress = (data.total / dailyGoal) * 100;
  document.getElementById('progress-fill').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent = `${data.total} / ${dailyGoal}`;
  
  // Show share button if user has made progress
  const shareBtn = document.getElementById('share-progress');
  if (data.total > 0) {
    shareBtn.style.display = 'block';
    shareBtn.onclick = () => shareProgress(data.total);
  } else {
    shareBtn.style.display = 'none';
  }
  
  // Update motivation message
  updateMotivation(data.total);
}

function updateMotivation(total) {
  const motivationEl = document.getElementById('motivation');
  if (total === 0) {
    motivationEl.textContent = 'Los geht\'s! Mach deine ersten Dicken! 💪';
  } else if (total < 30) {
    motivationEl.textContent = `Gut gemacht! ${total} Dicke geschafft! 🏋️‍♂️`;
  } else if (total < dailyGoal) {
    motivationEl.textContent = `Hammer! Nur noch ${dailyGoal - total} bis zum Ziel! 🔥`;
  } else {
    motivationEl.textContent = `Wow! Tagesziel erreicht! Du bist ein Dicker! 🏆`;
  }
}

function shareProgress(total) {
  const percentage = Math.round((total / dailyGoal) * 100);
  const messages = [
    `💪 Ich habe heute schon ${total} Dicke gemacht! Das sind ${percentage}% meines Tagesziels! #Dickerchen #Fitness`,
    `🏋️‍♂️ ${total} Dicke heute geschafft! Nur noch ${dailyGoal - total} bis zum Ziel! Wer macht mit? #Dickerchen`,
    `🔥 Fortschritt des Tages: ${total}/${dailyGoal} Dicke (${percentage}%)! Motivation pur! #Dickerchen #PushUps`,
    `🚀 ${total} Dicke heute - ich bin auf Kurs! Wer überholt mich? #Dickerchen #Challenge`
  ];
  
  const message = messages[Math.floor(Math.random() * messages.length)];
  
  if (navigator.share) {
    navigator.share({
      title: 'Mein Dickerchen Fortschritt',
      text: message,
      url: window.location.href
    });
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(message).then(() => {
      alert('Fortschritt in Zwischenablage kopiert! 📋');
    }).catch(() => {
      // Ultimate fallback: Show message in alert
      alert(`Teile deinen Fortschritt:\n\n${message}`);
    });
  }
}

async function addPushup(count = 1) {
  await fetch(`${API_BASE}/pushups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, count })
  });
  loadProgress();
  loadLeaderboard();
}

async function loadLeaderboard() {
  const response = await fetch(`${API_BASE}/users`);
  const users = await response.json();
  
  // Get progress for each user
  const userProgress = await Promise.all(users.map(async (user) => {
    const progressRes = await fetch(`${API_BASE}/pushups/${user.id}`);
    const progress = await progressRes.json();
    return { ...user, total: progress.total };
  }));
  
  // Sort by total descending
  userProgress.sort((a, b) => b.total - a.total);
  
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '';
  
  userProgress.forEach((user, index) => {
    const li = document.createElement('li');
    li.className = userId && user.id == userId ? 'you' : '';
    li.innerHTML = `
      <span class="rank">${index + 1}. ${user.name} ${userId && user.id == userId ? '(Du)' : ''}</span>
      <span class="score">${user.total} Dicke</span>
    `;
    li.addEventListener('click', () => openUserModal(user));
    leaderboardList.appendChild(li);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`${tab}-view`).classList.add('active');
  
  if (tab === 'alltime') {
    loadAlltimeStats();
  }
}

async function loadAlltimeStats() {
  // Load total progress
  const totalResponse = await fetch(`${API_BASE}/pushups/${userId || 0}/total`);
  const totalData = await totalResponse.json();
  document.getElementById('total-text').textContent = `${totalData.total} Dicke insgesamt`;
  
  // Load alltime leaderboard
  const usersResponse = await fetch(`${API_BASE}/users`);
  const users = await usersResponse.json();
  
  const userTotals = await Promise.all(users.map(async (user) => {
    const totalRes = await fetch(`${API_BASE}/pushups/${user.id}/total`);
    const total = await totalRes.json();
    return { ...user, total: total.total };
  }));
  
  userTotals.sort((a, b) => b.total - a.total);
  
  const alltimeList = document.getElementById('alltime-leaderboard-list');
  alltimeList.innerHTML = '';
  
  userTotals.forEach((user, index) => {
    const li = document.createElement('li');
    li.className = userId && user.id == userId ? 'you' : '';
    li.innerHTML = `
      <span class="rank">${index + 1}. ${user.name} ${userId && user.id == userId ? '(Du)' : ''}</span>
      <span class="score">${user.total} Dicke</span>
    `;
    li.addEventListener('click', () => openCalendarModal(user));
    alltimeList.appendChild(li);
  });
  
  // Load calendar for current user if logged in
  if (userId) {
    loadCalendar(userId);
  }
}

async function openUserModal(user) {
  document.getElementById('modal-name').textContent = user.name;
  document.getElementById('modal-progress').textContent = `Heutige Dicke: ${user.total}`;
  document.getElementById('modal-log-title').textContent = 'Protokoll heute:';
  
  // Load detailed log
  const response = await fetch(`${API_BASE}/pushups/${user.id}`);
  const data = await response.json();
  const logList = document.getElementById('modal-log');
  logList.innerHTML = '';
  
  data.pushups.forEach(pushup => {
    const li = document.createElement('li');
    const time = new Date(pushup.timestamp).toLocaleTimeString();
    li.textContent = `${time}: ${pushup.count} Dicke`;
    logList.appendChild(li);
  });
  
  // Nudge button
  const nudgeBtn = document.getElementById('nudge-btn');
  nudgeBtn.onclick = () => nudgeUser(user);
  
  document.getElementById('user-modal').style.display = 'block';
}

let currentCalendarDate = new Date();

async function loadCalendar(userId) {
  if (!userId) return;
  
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth() + 1; // Convert to 1-based month
  
  const calendarResponse = await fetch(`${API_BASE}/calendar/${userId}/${year}/${month}`);
  const calendarData = await calendarResponse.json();
  
  const calendarGrid = document.getElementById('calendar-grid');
  calendarGrid.innerHTML = '';
  
  // Update month display
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  document.getElementById('current-month').textContent = 
    `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
  
  // Add day headers
  const dayHeaders = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  dayHeaders.forEach(day => {
    const headerEl = document.createElement('div');
    headerEl.className = 'calendar-header';
    headerEl.textContent = day;
    calendarGrid.appendChild(headerEl);
  });
  
  // Get first day of the month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Add empty cells for days before month starts
  const startDay = firstDay.getDay();
  for (let i = 0; i < startDay; i++) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'calendar-day empty';
    calendarGrid.appendChild(emptyEl);
  }
  
  // Add days of the month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, currentCalendarDate.getMonth(), day);
    const dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    
    const dayData = calendarData.find(d => {
      // Handle both string format "YYYY-MM-DD" and ISO format
      const dbDateStr = d.date.includes('T') ? d.date.split('T')[0] : d.date;
      return dbDateStr === dateStr;
    });
    const total = dayData ? parseInt(dayData.total) : 0;
    
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;
    
    if (date.toDateString() === today.toDateString()) {
      dayEl.classList.add('today');
    }
    
    if (total === 0) {
      dayEl.classList.add('missed');
    } else if (total < dailyGoal) {
      dayEl.classList.add('partial');
    } else {
      dayEl.classList.add('complete');
    }
    
    dayEl.title = `${date.toLocaleDateString()}: ${total} Dicke`;
    calendarGrid.appendChild(dayEl);
  }
}

// Calendar navigation
function initCalendarNavigation() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    if (userId) loadCalendar(userId);
  });
  
  document.getElementById('next-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    if (userId) loadCalendar(userId);
  });
}

async function openCalendarModal(user) {
  // Reuse the existing modal for calendar view
  document.getElementById('modal-name').textContent = `${user.name} - Kalender`;
  document.getElementById('modal-progress').innerHTML = '<div id="modal-calendar"></div>';
  document.getElementById('modal-log-title').textContent = 'Letzte 30 Tage:';
  
  const logList = document.getElementById('modal-log');
  logList.innerHTML = '<p>Klicke auf einen Tag für Details</p>';
  
  // Load calendar data for the current month
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // Convert to 1-based month
  const calendarResponse = await fetch(`${API_BASE}/calendar/${user.id}/${year}/${month}`);
  const calendarData = await calendarResponse.json();
  
  const modalCalendar = document.getElementById('modal-calendar');
  modalCalendar.innerHTML = '';
  
  calendarData.forEach(day => {
    const dayEl = document.createElement('div');
    dayEl.textContent = `${day.date}: ${day.total} Dicken`;
    dayEl.style.margin = '5px 0';
    dayEl.style.padding = '5px';
    dayEl.style.borderRadius = '5px';
    
    if (day.total === 0) {
      dayEl.style.background = '#FF5722';
      dayEl.style.color = 'white';
    } else if (day.total < dailyGoal) {
      dayEl.style.background = '#FF9800';
      dayEl.style.color = 'white';
    } else {
      dayEl.style.background = '#4CAF50';
      dayEl.style.color = 'white';
    }
    
    modalCalendar.appendChild(dayEl);
  });
  
  document.getElementById('user-modal').style.display = 'block';
}

async function nudgeUser(user) {
  const nudgeMessages = [
    `Ey ${user.name}, mach deine Dicken! Ich habe schon ${user.total} gemacht! 💪`,
    `Hey ${user.name}, Zeit für Push-ups! Du bist bei ${user.total}, ich bei [mein total]! 🏋️‍♂️`,
    `Anstupsen! ${user.name}, nur noch [ziel - dein total] bis zum Ziel! 🔥`,
    `Yo ${user.name}, Dicken-Time! Ich bin voraus mit [mein total]! 🚀`,
    `Motivation! ${user.name}, du hast ${user.total} – lass uns pushen! 💥`
  ];
  
  // Get my progress
  const myResponse = await fetch(`${API_BASE}/pushups/${userId}`);
  const myData = await myResponse.json();
  
  let message = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];
  message = message.replace('[mein total]', myData.total);
  message = message.replace('[ziel - dein total]', (dailyGoal - user.total));
  
  // Send notification
  await fetch(`${API_BASE}/send-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, message })
  });
  
  alert(`Notification gesendet: ${message}`);
}

// Push Notification functions
function subscribeUser() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BKgHClYOTs_CiYQUS-L2yTNc3CBQOMLL0bd22oOz5oJ1J0kXZ0UPD5qkSH0IvBk4-BY6cAXAp2kA5bXz6yTP15w')
      }).then(subscription => {
        fetch(`${API_BASE}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, subscription })
        });
      }).catch(err => {
        console.error('Failed to subscribe user:', err);
      });
    });
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
