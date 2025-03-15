document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const loginSection = document.getElementById('loginSection');
    const mainContent = document.getElementById('mainContent');
    const urlsList = document.getElementById('urlsList');
    
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Form elements
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const urlInput = document.getElementById('urlInput');
    const selectorInput = document.getElementById('selectorInput');
    const frequencySelect = document.getElementById('frequencySelect');
    const addUrlBtn = document.getElementById('addUrlBtn');
    const pickSelectorBtn = document.getElementById('pickSelectorBtn');
    
    const emailNotifications = document.getElementById('emailNotifications');
    const notificationEmail = document.getElementById('notificationEmail');
    const notificationFrequency = document.getElementById('notificationFrequency');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    
    // Initialize UI based on auth state
    firebaseModule.auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in
        loginSection.style.display = 'none';
        mainContent.style.display = 'block';
        loadUserData();
      } else {
        // User is signed out
        loginSection.style.display = 'block';
        mainContent.style.display = 'none';
      }
    });
    
    // Tab navigation handlers
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons and contents
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked button
        button.classList.add('active');
        
        // Show corresponding content
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });
    
    // Authentication handlers
    loginBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        alert('Please enter both email and password');
        return;
      }
      
      try {
        await firebaseModule.auth.signIn(email, password);
        // UI updates handled by auth state observer
      } catch (error) {
        alert(`Login failed: ${error.message}`);
      }
    });
    
    registerBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        alert('Please enter both email and password');
        return;
      }
      
      try {
        await firebaseModule.auth.signUp(email, password);
        // UI updates handled by auth state observer
      } catch (error) {
        alert(`Registration failed: ${error.message}`);
      }
    });
    
    logoutBtn.addEventListener('click', async () => {
      try {
        await firebaseModule.auth.signOut();
        // UI updates handled by auth state observer
      } catch (error) {
        alert(`Logout failed: ${error.message}`);
      }
    });
    
    // URL Management
    addUrlBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      const selector = selectorInput.value.trim();
      const frequency = frequencySelect.value;
      
      if (!url) {
        alert('Please enter a URL');
        return;
      }
      
      try {
        await firebaseModule.db.addURL(url, selector, frequency);
        urlInput.value = '';
        selectorInput.value = '';
        
        // Switch to URLs tab and refresh list
        tabButtons[0].click();
        loadUserURLs();
      } catch (error) {
        alert(`Failed to add URL: ${error.message}`);
      }
    });
    
    pickSelectorBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      
      if (!url) {
        alert('Please enter a URL first');
        return;
      }
      
      // Send message to background script to open selector tool
      chrome.runtime.sendMessage({
        action: 'openSelectorTool',
        url: url
      }, (response) => {
        if (response && response.selector) {
          selectorInput.value = response.selector;
        }
      });
    });
    
    // Settings Management
    saveSettingsBtn.addEventListener('click', async () => {
      const preferences = {
        emailNotifications: emailNotifications.checked,
        notificationEmail: notificationEmail.value.trim(),
        notificationFrequency: notificationFrequency.value
      };
      
      try {
        await firebaseModule.db.updateUserPreferences(preferences);
        alert('Settings saved successfully');
      } catch (error) {
        alert(`Failed to save settings: ${error.message}`);
      }
    });
    
    // Load user data (URLs and preferences)
    async function loadUserData() {
      try {
        // Load user preferences
        const preferences = await firebaseModule.db.getUserPreferences();
        emailNotifications.checked = preferences.emailNotifications;
        notificationEmail.value = preferences.notificationEmail || '';
        notificationFrequency.value = preferences.notificationFrequency || 'immediate';
        
        // Load user URLs
        loadUserURLs();
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
    
    // Load and display user URLs
    async function loadUserURLs() {
      try {
        const urls = await firebaseModule.db.getUserURLs();
        
        if (urls.length === 0) {
          urlsList.innerHTML = '<p class="empty-state">No URLs added yet. Add one in the "Add URL" tab.</p>';
          return;
        }
        
        urlsList.innerHTML = '';
        
        urls.forEach(urlData => {
          const urlItem = document.createElement('div');
          urlItem.className = 'url-item';
          
          const frequencyText = {
            'hourly': 'Every hour',
            'daily': 'Once a day',
            'weekly': 'Once a week'
          }[urlData.frequency] || urlData.frequency;
          
          urlItem.innerHTML = `
            <div class="url-header">
              <h3>${truncateURL(urlData.url)}</h3>
              <label class="switch">
                <input type="checkbox" class="url-toggle" data-id="${urlData.id}" ${urlData.enabled ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            <div class="url-details">
              <p><strong>Full URL:</strong> ${urlData.url}</p>
              <p><strong>Selector:</strong> ${urlData.selector || 'Entire page'}</p>
              <p><strong>Frequency:</strong> ${frequencyText}</p>
              <p><strong>Last checked:</strong> ${urlData.lastChecked ? new Date(urlData.lastChecked.toDate()).toLocaleString() : 'Never'}</p>
            </div>
            <div class="url-actions">
              <button class="edit-url-btn" data-id="${urlData.id}">Edit</button>
              <button class="delete-url-btn" data-id="${urlData.id}">Delete</button>
            </div>
          `;
          
          urlsList.appendChild(urlItem);
        });
        
        // Add event listeners to the newly created buttons
        addURLItemEventListeners();
      } catch (error) {
        console.error('Error loading URLs:', error);
        urlsList.innerHTML = '<p class="error-state">Error loading URLs. Please try again.</p>';
      }
    }
    
    // Add event listeners to URL items
    function addURLItemEventListeners() {
      // URL toggle switches
      document.querySelectorAll('.url-toggle').forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
          const urlId = e.target.getAttribute('data-id');
          const enabled = e.target.checked;
          
          try {
            await firebaseModule.db.updateURL(urlId, { enabled });
          } catch (error) {
            console.error('Error updating URL status:', error);
            // Revert the toggle if update fails
            e.target.checked = !enabled;
          }
        });
      });
      
      // Delete URL buttons
      document.querySelectorAll('.delete-url-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
          const urlId = e.target.getAttribute('data-id');
          
          if (confirm('Are you sure you want to delete this URL?')) {
            try {
              await firebaseModule.db.deleteURL(urlId);
              loadUserURLs(); // Refresh the list
            } catch (error) {
              console.error('Error deleting URL:', error);
              alert(`Failed to delete URL: ${error.message}`);
            }
          }
        });
      });
      
      // Edit URL buttons
      document.querySelectorAll('.edit-url-btn').forEach(button => {
        button.addEventListener('click', (e) => {
          const urlId = e.target.getAttribute('data-id');
          // Open edit dialog or switch to edit mode
          // This would be implemented based on your UI design
          alert('Edit functionality to be implemented');
        });
      });
    }
    
    // Helper function to truncate URL for display
    function truncateURL(url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
      } catch (e) {
        return url.length > 40 ? url.substring(0, 37) + '...' : url;
      }
    }
  });