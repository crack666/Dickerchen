// Backend Status Manager
class BackendStatusManager {
  constructor() {
    this.isOnline = true;
    this.isChecking = false;
    this.lastCheck = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.checkInterval = 30000; // 30 seconds
    this.statusInterval = null;
    
    this.init();
  }
  
  init() {
    this.createStatusOverlay();
    this.startStatusChecking();
    this.checkInitialStatus();
  }
  
  async checkInitialStatus() {
    this.showStatusMessage('Checking backend connection...', 'info');
    const status = await this.checkBackendStatus();
    
    if (status.online) {
      this.hideStatusOverlay();
    } else {
      this.showOfflineOverlay();
    }
  }
  
  async checkBackendStatus() {
    if (this.isChecking) return { online: this.isOnline };
    
    this.isChecking = true;
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      this.isOnline = response.ok && data.online;
      this.lastCheck = new Date();
      this.retryCount = 0;
      
      if (this.isOnline) {
        this.hideStatusOverlay();
        console.log(`✅ Backend online (${responseTime}ms)`, data);
      } else {
        this.showOfflineOverlay();
        console.warn('⚠️ Backend degraded:', data);
      }
      
      return { online: this.isOnline, data, responseTime };
      
    } catch (error) {
      this.isOnline = false;
      this.retryCount++;
      this.lastCheck = new Date();
      
      console.error('❌ Backend offline:', error.message);
      this.showOfflineOverlay();
      
      return { online: false, error: error.message };
    } finally {
      this.isChecking = false;
    }
  }
  
  createStatusOverlay() {
    // Create status overlay div
    const overlay = document.createElement('div');
    overlay.id = 'backend-status-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      color: white;
      font-family: Arial, sans-serif;
    `;
    
    overlay.innerHTML = `
      <div style="text-align: center; padding: 20px; background: #333; border-radius: 10px; max-width: 400px;">
        <div id="status-icon" style="font-size: 48px; margin-bottom: 20px;">🔌</div>
        <h2 id="status-title">Backend Status</h2>
        <p id="status-message">Checking connection...</p>
        <div id="status-details" style="margin-top: 15px; font-size: 14px; opacity: 0.8;"></div>
        <button id="retry-button" style="
          margin-top: 20px; 
          padding: 10px 20px; 
          background: #007cba; 
          color: white; 
          border: none; 
          border-radius: 5px; 
          cursor: pointer;
          display: none;
        ">Retry Connection</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add retry button functionality
    document.getElementById('retry-button').addEventListener('click', () => {
      this.checkBackendStatus();
    });
  }
  
  showStatusOverlay() {
    const overlay = document.getElementById('backend-status-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  }
  
  hideStatusOverlay() {
    const overlay = document.getElementById('backend-status-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
  
  showStatusMessage(message, type = 'info') {
    const overlay = document.getElementById('backend-status-overlay');
    const icon = document.getElementById('status-icon');
    const title = document.getElementById('status-title');
    const messageEl = document.getElementById('status-message');
    const retryBtn = document.getElementById('retry-button');
    
    if (!overlay) return;
    
    overlay.style.display = 'flex';
    messageEl.textContent = message;
    
    switch (type) {
      case 'info':
        icon.textContent = '🔄';
        title.textContent = 'Connecting...';
        retryBtn.style.display = 'none';
        break;
      case 'error':
        icon.textContent = '❌';
        title.textContent = 'Connection Error';
        retryBtn.style.display = 'block';
        break;
      case 'offline':
        icon.textContent = '🔌';
        title.textContent = 'Backend Offline';
        retryBtn.style.display = 'block';
        break;
    }
  }
  
  showOfflineOverlay() {
    this.showStatusMessage(
      `Unable to connect to backend server. This may be due to maintenance or network issues. Retry in ${this.retryCount}/${this.maxRetries} attempts.`,
      'offline'
    );
    
    const details = document.getElementById('status-details');
    if (details && this.lastCheck) {
      details.textContent = `Last check: ${this.lastCheck.toLocaleTimeString()}`;
    }
  }
  
  startStatusChecking() {
    // Check status periodically
    this.statusInterval = setInterval(() => {
      if (!this.isOnline || this.retryCount > 0) {
        this.checkBackendStatus();
      }
    }, this.checkInterval);
  }
  
  stopStatusChecking() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }
  
  // Enhanced fetch wrapper with status checking
  async safeFetch(url, options = {}) {
    if (!this.isOnline) {
      throw new Error('Backend is offline');
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Reset retry count on successful request
      this.retryCount = 0;
      
      return response;
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      
      // Check if this was a network error
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        this.checkBackendStatus();
      }
      
      throw error;
    }
  }
  
  // Public API for other parts of the app
  getStatus() {
    return {
      online: this.isOnline,
      lastCheck: this.lastCheck,
      retryCount: this.retryCount
    };
  }
}

// Initialize backend status manager
window.backendStatus = new BackendStatusManager();