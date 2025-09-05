// app.js
// API Base URL - simplified for local development
const API_BASE = window.location.hostname === 'dickerchen.fly.dev'
  ? `${window.location.protocol}//${window.location.host}/api`
  : '/api';  // Use relative URLs for local development

console.log('🔗 API_BASE URL:', API_BASE);
console.log('🌐 Window location:', window.location.href);

// Test API connection immediately
fetch(API_BASE + '/test')
  .then(response => response.json())
  .then(data => console.log('✅ API Test successful:', data))
  .catch(error => console.error('❌ API Test failed:', error));

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
  
  // Auto-refresh setup
  setupAutoRefresh();

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

  // Register Service Worker for all environments (needed for push notifications)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('✅ Service Worker registered successfully');
        console.log('� PWA features and push notifications are now available');
      })
      .catch(err => {
        console.error('❌ Service Worker registration failed:', err);
      });
  } else {
    console.warn('⚠️ Service Worker not supported - PWA features unavailable');
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
  // If user is already logged in and has notification permission, try to subscribe
  if (userId && 'Notification' in window && Notification.permission === 'granted') {
    console.log('🔄 User already logged in with notification permission, subscribing...');
    try {
      await subscribeUser();
    } catch (error) {
      console.log('⚠️ Auto-subscription failed (probably already subscribed):', error.message);
    }
  }
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
  
  // Request notification permission and subscribe after login
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      // Permission already granted, subscribe immediately
      console.log('📢 Notification permission already granted, subscribing...');
      subscribeUser();
    } else if (Notification.permission === 'default') {
      // Ask for permission first
      console.log('📢 Requesting notification permission...');
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('📢 Notification permission granted, subscribing...');
          subscribeUser();
        } else {
          console.log('❌ Notification permission denied');
        }
      });
    } else {
      console.log('❌ Notification permission previously denied');
    }
  } else {
    console.log('❌ Notifications not supported in this browser');
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
    li.addEventListener('click', () => openUserModal(user));
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
let currentCalendarUserId = null;

async function loadCalendar(userId) {
  if (!userId) return;
  
  currentCalendarUserId = userId;
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth() + 1; // Convert to 1-based month
  
  const calendarResponse = await fetch(`${API_BASE}/calendar/${userId}/${year}/${month}`);
  const calendarData = await calendarResponse.json();
  
  // Get user name for display
  const userResponse = await fetch(`${API_BASE}/users`);
  const users = await userResponse.json();
  const currentUser = users.find(u => u.id == userId);
  const userName = currentUser ? currentUser.name : 'Unbekannt';
  
  const calendarGrid = document.getElementById('calendar-grid');
  calendarGrid.innerHTML = '';
  
  // Update month display with user name
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  document.getElementById('current-month').textContent = 
    `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()} - ${userName}`;
  
  // Add user selector if not already present
  if (!document.getElementById('calendar-user-selector')) {
    const selectorContainer = document.createElement('div');
    selectorContainer.style.textAlign = 'center';
    selectorContainer.style.margin = '10px 0';
    
    const label = document.createElement('label');
    label.textContent = 'Kalender anzeigen für: ';
    label.style.marginRight = '10px';
    label.style.fontWeight = 'bold';
    
    const userSelector = document.createElement('select');
    userSelector.id = 'calendar-user-selector';
    userSelector.style.padding = '8px 12px';
    userSelector.style.borderRadius = '8px';
    userSelector.style.border = '2px solid #ddd';
    userSelector.style.backgroundColor = 'white';
    userSelector.style.fontSize = '14px';
    userSelector.style.cursor = 'pointer';
    
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.name;
      option.selected = user.id == userId;
      userSelector.appendChild(option);
    });
    
    userSelector.addEventListener('change', (e) => {
      loadCalendar(e.target.value);
    });
    
    selectorContainer.appendChild(label);
    selectorContainer.appendChild(userSelector);
    document.getElementById('current-month').parentNode.insertBefore(selectorContainer, document.getElementById('current-month'));
  } else {
    // Update existing selector
    document.getElementById('calendar-user-selector').value = userId;
  }
  
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
    
    // Check if the date is in the future
    const isFutureDate = date > today;
    
    // Add click event for day details only for past/current days
    if (!isFutureDate) {
      dayEl.addEventListener('click', () => showDayDetails(dateStr, total, dayData));
    }
    
    if (date.toDateString() === today.toDateString()) {
      dayEl.classList.add('today');
    }
    
    // Ensure dailyGoal is defined
    const goalThreshold = dailyGoal || 50;
    
    if (isFutureDate) {
      // Future dates: neutral styling
      dayEl.classList.add('future');
      dayEl.title = `${date.toLocaleDateString()}: Zukünftiger Tag`;
    } else if (total === 0) {
      // Past/today with no push-ups: missed
      dayEl.classList.add('missed');
      dayEl.title = `${date.toLocaleDateString()}: Keine Push-ups`;
    } else if (total < goalThreshold) {
      // Past/today with some push-ups: partial
      dayEl.classList.add('partial');
      dayEl.title = `${date.toLocaleDateString()}: ${total}/${goalThreshold} Push-ups (teilweise)`;
    } else {
      // Past/today with goal reached: complete
      dayEl.classList.add('complete');
      dayEl.title = `${date.toLocaleDateString()}: ${total}/${goalThreshold} Push-ups (erfüllt!)`;
    }
    calendarGrid.appendChild(dayEl);
  }
}

// Show detailed information for a specific day
async function showDayDetails(dateStr, total, dayData) {
  if (!currentCalendarUserId) return;
  
  // Get detailed pushup data for this day
  const detailResponse = await fetch(`${API_BASE}/pushups/${currentCalendarUserId}`);
  const allPushups = await detailResponse.json();
  
  // Filter pushups for the specific date
  const dayPushups = allPushups.pushups ? allPushups.pushups.filter(p => {
    const pushupDate = new Date(p.timestamp).toISOString().split('T')[0];
    return pushupDate === dateStr;
  }) : [];
  
  // Get user name
  const userResponse = await fetch(`${API_BASE}/users`);
  const users = await userResponse.json();
  const currentUser = users.find(u => u.id == currentCalendarUserId);
  const userName = currentUser ? currentUser.name : 'Unbekannt';
  
  // Format date for display
  const displayDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Show in modal
  document.getElementById('modal-name').textContent = `${userName} - ${displayDate}`;
  document.getElementById('modal-progress').innerHTML = `
    <div style="text-align: center; margin: 20px 0;">
      <div style="font-size: 48px; font-weight: bold; color: ${total >= 50 ? '#4CAF50' : total > 0 ? '#FF9800' : '#FF5722'};">
        ${total}
      </div>
      <div style="color: #666; margin-top: 10px;">
        ${total >= 50 ? '🎉 Ziel erreicht!' : total > 0 ? '⚠️ Teilweise erfüllt' : '❌ Kein Training'}
      </div>
    </div>
  `;
  
  document.getElementById('modal-log-title').textContent = 'Einzelne Sets:';
  
  const logList = document.getElementById('modal-log');
  if (dayPushups.length === 0) {
    logList.innerHTML = '<p style="color: #666; font-style: italic;">Keine Push-ups an diesem Tag</p>';
  } else {
    logList.innerHTML = dayPushups.map(p => {
      const time = new Date(p.timestamp).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});
      return `<p><strong>${p.count}</strong> Push-ups um <strong>${time}</strong></p>`;
    }).join('');
  }
  
  document.getElementById('user-modal').style.display = 'block';
}

// Calendar navigation
function initCalendarNavigation() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    if (currentCalendarUserId) loadCalendar(currentCalendarUserId);
  });
  
  document.getElementById('next-month').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    if (currentCalendarUserId) loadCalendar(currentCalendarUserId);
  });
}

async function nudgeUser(user) {
  try {
    const nudgeMessages = [
      `Ey ${user.name}, mach deine Dicken! [sender] hat schon [mein total] gemacht! 💪`,
      `Hey ${user.name}, Zeit für Push-ups! Du bist bei ${user.total}, [sender] bei [mein total]! 🏋️‍♂️`,
      `Anstupsen! ${user.name}, nur noch [ziel - dein total] bis zum Ziel! [sender] pusht mit! 🔥`,
      `Yo ${user.name}, Dicken-Time! [sender] ist voraus mit [mein total]! 🚀`,
      `Motivation! ${user.name}, du hast ${user.total} – [sender] sagt: lass uns pushen! 💥`,
      `${user.name}, du willst den Body? Dann musst du pushen! [sender] ist bei [mein total]! 🔥💪`,
      `Keine Ausreden, ${user.name}! [sender] hat [mein total] geschafft - wo bleibst du? 😤`,
      `${user.name}, der Boden wartet auf dich! [sender] zeigt dir mit [mein total] wie's geht! 🤸‍♂️`,
      `Push it real good, ${user.name}! [sender] ist schon bei [mein total] - catch up! 🎵💪`,
      `${user.name}, Couch-Potato-Modus beenden! [sender] pusht schon mit [mein total]! 🛋️➡️💪`,
      `Alarmstufe Rot, ${user.name}! [sender] dominiert mit [mein total] Push-ups! 🚨`,
      `${user.name}, Zeit für Gainz! [sender] sammelt schon Muskeln mit [mein total]! 🏆`,
      `Hol dir die Dicken, ${user.name}! [sender] ist bei [mein total] - Game on! 🎮💪`,
      `${user.name}, der Schweinehund ruft - aber [sender] antwortet mit [mein total]! 🐕‍🦺`,
      `Push-up Challenge accepted? ${user.name}, [sender] ist bei [mein total]! Challenge! 🏁`
    ];
    
    // Get my progress
    const myResponse = await fetch(`${API_BASE}/pushups/${userId}`);
    const myData = await myResponse.json();
    
    let message = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];
    message = message.replace('[mein total]', myData.total);
    message = message.replace('[ziel - dein total]', Math.max(0, dailyGoal - user.total));
    message = message.replace('[sender]', userName || 'Ein Freund');
    
    console.log('Sending notification to user:', user.id, 'Message:', message);
    
    // Send notification - include sender info
    const response = await fetch(`${API_BASE}/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.id, 
        fromUserId: userId,
        title: 'Dickerchen Anstupser! 💪', 
        body: message 
      })
    });
    
    const result = await response.json();
    console.log('Notification response:', result);
    
    if (response.ok) {
      alert(`Notification erfolgreich gesendet an ${user.name}! 📱`);
    } else {
      alert(`Fehler beim Senden: ${result.error || 'Unbekannter Fehler'}`);
    }
  } catch (error) {
    console.error('Error in nudgeUser:', error);
    alert(`Fehler beim Senden der Notification: ${error.message}`);
  }
}

// Push Notification functions
async function subscribeUser() {
  try {
    console.log('Starting push notification subscription...');
    
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }
    
    if (!('PushManager' in window)) {
      throw new Error('Push notifications not supported');
    }
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }
    
    // Get VAPID public key from server
    const vapidResponse = await fetch(`${API_BASE}/vapid-public-key`);
    const vapidData = await vapidResponse.json();
    console.log('VAPID key received:', vapidData.publicKey);
    
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    console.log('Service worker ready');
    
    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
    });
    
    console.log('Push subscription created:', subscription);
    
    // Check if userId is valid
    if (!userId) {
      console.error('❌ No userId available for push subscription');
      alert('Fehler: Kein Benutzer ausgewählt. Bitte erst einen Benutzer auswählen.');
      return;
    }
    
    console.log('📝 Sending subscription for userId:', userId);
    
    // Send subscription to server
    const subscribeResponse = await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription })
    });
    
    const subscribeResult = await subscribeResponse.json();
    console.log('Subscription sent to server:', subscribeResult);
    
    if (subscribeResponse.ok) {
      console.log('✅ Push notifications successfully enabled!');
    } else {
      throw new Error('Failed to register subscription on server');
    }
    
  } catch (error) {
    console.error('❌ Failed to subscribe to push notifications:', error);
    // Don't show alert to user unless it's critical, as this runs automatically
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

// Debug functions
async function showDebugInfo() {
  try {
    const response = await fetch(`${API_BASE}/debug/subscriptions`);
    const data = await response.json();
    
    document.getElementById('debug-subscriptions').textContent = JSON.stringify(data.subscriptions, null, 2);
    document.getElementById('debug-logs').textContent = JSON.stringify(data.lastLogs, null, 2);
    
    document.getElementById('debug-modal').style.display = 'block';
  } catch (error) {
    alert('Debug-Info konnte nicht geladen werden: ' + error.message);
  }
}

// Debug modal setup
document.getElementById('debug-btn').onclick = showDebugInfo;
document.querySelector('.debug-close').onclick = () => {
  document.getElementById('debug-modal').style.display = 'none';
};

// Test notifications button
document.getElementById('test-notifications-btn').onclick = async () => {
  if (!userId) {
    alert('Bitte erst einloggen!');
    return;
  }
  
  console.log('🔔 Testing notifications manually...');
  
  try {
    // Request permission if needed
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('📢 Notification permission:', permission);
      
      if (permission === 'granted') {
        // Try to subscribe
        await subscribeUser();
        
        // Show updated debug info
        setTimeout(showDebugInfo, 1000);
      } else {
        alert('❌ Notification permission denied');
      }
    } else {
      alert('❌ Notifications not supported in this browser');
    }
  } catch (error) {
    console.error('❌ Test notification error:', error);
    alert('Fehler: ' + error.message);
  }
};

// Auto-refresh functionality
let refreshInterval = null;
let lastUpdateTime = Date.now();

function setupAutoRefresh() {
  // 1. Refresh when page becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('🔄 Page visible again - refreshing data');
      refreshData();
    }
  });

  // 2. Refresh when window gains focus (for desktop)
  window.addEventListener('focus', () => {
    const timeSinceLastUpdate = Date.now() - lastUpdateTime;
    if (timeSinceLastUpdate > 10000) { // Only if >10sec since last update
      console.log('🔄 Window focused - refreshing data');
      refreshData();
    }
  });

  // 3. Periodic refresh every 60 seconds when visible (less aggressive)
  refreshInterval = setInterval(() => {
    if (!document.hidden) {
      refreshData(true); // Silent periodic updates
    }
  }, 60000); // Changed from 30 to 60 seconds

  // 4. Simple pull-to-refresh for mobile
  setupPullToRefresh();
}

async function refreshData(silent = false) {
  try {
    // Don't refresh if user is actively interacting
    if (isUserInteracting()) {
      console.log('⏸️ Skipping refresh - user is interacting');
      return;
    }

    lastUpdateTime = Date.now();
    await Promise.all([
      loadProgress(),
      loadLeaderboard()
    ]);
    
    if (!silent) {
      console.log('✅ Data refreshed successfully');
    }
  } catch (error) {
    console.error('❌ Refresh failed:', error);
  }
}

function isUserInteracting() {
  // Check if user is in a modal
  const modals = ['user-modal', 'login-modal'];
  if (modals.some(id => {
    const modal = document.getElementById(id);
    return modal && modal.style.display === 'block';
  })) {
    return true;
  }

  // Check if user is typing
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    return true;
  }

  // Check if user is in calendar view
  const calendarModal = document.getElementById('user-modal');
  if (calendarModal && calendarModal.style.display === 'block') {
    return true;
  }

  return false;
}

function setupPullToRefresh() {
  let startY = 0;
  let isPulling = false;
  const threshold = 100;

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      isPulling = true;
    }
  });

  document.addEventListener('touchmove', (e) => {
    if (isPulling && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;
      
      if (pullDistance > threshold) {
        // Visual feedback could be added here
        document.body.style.background = 'linear-gradient(to bottom, #e3f2fd, #ffffff)';
      }
    }
  });

  document.addEventListener('touchend', (e) => {
    if (isPulling) {
      const endY = e.changedTouches[0].clientY;
      const pullDistance = endY - startY;
      
      if (pullDistance > threshold && window.scrollY === 0) {
        console.log('📱 Pull-to-refresh triggered');
        refreshData();
        
        // Show brief feedback
        const feedback = document.createElement('div');
        feedback.textContent = '🔄 Aktualisiere...';
        feedback.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4caf50;color:white;padding:8px 16px;border-radius:20px;z-index:1000;';
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 2000);
      }
      
      // Reset visual feedback
      document.body.style.background = '';
      isPulling = false;
    }
  });
}
