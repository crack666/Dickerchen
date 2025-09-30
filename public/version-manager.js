// Version Manager - Handles frontend/backend version checking and display
class VersionManager {
  constructor() {
    this.frontendVersion = window.APP_VERSION || 'unknown';
    this.backendVersion = null;
    this.versionInfo = null;
    this.lastCheck = null;
    this.updateAvailable = false;
    
    this.init();
  }
  
  async init() {
    await this.checkVersions();
    this.updateVersionDisplay();
    this.addVersionToDebugPanel();
  }
  
  async checkVersions() {
    try {
      const response = await fetch('/api/version');
      this.versionInfo = await response.json();
      this.backendVersion = this.versionInfo.backend.version;
      this.lastCheck = new Date();
      
      // Check if update is available
      this.updateAvailable = this.frontendVersion !== this.backendVersion;
      
      console.log('📋 Version Check:', {
        frontend: this.frontendVersion,
        backend: this.backendVersion,
        updateAvailable: this.updateAvailable,
        serverInfo: this.versionInfo
      });
      
      return this.versionInfo;
    } catch (error) {
      console.error('❌ Version check failed:', error);
      return null;
    }
  }
  
  updateVersionDisplay() {
    // Update header version display
    const versionDisplay = document.getElementById('version-display');
    if (versionDisplay) {
      if (this.updateAvailable) {
        versionDisplay.innerHTML = `
          <span style="color: #ffa500;">v${this.frontendVersion}</span>
          <span style="font-size: 10px; color: #ffa500;">⚠️ Update</span>
        `;
        versionDisplay.title = `Update available: v${this.backendVersion}`;
      } else {
        versionDisplay.innerHTML = `v${this.frontendVersion}`;
        versionDisplay.style.color = '#28a745';
      }
    }
  }
  
  addVersionToDebugPanel() {
    // Wait for debug panel to be created
    setTimeout(() => {
      const debugPanel = document.querySelector('.debug-panel');
      if (!debugPanel) return;
      
      // Create version section
      const versionSection = document.createElement('div');
      versionSection.className = 'debug-section';
      versionSection.innerHTML = `
        <h4>📱 Version Information</h4>
        <div class="debug-item">
          <strong>Frontend Version:</strong> 
          <span id="debug-frontend-version">${this.frontendVersion}</span>
        </div>
        <div class="debug-item">
          <strong>Backend Version:</strong> 
          <span id="debug-backend-version">${this.backendVersion || 'Loading...'}</span>
        </div>
        <div class="debug-item">
          <strong>Status:</strong> 
          <span id="debug-version-status">${this.getVersionStatus()}</span>
        </div>
        <div class="debug-item">
          <strong>Last Check:</strong> 
          <span id="debug-version-check">${this.lastCheck ? this.lastCheck.toLocaleString() : 'Not checked'}</span>
        </div>
        <button id="version-check-btn" style="
          margin-top: 10px; 
          padding: 5px 10px; 
          background: #007cba; 
          color: white; 
          border: none; 
          border-radius: 3px; 
          cursor: pointer;
          font-size: 12px;
        ">🔄 Check for Updates</button>
        <button id="version-details-btn" style="
          margin-top: 5px; 
          margin-left: 5px;
          padding: 5px 10px; 
          background: #6c757d; 
          color: white; 
          border: none; 
          border-radius: 3px; 
          cursor: pointer;
          font-size: 12px;
        ">📋 Full Details</button>
      `;
      
      // Insert version section at the top of debug panel
      debugPanel.insertBefore(versionSection, debugPanel.firstChild);
      
      // Add event listeners
      document.getElementById('version-check-btn').addEventListener('click', () => {
        this.manualVersionCheck();
      });
      
      document.getElementById('version-details-btn').addEventListener('click', () => {
        this.showVersionDetails();
      });
      
    }, 1000);
  }
  
  async manualVersionCheck() {
    const btn = document.getElementById('version-check-btn');
    const originalText = btn.textContent;
    
    btn.textContent = '🔄 Checking...';
    btn.disabled = true;
    
    await this.checkVersions();
    this.updateVersionDisplay();
    this.updateDebugVersionInfo();
    
    btn.textContent = originalText;
    btn.disabled = false;
    
    // Show result notification
    if (this.updateAvailable) {
      this.showUpdateNotification();
    } else {
      showNotification('✅ You have the latest version!', 'success');
    }
  }
  
  updateDebugVersionInfo() {
    const backendVersionEl = document.getElementById('debug-backend-version');
    const statusEl = document.getElementById('debug-version-status');
    const checkEl = document.getElementById('debug-version-check');
    
    if (backendVersionEl) backendVersionEl.textContent = this.backendVersion || 'Unknown';
    if (statusEl) statusEl.innerHTML = this.getVersionStatus();
    if (checkEl) checkEl.textContent = this.lastCheck ? this.lastCheck.toLocaleString() : 'Not checked';
  }
  
  getVersionStatus() {
    if (!this.backendVersion) {
      return '<span style="color: #ffc107;">⚠️ Unknown</span>';
    }
    
    if (this.updateAvailable) {
      return '<span style="color: #dc3545;">🔄 Update Available</span>';
    }
    
    return '<span style="color: #28a745;">✅ Up to Date</span>';
  }
  
  showVersionDetails() {
    if (!this.versionInfo) {
      showNotification('❌ No version information available', 'error');
      return;
    }
    
    // Create detailed version modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10001;
      color: white;
      font-family: Arial, sans-serif;
    `;
    
    modal.innerHTML = `
      <div style="
        background: #333; 
        padding: 20px; 
        border-radius: 10px; 
        max-width: 500px; 
        max-height: 80vh; 
        overflow-y: auto;
        text-align: left;
      ">
        <h3>📋 Detailed Version Information</h3>
        
        <h4>🖥️ Backend</h4>
        <ul>
          <li><strong>Version:</strong> ${this.versionInfo.backend.version}</li>
          <li><strong>Environment:</strong> ${this.versionInfo.backend.environment}</li>
          <li><strong>Node.js:</strong> ${this.versionInfo.backend.nodeVersion}</li>
          <li><strong>Uptime:</strong> ${Math.floor(this.versionInfo.backend.uptime / 60)} minutes</li>
          <li><strong>Build Date:</strong> ${new Date(this.versionInfo.backend.buildDate).toLocaleString()}</li>
        </ul>
        
        <h4>📱 Frontend</h4>
        <ul>
          <li><strong>Version:</strong> ${this.versionInfo.frontend.version}</li>
          <li><strong>Local Version:</strong> ${this.frontendVersion}</li>
          <li><strong>Features:</strong> ${this.versionInfo.frontend.supportedFeatures.join(', ')}</li>
          <li><strong>Cache Busting:</strong> ${window.versionedUrl ? 'Enabled' : 'Disabled'}</li>
        </ul>
        
        <h4>🔌 API</h4>
        <ul>
          <li><strong>Version:</strong> ${this.versionInfo.api.version}</li>
          <li><strong>Endpoints:</strong> ${this.versionInfo.api.endpoints.length} available</li>
        </ul>
        
        <div style="margin-top: 20px; text-align: center;">
          <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
            padding: 10px 20px; 
            background: #007cba; 
            color: white; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer;
          ">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
  
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ffa500;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    notification.innerHTML = `
      <strong>🔄 Update Available!</strong><br>
      Frontend: v${this.frontendVersion}<br>
      Backend: v${this.backendVersion}<br>
      <button onclick="location.reload()" style="
        margin-top: 10px; 
        padding: 5px 10px; 
        background: white; 
        color: #ffa500; 
        border: none; 
        border-radius: 3px; 
        cursor: pointer;
      ">Refresh Page</button>
      <button onclick="this.parentElement.remove()" style="
        margin-top: 10px; 
        margin-left: 5px;
        padding: 5px 10px; 
        background: rgba(255,255,255,0.2); 
        color: white; 
        border: none; 
        border-radius: 3px; 
        cursor: pointer;
      ">Later</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }
  
  // Public API
  getVersionInfo() {
    return {
      frontend: this.frontendVersion,
      backend: this.backendVersion,
      updateAvailable: this.updateAvailable,
      lastCheck: this.lastCheck,
      fullInfo: this.versionInfo
    };
  }
}

// Initialize version manager
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for other scripts to load
  setTimeout(() => {
    window.versionManager = new VersionManager();
  }, 500);
});