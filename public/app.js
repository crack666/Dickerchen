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
let previousUserId = null; // Track previous user for cleanup decisions
let dailyGoal = 180; // Default combined goal, will be updated from API

// Exercise state management
let currentExercise = localStorage.getItem('currentExercise') || 'pushups';
let currentPushups = 0;

// Exercise configuration
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
    defaultGoal: 30
  },
  situps: {
    name: 'Sit-ups',
    emoji: '🏋️',
    strongImage: 'siutps_strong.png', 
    weakImage: 'situps1_weak.png',
    defaultGoal: 50
  },
  combined: {
    name: 'Combined',
    emoji: '🎯',
    strongImage: null,
    weakImage: null,
    defaultGoal: 180
  }
};

// Emoji celebration function - defined globally
function createEmojiCelebration(count) {
  // Detect if we're on mobile/small screen
  const isMobile = window.innerWidth < 768;
  const isSmallScreen = window.innerHeight < 600;

  // Reduce emoji count for smaller screens
  const baseCount = isMobile ? Math.min(count / 15 + 1, 4) : Math.min(count / 10 + 2, 6);
  const emojiCount = Math.floor(baseCount);

  // Shorter duration for mobile
  const animationDuration = isMobile ? 1800 : 2500;

  const emojiMap = {
    10: ['💪', '🏋️', '🔥', '⚡'],
    20: ['💪💪', '🏋️‍♂️', '🔥🔥', '⚡⚡', '🚀'],
    30: ['💪💪💪', '🏋️‍♀️', '🔥🔥🔥', '⚡⚡⚡', '🚀🚀', '💥']
  };

  const emojis = emojiMap[count] || ['💪', '🔥', '⚡'];

  for (let i = 0; i < emojiCount; i++) {
    setTimeout(() => {
      const emoji = document.createElement('div');
      emoji.className = 'emoji-celebration';
      emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];

      // More controlled starting positions - centered and away from edges
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Random offset from center, but keep within safe bounds
      const maxOffsetX = Math.min(window.innerWidth * 0.25, 150); // Max 25% of screen or 150px
      const maxOffsetY = Math.min(window.innerHeight * 0.2, 100);  // Max 20% of screen or 100px

      const offsetX = (Math.random() - 0.5) * maxOffsetX * 2; // -maxOffset to +maxOffset
      const offsetY = (Math.random() - 0.5) * maxOffsetY * 2;

      const startX = Math.max(50, Math.min(window.innerWidth - 50, centerX + offsetX));
      const startY = Math.max(100, Math.min(window.innerHeight - 100, centerY + offsetY));

      emoji.style.left = startX + 'px';
      emoji.style.top = startY + 'px';

      document.body.appendChild(emoji);

      // Remove emoji after animation
      setTimeout(() => {
        if (emoji.parentNode) {
          emoji.parentNode.removeChild(emoji);
        }
      }, animationDuration);
    }, i * (isMobile ? 150 : 100)); // Slower stagger on mobile
  }
}

// Exercise switching functions
function switchExercise(exerciseType) {
  console.log(`🔄 Switching to exercise: ${exerciseType}`);
  
  currentExercise = exerciseType;
  localStorage.setItem('currentExercise', exerciseType);
  
  updateExerciseUI();
  loadProgress(); // Reload data for new exercise
}

function updateExerciseUI() {
  const config = exerciseConfig[currentExercise];
  
  // Update title
  const titleEl = document.getElementById('exercise-title');
  if (titleEl) {
    titleEl.textContent = `${config.emoji} ${config.name}`;
  }
  
  // Update progress title
  const progressTitleEl = document.getElementById('progress-title');
  if (progressTitleEl) {
    if (currentExercise === 'combined') {
      progressTitleEl.textContent = 'Dein Fortschritt heute: Alle Übungen';
    } else {
      progressTitleEl.textContent = `Dein Fortschritt heute: ${config.name}`;
    }
  }
  
  // Update active switcher button
  document.querySelectorAll('.exercise-btn').forEach(btn => {
    btn.classList.remove('active', 'current-exercise');
    if (btn.dataset.exercise === currentExercise) {
      btn.classList.add('active', 'current-exercise');
    }
  });
  
  // Update combined button active state
  const combinedBtn = document.getElementById('combined-btn');
  if (combinedBtn) {
    if (currentExercise === 'combined') {
      combinedBtn.classList.add('active');
    } else {
      combinedBtn.classList.remove('active');
    }
  }
  
  // Update goal based on current exercise
  if (currentExercise === 'combined') {
    dailyGoal = config.defaultGoal; // 100 for combined
  } else {
    dailyGoal = config.defaultGoal; // Individual goals (40, 30, 30)
  }
  
  // Update visual elements
  updateExerciseImages();
  updateAddButtonImages();
  
  console.log(`🎯 Updated daily goal to: ${dailyGoal} for ${currentExercise}`);
}

// Update exercise images based on progress and context
async function updateExerciseImages(allExerciseData = null) {
  // If no data provided, fetch current progress for all exercises
  if (!allExerciseData && userId) {
    try {
      const response = await fetch(`${API_BASE}/exercises/combined/${userId}`);
      allExerciseData = await response.json();
    } catch (error) {
      console.warn('Could not fetch exercise data for image updates:', error);
      return;
    }
  }
  
  document.querySelectorAll('.exercise-btn').forEach(btn => {
    const exerciseType = btn.dataset.exercise;
    const config = exerciseConfig[exerciseType];
    const img = btn.querySelector('.exercise-icon');
    
    if (config && img && allExerciseData) {
      let exerciseTotal = 0;
      let goalReached = false;
      
      // Support both formats: breakdown format and detailed format
      if (allExerciseData.breakdown && allExerciseData.breakdown[exerciseType]) {
        // Format from /exercises/combined/:userId (with breakdown)
        const exerciseData = allExerciseData.breakdown[exerciseType];
        exerciseTotal = exerciseData.total || 0;
        goalReached = exerciseData.hasReachedGoal || false;
      } else if (allExerciseData[exerciseType]) {
        // Format from /exercises/combined/:userId/details (with arrays)
        exerciseTotal = Array.isArray(allExerciseData[exerciseType]) 
          ? allExerciseData[exerciseType].reduce((sum, item) => sum + item.count, 0)
          : 0;
        
        // Check if daily goal is reached for THIS specific exercise
        const exerciseGoal = config.defaultGoal;
        goalReached = exerciseTotal >= exerciseGoal;
      }
      
      // Use strong image if goal is reached, otherwise weak
      const imageSrc = (goalReached && config.strongImage) ? config.strongImage : config.weakImage;
      
      if (imageSrc && img.src !== imageSrc) {
        img.src = imageSrc;
        console.log(`🖼️ Updated ${exerciseType} image to ${imageSrc} (${exerciseTotal} total - goal reached: ${goalReached})`);
      }
    }
  });
}

// Update add-button images based on current exercise and count
function updateAddButtonImages() {
  const config = exerciseConfig[currentExercise];
  
  document.querySelectorAll('.add-btn').forEach(btn => {
    const count = parseInt(btn.dataset.count);
    
    if (config && config.strongImage) {
      // Remove existing content and create new structure
      btn.innerHTML = '';
      
      // Create image element that fills the whole button
      const imgElement = document.createElement('img');
      imgElement.src = config.strongImage;
      imgElement.alt = config.name;
      imgElement.classList.add('add-btn-icon');
      
      // Create text overlay element
      const textSpan = document.createElement('span');
      textSpan.textContent = `+${count}`;
      
      // Add both elements (image as background, text as overlay)
      btn.appendChild(imgElement);
      btn.appendChild(textSpan);
      
      console.log(`🖼️ Updated add-button ${count} with full-size image: ${config.strongImage}`);
    }
  });
}

function setupExerciseSwitcher() {
  // Handle exercise switcher buttons
  document.querySelectorAll('.exercise-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const exerciseType = btn.dataset.exercise;
      switchExercise(exerciseType);
    });
  });
  
  // Handle combined button in header
  const combinedBtn = document.getElementById('combined-btn');
  if (combinedBtn) {
    combinedBtn.addEventListener('click', () => {
      switchExercise('combined');
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeUser();
  
  // Initialize exercise switcher
  setupExerciseSwitcher();
  updateExerciseUI(); // Set initial UI state

  // Tab switching
  document.getElementById('tab-today').addEventListener('click', () => switchTab('today'));
  document.getElementById('tab-alltime').addEventListener('click', () => switchTab('alltime'));

  loadProgress();
  loadLeaderboard();
  
  // Auto-refresh setup
  setupAutoRefresh();

  // Debug: Check if add buttons exist
  const addButtons = document.querySelectorAll('.add-btn');
  console.log(`🔍 Found ${addButtons.length} add buttons:`, addButtons);
  
  addButtons.forEach((btn, index) => {
    console.log(`Button ${index + 1}:`, btn, 'data-count:', btn.dataset.count);
  });

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      console.log('🔥 Add button clicked!', btn.dataset.count, 'Button element:', btn); // Debug log
      console.log('🔥 Event object:', e);
      console.log('🔥 Current userId:', userId);
      
      if (!userId) {
        alert('Bitte gib erst deinen Namen ein!');
        return;
      }
      // Request notification permission on user interaction
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            subscribeToPushNotifications();
          }
        });
      }
      console.log('🚀 Adding pushups:', parseInt(btn.dataset.count)); // Debug log
      addPushup(parseInt(btn.dataset.count));
    });
  });
  
  // Progress bar slider functionality
  const progressSlider = document.getElementById('progress-slider');
  const progressText = document.getElementById('progress-text');
  const progressFill = document.getElementById('progress-fill');
  const saveBtn = document.getElementById('save-progress');
  let currentPushups = 0;
  let isSliding = false;
  let sliderInitialized = false;
  
  // Initialize slider with current progress - make this globally accessible
  window.initializeSlider = function() {
    // Prevent multiple simultaneous initializations
    if (window.isInitializingSlider) {
      console.log('⏸️ Slider initialization already in progress, skipping...');
      return;
    }
    
    window.isInitializingSlider = true;
    
    // Get the MOST current value to avoid race conditions
    currentPushups = getCurrentPushups();
    console.log(`🎯 Initializing slider: currentPushups = ${currentPushups}`);
    
    // Double-check we have valid data before proceeding
    if (currentPushups === undefined || currentPushups === null || isNaN(currentPushups)) {
      console.warn('⚠️ currentPushups is invalid, delaying initialization');
      window.isInitializingSlider = false;
      setTimeout(() => window.initializeSlider(), 100);
      return;
    }
    
    // Set strict boundaries
    progressSlider.min = currentPushups; // Can't go below current progress
    progressSlider.max = dailyGoal;
    progressSlider.value = currentPushups;
    
    // Mark as initialized BEFORE updating display
    sliderInitialized = true;
    
    // Force update to ensure everything is in sync
    updateSliderDisplay();
    
    // Clear the initialization flag
    window.isInitializingSlider = false;
    
    console.log(`✅ Slider initialized: min=${progressSlider.min}, max=${progressSlider.max}, value=${progressSlider.value}`);
  };
  
  // Update both progress fill and slider position
  function updateSliderDisplay() {
    const sliderValue = parseInt(progressSlider.value);
    const progress = Math.min((sliderValue / dailyGoal) * 100, 100); // Cap at 100%
    
    // Update progress fill to match slider
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${sliderValue} / ${dailyGoal}`;
    
    // Show/hide save button
    if (sliderValue !== currentPushups) {
      saveBtn.classList.add('visible');
    } else {
      saveBtn.classList.remove('visible');
    }
  }
  
  // Slider input event - with additional safety checks
  progressSlider.addEventListener('input', () => {
    // Don't allow changes until properly initialized
    if (!sliderInitialized) {
      console.log('Slider not yet initialized, blocking input');
      progressSlider.value = 0; // Reset to safe value
      return;
    }
    
    isSliding = true;
    const sliderValue = parseInt(progressSlider.value);
    
    // Get fresh current value to be absolutely sure
    const freshCurrentPushups = getCurrentPushups();
    
    // HARD enforce minimum - can't go below current progress
    if (sliderValue < freshCurrentPushups) {
      console.log(`Preventing slider below minimum: ${sliderValue} < ${freshCurrentPushups}`);
      progressSlider.value = freshCurrentPushups;
      progressSlider.min = freshCurrentPushups; // Re-enforce min attribute
      updateSliderDisplay();
      return;
    }
    
    updateSliderDisplay();
  });
  
  // Additional enforcement on change event
  progressSlider.addEventListener('change', () => {
    // Don't allow changes until properly initialized
    if (!sliderInitialized) {
      console.log('Slider not yet initialized, blocking change');
      progressSlider.value = 0; // Reset to safe value
      return;
    }
    
    const sliderValue = parseInt(progressSlider.value);
    const freshCurrentPushups = getCurrentPushups();
    
    if (sliderValue < freshCurrentPushups) {
      console.log(`Change event: Resetting slider to minimum: ${freshCurrentPushups}`);
      progressSlider.value = freshCurrentPushups;
      progressSlider.min = freshCurrentPushups; // Re-enforce min attribute
      updateSliderDisplay();
    }
  });
  
  // Prevent slider interaction until properly initialized
  progressSlider.addEventListener('mousedown', (e) => {
    if (!sliderInitialized) {
      console.log('Slider not initialized, preventing mousedown');
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    isSliding = true;
  });
  
  progressSlider.addEventListener('touchstart', (e) => {
    if (!sliderInitialized) {
      console.log('Slider not initialized, preventing touchstart');
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    isSliding = true;
  });
  
  // Reset on blur only if not actively interacting
  progressSlider.addEventListener('blur', () => {
    setTimeout(() => {
      if (isSliding) {
        resetSlider();
      }
    }, 100); // Small delay to allow save button click
  });
  
  function resetSlider() {
    console.log(`Resetting slider from isSliding=${isSliding}`);
    isSliding = false;
    
    // Get fresh current value
    const freshCurrentPushups = getCurrentPushups();
    currentPushups = freshCurrentPushups;
    
    // Re-enforce boundaries after reset
    progressSlider.min = currentPushups;
    progressSlider.value = currentPushups;
    updateSliderDisplay();
    saveBtn.classList.remove('visible');
    
    console.log(`Slider reset to: min=${progressSlider.min}, value=${progressSlider.value}`);
  }
  
  // Save button with proper event handling
  document.getElementById('save-progress').addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent blur event
  });
  
  document.getElementById('save-progress').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId) {
      alert('Bitte gib erst deinen Namen ein!');
      resetSlider();
      return;
    }
    
    const newTotal = parseInt(progressSlider.value);
    const oldTotal = currentPushups;
    const toAdd = newTotal - oldTotal; // Calculate difference (what to add)
    
    console.log(`Save attempt: newTotal=${newTotal}, oldTotal=${oldTotal}, toAdd=${toAdd}`);
    
    // SAFETY NET: Prevent saving if new total is below current total
    if (newTotal < oldTotal) {
      console.warn(`SAFETY NET TRIGGERED: Attempted to save ${newTotal} which is below current ${oldTotal}`);
      alert(`Fehler: Du kannst nicht unter deinen aktuellen Wert von ${oldTotal} gehen!`);
      resetSlider();
      return;
    }
    
    if (toAdd > 0) {
      isSliding = false; // Prevent reset during save
      addPushup(toAdd); // Add only the difference, not the total
      
      // Update current pushups immediately to prevent double-save
      currentPushups = newTotal;
      saveBtn.classList.remove('visible');
    } else if (toAdd === 0) {
      // No change, just reset
      resetSlider();
    } else {
      // This should never happen due to safety net above, but just in case
      console.error(`Unexpected negative toAdd value: ${toAdd}`);
      resetSlider();
    }
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
        
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available
                console.log('🔄 New app version available!');
                showUpdateNotification();
              }
            });
          }
        });
        
        // Force immediate check for updates
        reg.update();
      })
      .catch(err => {
        console.error('❌ Service Worker registration failed:', err);
      });
  } else {
    console.warn('⚠️ Service Worker not supported - PWA features unavailable');
  }
  
  // Function to show update notification
  function showUpdateNotification() {
    const updateBanner = document.createElement('div');
    updateBanner.id = 'update-banner';
    updateBanner.innerHTML = `
      <div style="background: #2196F3; color: white; padding: 10px; text-align: center; position: fixed; top: 0; left: 0; right: 0; z-index: 9999; font-size: 14px;">
        🔄 Neue Version verfügbar! 
        <button onclick="location.reload()" style="background: white; color: #2196F3; border: none; padding: 5px 10px; margin-left: 10px; border-radius: 5px; cursor: pointer;">
          Jetzt aktualisieren
        </button>
        <button onclick="this.parentElement.parentElement.remove()" style="background: transparent; color: white; border: 1px solid white; padding: 5px 10px; margin-left: 5px; border-radius: 5px; cursor: pointer;">
          Später
        </button>
      </div>
    `;
    document.body.appendChild(updateBanner);
  }
  
  // Listen for Service Worker messages (safely)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      try {
        if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
          console.log('🔄 Service Worker says update available!');
          // Only show update notification if no banner exists already
          if (!document.getElementById('update-banner')) {
            showUpdateNotification();
          }
        }
      } catch (e) {
        console.log('Service Worker message handling failed (non-critical):', e);
      }
    });
  }

  // Initialize calendar navigation
  initCalendarNavigation();

  // Add login button
  const loginBtn = document.createElement('button');
  loginBtn.id = 'login-btn';
  loginBtn.textContent = userId ? `${userName}` : 'Login';
  loginBtn.addEventListener('click', () => {
    const newName = prompt('Gib deinen Namen ein:');
    if (newName) {
      createOrLoginUser(newName);
    }
  });
  
  document.body.appendChild(loginBtn);

  // Goals management event listener
  document.getElementById('save-goals-btn').addEventListener('click', () => {
    if (userId) {
      saveUserGoals(userId);
    }
  });
});

async function initializeUser() {
  // If user is already logged in and has notification permission, try to subscribe
  if (userId && 'Notification' in window && Notification.permission === 'granted') {
    console.log('🔄 User already logged in with notification permission, subscribing...');
    try {
      await subscribeToPushNotifications();
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
  document.getElementById('login-btn').textContent = `${userName}`;
  
  // Clean up old push subscriptions ONLY if user actually changed
  if (previousUserId && previousUserId !== userId) {
    console.log('🔄 User changed from', previousUserId, 'to', userId, '- cleaning up old subscriptions');
    await cleanupOldSubscriptions();
  } else if (!previousUserId) {
    console.log('🔄 First user login - cleaning up any old subscriptions');
    await cleanupOldSubscriptions();
  }
  
  // Update previous user tracking
  previousUserId = userId;
  
  // Request notification permission and subscribe after login
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      // Permission already granted, subscribe immediately
      console.log('📢 Notification permission already granted, subscribing...');
      if (userId) {
        subscribeToPushNotifications();
      } else {
        console.log('⚠️ No userId available, skipping subscription');
      }
    } else if (Notification.permission === 'default') {
      // Ask for permission first
      console.log('📢 Requesting notification permission...');
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('📢 Notification permission granted, subscribing...');
          subscribeToPushNotifications();
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

function updateCombinedBreakdown(breakdown) {
  // Add breakdown display to show individual exercise progress
  // This could be shown in the motivation text or a separate area
  const motivationEl = document.getElementById('motivation');
  if (motivationEl && breakdown) {
    const parts = [];
    Object.entries(breakdown).forEach(([exercise, data]) => {
      const config = exerciseConfig[exercise];
      const icon = data.hasReachedGoal ? '✅' : '⏳';
      parts.push(`${config.emoji} ${data.total}/${data.goal} ${icon}`);
    });
    motivationEl.textContent = parts.join(' | ');
  }
}

async function loadProgress() {
  if (!userId) {
    // Show default progress for non-logged users
    updateProgressDisplay(0);
    document.getElementById('motivation').textContent = 'Melde dich an, um deine Dicken zu tracken! 💪';
    document.getElementById('share-progress').style.display = 'none';
    return;
  }
  
  console.log('🔄 loadProgress called for userId:', userId, 'exercise:', currentExercise);
  
  let response, data;
  
  if (currentExercise === 'combined') {
    // Load combined data
    response = await fetch(`${API_BASE}/exercises/combined/${userId}`);
    data = await response.json();
    
    console.log('📊 Combined data received:', data);
    
    // Store current total for slider functionality
    window.currentPushups = data.combinedTotal;
    
    // Update global dailyGoal with personalized goal
    dailyGoal = data.dailyGoal;
    
    updateProgressDisplay(data.combinedTotal);
    updateCombinedBreakdown(data.breakdown);
    
  } else {
    // Load individual exercise data first
    response = await fetch(`${API_BASE}/exercises/${currentExercise}/${userId}`);
    data = await response.json();
    
    console.log('📊 Individual exercise data received:', data);
    
    const total = Array.isArray(data) ? data.reduce((sum, item) => sum + item.count, 0) : 0;
    
    // Store current total for slider functionality
    window.currentPushups = total;
    
    // Get personalized goal for this specific exercise
    try {
      const goalsResponse = await fetch(`${API_BASE}/users/${userId}/goals`);
      const goals = await goalsResponse.json();
      dailyGoal = goals[currentExercise] || exerciseConfig[currentExercise].defaultGoal;
    } catch (error) {
      console.warn('Could not load personalized goals, using default:', error);
      dailyGoal = exerciseConfig[currentExercise].defaultGoal;
    }
    
    updateProgressDisplay(total);
  }
  
  // Initialize slider AFTER we have the correct currentPushups value
  if (typeof window.initializeSlider === 'function') {
    console.log('🎯 Calling initializeSlider with currentPushups:', window.currentPushups);
    window.initializeSlider();
  } else {
    console.error('initializeSlider function not found!');
  }
  
  // Show share button if user has made progress
  const shareBtn = document.getElementById('share-progress');
  if (window.currentPushups > 0) {
    shareBtn.style.display = 'block';
    shareBtn.onclick = () => shareProgress(window.currentPushups);
  } else {
    shareBtn.style.display = 'none';
  }
  
  // Update motivation message
  updateMotivation(data.total);
  
  // Update exercise images based on progress - pass the full data for combined, null for individual
  if (currentExercise === 'combined') {
    updateExerciseImages(data); // data already contains all exercise breakdowns
  } else {
    updateExerciseImages(); // will fetch combined data internally
  }
}

function updateProgressDisplay(total = null) {
  const currentTotal = total !== null ? total : getCurrentPushups();
  const progress = Math.min((currentTotal / dailyGoal) * 100, 100); // Cap at 100%
  document.getElementById('progress-fill').style.width = `${progress}%`;
  document.getElementById('progress-text').textContent = `${currentTotal} / ${dailyGoal}`;
}

function getCurrentPushups() {
  return window.currentPushups || 0;
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
  console.log(`🚀 addPushup called with count: ${count}, userId: ${userId}, exercise: ${currentExercise}`);
  
  // Don't allow adding to combined view
  if (currentExercise === 'combined') {
    alert('Bitte wähle eine spezifische Übung aus, um sie hinzuzufügen!');
    return;
  }
  
  // Prevent multiple simultaneous requests
  if (window.isAddingPushup) {
    console.log('⏸️ AddPushup already in progress, ignoring request');
    return;
  }
  
  window.isAddingPushup = true;
  
  try {
    const response = await fetch(`${API_BASE}/exercises/${currentExercise}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, count })
    });
    
    console.log(`📡 add${currentExercise} response status: ${response.status}`);
    
    if (response.ok) {
      console.log(`✅ add${currentExercise} successful, reloading data...`);
      
      // Update data in sequence to avoid race conditions
      await loadProgress();
      await loadLeaderboard();
      
      console.log('🔄 Data refresh completed');
      
      // 🎉 Create emoji celebration!
      createEmojiCelebration(count);
    } else {
      console.error(`❌ Failed to add ${currentExercise}, response:`, response);
      // Reset slider on error
      if (typeof resetSlider === 'function') {
        resetSlider();
      }
    }
  } catch (error) {
    console.error(`❌ add${currentExercise} error:`, error);
  } finally {
    window.isAddingPushup = false;
  }
}

async function loadLeaderboard() {
  try {
    // Use combined leaderboard endpoint that sums all exercises
    const response = await fetch(`${API_BASE}/leaderboard/combined`);
    
    if (response.ok) {
      // Use new backend-calculated combined leaderboard
      const userProgress = await response.json();
      renderLeaderboard(userProgress);
    } else {
      // Fallback to old logic if new endpoint not available
      console.log('Combined leaderboard endpoint not available, falling back to old logic');
      await loadLeaderboardFallback();
    }
  } catch (error) {
    console.log('Error loading combined leaderboard, falling back to old logic:', error);
    await loadLeaderboardFallback();
  }
}

async function loadLeaderboardFallback() {
  const response = await fetch(`${API_BASE}/users`);
  const users = await response.json();
  
  // Get progress for each user with detailed push-up data
  const userProgress = await Promise.all(users.map(async (user) => {
    const progressRes = await fetch(`${API_BASE}/pushups/${user.id}`);
    const progress = await progressRes.json();
    
    // Calculate when user reached the daily goal (100)
    let goalReachedAt = null;
    let runningTotal = 0;
    
    if (progress.pushups && progress.pushups.length > 0) {
      // Sort pushups by timestamp to find when goal was reached
      const sortedPushups = progress.pushups.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      for (const pushup of sortedPushups) {
        runningTotal += pushup.count;
        if (runningTotal >= dailyGoal && !goalReachedAt) {
          goalReachedAt = new Date(pushup.timestamp);
          break;
        }
      }
    }
    
    return { 
      ...user, 
      total: progress.total,
      goalReachedAt: goalReachedAt,
      hasReachedGoal: progress.total >= dailyGoal
    };
  }));
  
  // Smart sorting: 
  // 1. Those who reached goal sorted by time (earliest first)
  // 2. Those who haven't reached goal sorted by total (highest first)
  userProgress.sort((a, b) => {
    // Both reached goal: sort by time
    if (a.hasReachedGoal && b.hasReachedGoal) {
      return a.goalReachedAt - b.goalReachedAt;
    }
    
    // Only one reached goal: goal winner goes first
    if (a.hasReachedGoal && !b.hasReachedGoal) return -1;
    if (!a.hasReachedGoal && b.hasReachedGoal) return 1;
    
    // Neither reached goal: sort by total (highest first)
    return b.total - a.total;
  });
  
  renderLeaderboard(userProgress);
}

function renderLeaderboard(userProgress) {
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '';
  
  userProgress.forEach((user, index) => {
    const li = document.createElement('li');
    li.className = userId && user.id == userId ? 'you' : '';
    
    // Use today_total from combined endpoint or fall back to total for legacy
    const userTotal = user.today_total !== undefined ? user.today_total : user.total;
    
    // Add visual indicator for goal achievement
    let achievementIcon = '';
    if (user.hasReachedGoal) {
      if (index === 0) {
        achievementIcon = ' 🏆'; // Winner crown for first to reach goal
      } else {
        achievementIcon = ' ✅'; // Checkmark for others who reached goal
      }
    }
    
    // Time info handling for both formats
    let timeInfo = '';
    if (user.hasReachedGoal && user.goalReachedAt) {
      // Extract time directly from Berlin timestamp
      const timestamp = user.goalReachedAt;
      const timePart = timestamp.substring(11, 16);
      timeInfo = ` (um ${timePart})`;
    }
    
    // Show breakdown tooltip for combined leaderboard
    let breakdownInfo = '';
    /*if (user.breakdown) {
      const { pushups, squats, situps } = user.breakdown;
      if (pushups > 0 || squats > 0 || situps > 0) {
        const parts = [];
        if (pushups > 0) parts.push(`💪 ${pushups}`);
        if (squats > 0) parts.push(`🦵 ${squats}`);
        if (situps > 0) parts.push(`🏋️ ${situps}`);
        breakdownInfo = ` (${parts.join(', ')})`;
      }
    }*/
    
    li.innerHTML = `
      <span class="rank">${index + 1}. ${user.name} ${userId && user.id == userId ? '(Du)' : ''}${achievementIcon}</span>
      <span class="score">${userTotal} Dicke${breakdownInfo}${timeInfo}</span>
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
  
  // Load yearly potential if user is logged in
  if (userId) {
    try {
      const potentialResponse = await fetch(`${API_BASE}/pushups/${userId}/yearly-potential`);
      const potentialData = await potentialResponse.json();
      const potentialElement = document.getElementById('yearly-potential-text');
      if (potentialElement) {
        const remainingDays = 365 - potentialData.daysSinceFirst;
        const deficit = potentialData.deficit || 0;
        const yearlyPotential = potentialData.yearlyPotential;
        
        let message = '';
        let statusIcon = '';
        let statusColor = '';
        
        if (deficit === 0) {
          // Perfect on track
          statusIcon = '🎯';
          statusColor = '#27ae60';
          message = `${statusIcon} <span style="color: ${statusColor}; font-weight: bold;">Perfekt auf Kurs für ${yearlyPotential} Dicke!</span>`;
        } else if (yearlyPotential > 36500) {
          // Overcompensated - can achieve more than theoretical max
          statusIcon = '🚀';
          statusColor = '#9b59b6';
          const bonus = yearlyPotential - 36500;
          message = `${statusIcon} <span style="color: ${statusColor}; font-weight: bold;">Du warst so fleißig, dass du ${yearlyPotential} schaffen könntest!</span><br>
                    <small style="color: #95a5a6; font-size: 0.8em;">Das sind ${bonus} mehr als das theoretische Maximum!</small>`;
        } else {
          // Behind schedule - show deficit impact
          statusIcon = '💪';
          statusColor = '#e74c3c';
          message = `${statusIcon} <span style="color: ${statusColor}; font-weight: bold;">Durch dein Defizit von ${deficit} sind nur noch ${yearlyPotential} möglich.</span><br>
                    <small style="color: #13d7e5ff; font-size: 0.8em;">Aber du kannst noch aufholen!</small>`;
        }
        
        potentialElement.innerHTML = `
          ${message}<br>
          <small style="color: #13d7e5ff; font-size: 0.75em; margin-top: 5px; display: block;">
            Nur noch ${remainingDays} Tage und ${potentialData.remaining} Dicke bis zum Ziel!
          </small>
        `;
        potentialElement.style.display = 'block';
      }
    } catch (error) {
      console.log('Yearly potential not available:', error);
      const potentialElement = document.getElementById('yearly-potential-text');
      if (potentialElement) {
        potentialElement.style.display = 'none';
      }
    }
  } else {
    // Hide yearly potential for non-logged users
    const potentialElement = document.getElementById('yearly-potential-text');
    if (potentialElement) {
      potentialElement.style.display = 'none';
    }
  }
  
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
  
  // Support both old format (total) and new format (today_total)
  const userTotal = user.today_total !== undefined ? user.today_total : user.total;
  document.getElementById('modal-progress').textContent = `Heutige Dicke: ${userTotal}`;
  document.getElementById('modal-log-title').textContent = 'Protokoll heute:';
  
  // Show/hide goals section only for current user
  const goalsSection = document.getElementById('modal-goals-section');
  const isOwnProfile = userId && user.id == userId;
  
  if (isOwnProfile) {
    goalsSection.style.display = 'block';
    // Load and display current goals
    await loadUserGoals(user.id);
  } else {
    goalsSection.style.display = 'none';
  }
  
  // Load detailed log from combined exercises endpoint
  const response = await fetch(`${API_BASE}/exercises/combined/${user.id}/details`);
  const data = await response.json();
  console.log('🔍 Modal data received:', data); // Debug log
  const logList = document.getElementById('modal-log');
  logList.innerHTML = '';
  
  // Combine all exercises from today
  const allExercises = [];
  if (data.pushups && data.pushups.length > 0) allExercises.push(...data.pushups.map(p => ({...p, type: 'pushups'})));
  if (data.squats && data.squats.length > 0) allExercises.push(...data.squats.map(s => ({...s, type: 'squats'})));
  if (data.situps && data.situps.length > 0) allExercises.push(...data.situps.map(s => ({...s, type: 'situps'})));
  
  console.log('🔍 All exercises combined:', allExercises); // Debug log
  
  // Sort by timestamp
  allExercises.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Check if user has any exercises today
  if (allExercises.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.innerHTML = `
      <div class="exercise-log-entry" style="text-align: center; color: #888; font-style: italic;">
        Heute noch keine Übungen gemacht 🤷‍♂️
      </div>
    `;
    logList.appendChild(emptyLi);
  } else {
    allExercises.forEach(exercise => {
    const li = document.createElement('li');
    // Extract time directly from Berlin timestamp
    const timestamp = exercise.timestamp;
    const timePart = timestamp.substring(11, 16);
    
    // Get exercise name and emoji
    const exerciseNames = {
      'pushups': 'Push-ups',
      'squats': 'Kniebeugen', 
      'situps': 'Sit-ups'
    };
    const exerciseEmojis = {
      'pushups': '💪',
      'squats': '🦵',
      'situps': '🏃'
    };
    
    const exerciseName = exerciseNames[exercise.type] || exercise.type;
    const exerciseEmoji = exerciseEmojis[exercise.type] || '💪';
    
    // Check if this is the current user's own profile
    const isOwnProfile = userId && user.id == userId;
    
    if (isOwnProfile) {
      // User can delete their own entries
      li.innerHTML = `
        <div class="exercise-log-entry">
          <div class="exercise-info">
            <span class="exercise-time">${timePart}</span>
            <span class="exercise-details">${exercise.count} ${exerciseName}</span>
            <span style="font-size: 16px;">${exerciseEmoji}</span>
          </div>
          <button class="delete-exercise-btn" data-exercise-id="${exercise.id}" data-exercise-type="${exercise.type}">
            🗑️
          </button>
        </div>
      `;
    } else {
      // Other users' profiles - no delete button
      li.innerHTML = `
        <div class="exercise-log-entry">
          <div class="exercise-info">
            <span class="exercise-time">${timePart}</span>
            <span class="exercise-details">${exercise.count} ${exerciseName}</span>
            <span style="font-size: 16px;">${exerciseEmoji}</span>
          </div>
        </div>
      `;
    }
    
    logList.appendChild(li);
    });
  }
  
  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-exercise-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const exerciseId = btn.dataset.exerciseId;
      const exerciseType = btn.dataset.exerciseType;
      
      const exerciseNames = {
        'pushups': 'Push-up',
        'squats': 'Kniebeuge', 
        'situps': 'Sit-up'
      };
      const exerciseName = exerciseNames[exerciseType] || exerciseType;
      
      if (confirm(`Möchtest du diesen ${exerciseName}-Satz wirklich löschen?`)) {
        try {
          const deleteResponse = await fetch(`${API_BASE}/exercises/${exerciseType}/${exerciseId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          
          if (deleteResponse.ok) {
            // Reload the modal data and refresh main view
            await openUserModal(user);
            loadProgress();
            loadLeaderboard();
          } else {
            const error = await deleteResponse.json();
            alert(`Fehler beim Löschen: ${error.error}`);
          }
        } catch (error) {
          alert(`Fehler beim Löschen: ${error.message}`);
        }
      }
    });
  });
  
  // Nudge button
  const nudgeBtn = document.getElementById('nudge-btn');
  nudgeBtn.onclick = () => nudgeUser(user);
  
  document.getElementById('user-modal').style.display = 'block';
}

// Load user's personalized goals
async function loadUserGoals(userId) {
  try {
    const response = await fetch(`${API_BASE}/users/${userId}/goals`);
    const goals = await response.json();
    
    // Populate input fields
    document.getElementById('goal-pushups').value = goals.pushups || exerciseConfig.pushups.defaultGoal;
    document.getElementById('goal-squats').value = goals.squats || exerciseConfig.squats.defaultGoal;
    document.getElementById('goal-situps').value = goals.situps || exerciseConfig.situps.defaultGoal;
    
    console.log('🎯 Loaded user goals:', goals);
  } catch (error) {
    console.error('Error loading user goals:', error);
    // Set defaults on error
    document.getElementById('goal-pushups').value = exerciseConfig.pushups.defaultGoal;
    document.getElementById('goal-squats').value = exerciseConfig.squats.defaultGoal;
    document.getElementById('goal-situps').value = exerciseConfig.situps.defaultGoal;
  }
}

// Save user's personalized goals
async function saveUserGoals(userId) {
  const saveBtn = document.getElementById('save-goals-btn');
  const originalText = saveBtn.textContent;
  
  try {
    saveBtn.disabled = true;
    saveBtn.textContent = '💾 Speichere...';
    
    const goals = {
      pushups: parseInt(document.getElementById('goal-pushups').value),
      squats: parseInt(document.getElementById('goal-squats').value),
      situps: parseInt(document.getElementById('goal-situps').value)
    };
    
    // Validate goals
    for (const [exercise, goal] of Object.entries(goals)) {
      if (!Number.isInteger(goal) || goal < 1 || goal > 1000) {
        throw new Error(`${exercise}: Ziel muss zwischen 1 und 1000 liegen`);
      }
    }
    
    const response = await fetch(`${API_BASE}/users/${userId}/goals`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goals)
    });
    
    if (!response.ok) {
      throw new Error('Fehler beim Speichern der Ziele');
    }
    
    const result = await response.json();
    console.log('🎯 Goals saved:', result);
    
    // Show success feedback
    saveBtn.textContent = '✅ Gespeichert!';
    saveBtn.style.background = '#4CAF50';
    
    // Refresh progress to reflect new goals
    await loadProgress();
    await updateExerciseImages();
    
    // Reset button after 2 seconds
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '#4CAF50';
      saveBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Error saving goals:', error);
    saveBtn.textContent = `❌ ${error.message}`;
    saveBtn.style.background = '#f44336';
    
    // Reset button after 3 seconds
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '#4CAF50';
      saveBtn.disabled = false;
    }, 3000);
  }
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
    `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
  
  // Add user selector if not already present
  if (!document.getElementById('calendar-user-selector')) {
    const selectorContainer = document.createElement('div');
    selectorContainer.style.textAlign = 'center';
    selectorContainer.style.margin = '10px 0';
    
    const label = document.createElement('label');
    label.textContent = 'Kalender von: ';
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
  
  // Get detailed exercise data for this specific date
  const detailResponse = await fetch(`${API_BASE}/calendar/${currentCalendarUserId}/date/${dateStr}`);
  const dayDetailsData = await detailResponse.json();
  
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
  
  // Combine all exercises from that day
  const allDayExercises = [];
  if (dayDetailsData.pushups) allDayExercises.push(...dayDetailsData.pushups.map(p => ({...p, type: 'pushups'})));
  if (dayDetailsData.squats) allDayExercises.push(...dayDetailsData.squats.map(s => ({...s, type: 'squats'})));
  if (dayDetailsData.situps) allDayExercises.push(...dayDetailsData.situps.map(s => ({...s, type: 'situps'})));
  
  // Sort by timestamp
  allDayExercises.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Calculate total
  const actualTotal = allDayExercises.reduce((sum, ex) => sum + ex.count, 0);
  
  // Show in modal
  document.getElementById('modal-name').textContent = `${userName} - ${displayDate}`;
  document.getElementById('modal-progress').innerHTML = `
    <div style="text-align: center; margin: 20px 0;">
      <div style="font-size: 48px; font-weight: bold; color: ${actualTotal >= dailyGoal ? '#4CAF50' : actualTotal > 0 ? '#FF9800' : '#FF5722'};">
        ${actualTotal}
      </div>
      <div style="color: #666; margin-top: 10px;">
        ${actualTotal >= dailyGoal ? '🎉 Ziel erreicht!' : actualTotal > 0 ? '⚠️ Teilweise erfüllt' : '❌ Kein Training'}
      </div>
    </div>
  `;
  
  document.getElementById('modal-log-title').textContent = 'Einzelne Sets:';
  
  const logList = document.getElementById('modal-log');
  logList.innerHTML = '';
  
  if (allDayExercises.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.innerHTML = `
      <div class="exercise-log-entry" style="text-align: center; color: #888; font-style: italic;">
        Keine Übungen an diesem Tag 🤷‍♂️
      </div>
    `;
    logList.appendChild(emptyLi);
  } else {
    allDayExercises.forEach(exercise => {
      const li = document.createElement('li');
      // Extract time directly from Berlin timestamp
      const timestamp = exercise.timestamp;
      const timePart = timestamp.substring(11, 16);
      
      // Get exercise name and emoji
      const exerciseNames = {
        'pushups': 'Push-ups',
        'squats': 'Kniebeugen', 
        'situps': 'Sit-ups'
      };
      const exerciseEmojis = {
        'pushups': '💪',
        'squats': '🦵',
        'situps': '🏃'
      };
      
      const exerciseName = exerciseNames[exercise.type] || exercise.type;
      const exerciseEmoji = exerciseEmojis[exercise.type] || '💪';
      
      li.innerHTML = `
        <div class="exercise-log-entry">
          <div class="exercise-info">
            <span class="exercise-time">${timePart}</span>
            <span class="exercise-details">${exercise.count} ${exerciseName}</span>
            <span style="font-size: 16px;">${exerciseEmoji}</span>
          </div>
        </div>
      `;
      
      logList.appendChild(li);
    });
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
    
    // Get my progress AND the target user's current progress
    const myResponse = await fetch(`${API_BASE}/pushups/${userId}`);
    const myData = await myResponse.json();
    
    // Get target user's current progress (fresh data for today)
    const targetResponse = await fetch(`${API_BASE}/pushups/${user.id}`);
    const targetData = await targetResponse.json();
    
    let message = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];
    message = message.replace('[mein total]', myData.total);
    message = message.replace('[ziel - dein total]', Math.max(0, dailyGoal - targetData.total));
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
async function cleanupOldSubscriptions() {
  try {
    console.log('🧹 Cleaning up old push subscriptions for this device...');
    
    // Get the current subscription to identify this device
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    
    if (!existingSubscription) {
      console.log('⚠️ No existing subscription found, skipping cleanup');
      return;
    }
    
    // Delete old subscriptions from server (only for this device endpoint with different user)
    const response = await fetch(`${API_BASE}/cleanup-subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        currentUserId: userId, 
        subscription: existingSubscription 
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Old subscriptions cleaned up for this device:', result.cleaned);
    } else {
      console.log('⚠️ Cleanup may have failed, but continuing...');
    }
  } catch (error) {
    console.log('⚠️ Cleanup failed, but continuing:', error.message);
  }
}

// Push notification subscription function
async function subscribeToPushNotifications() {
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
        await subscribeToPushNotifications();
        
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
