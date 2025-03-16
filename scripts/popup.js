document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const urlsList = document.getElementById('urlsList');
  
  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Form elements
  const urlInput = document.getElementById('urlInput');
  const selectorInput = document.getElementById('selectorInput');
  const frequencySelect = document.getElementById('frequencySelect');
  const addUrlBtn = document.getElementById('addUrlBtn');
  const pickSelectorBtn = document.getElementById('pickSelectorBtn');
  
  const browserNotifications = document.getElementById('browserNotifications');
  const notificationFrequency = document.getElementById('notificationFrequency');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  
  // Initialize UI
  loadUserData();
  
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
      await addURL(url, selector, frequency);
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
      browserNotifications: browserNotifications.checked,
      notificationFrequency: notificationFrequency.value
    };
    
    try {
      await updateUserPreferences(preferences);
      alert('Settings saved successfully');
    } catch (error) {
      alert(`Failed to save settings: ${error.message}`);
    }
  });
  
  // Load user data (URLs and preferences)
  async function loadUserData() {
    try {
      // Load user preferences
      const preferences = await getUserPreferences();
      browserNotifications.checked = preferences.browserNotifications;
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
      const urls = await getUserURLs();
      
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
            <p><strong>Last checked:</strong> ${urlData.lastChecked ? new Date(urlData.lastChecked).toLocaleString() : 'Never'}</p>
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
          await updateURL(urlId, { enabled });
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
            await deleteURL(urlId);
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
      button.addEventListener('click', async (e) => {
        const urlId = e.target.getAttribute('data-id');
        
        try {
          // Get URL data
          const urls = await getUserURLs();
          const urlData = urls.find(url => url.id === urlId);
          
          if (urlData) {
            // Fill the form with URL data
            urlInput.value = urlData.url;
            selectorInput.value = urlData.selector || '';
            frequencySelect.value = urlData.frequency;
            
            // Switch to Add URL tab (which will be used for editing)
            tabButtons[1].click();
            
            // Change Add URL button text
            addUrlBtn.textContent = 'Update URL';
            
            // Save URL ID for update
            addUrlBtn.setAttribute('data-edit-id', urlId);
            
            // Add event listener for cancel
            const cancelEditListener = () => {
              addUrlBtn.textContent = 'Add URL';
              addUrlBtn.removeAttribute('data-edit-id');
              urlInput.value = '';
              selectorInput.value = '';
              frequencySelect.value = 'daily';
              tabButtons[0].click();
            };
            
            // Add cancel button if it doesn't exist
            if (!document.getElementById('cancelEditBtn')) {
              const cancelBtn = document.createElement('button');
              cancelBtn.id = 'cancelEditBtn';
              cancelBtn.textContent = 'Cancel';
              cancelBtn.style.marginLeft = '10px';
              addUrlBtn.parentNode.appendChild(cancelBtn);
              
              cancelBtn.addEventListener('click', cancelEditListener);
            }
            
            // Override add URL button functionality for edit
            const originalAddUrlListener = addUrlBtn.onclick;
            addUrlBtn.onclick = async () => {
              const newUrl = urlInput.value.trim();
              const newSelector = selectorInput.value.trim();
              const newFrequency = frequencySelect.value;
              
              if (!newUrl) {
                alert('Please enter a URL');
                return;
              }
              
              try {
                await updateURL(urlId, {
                  url: newUrl,
                  selector: newSelector,
                  frequency: newFrequency
                });
                
                // Reset form and button
                addUrlBtn.textContent = 'Add URL';
                addUrlBtn.removeAttribute('data-edit-id');
                addUrlBtn.onclick = originalAddUrlListener;
                
                // Remove cancel button
                const cancelBtn = document.getElementById('cancelEditBtn');
                if (cancelBtn) {
                  cancelBtn.parentNode.removeChild(cancelBtn);
                }
                
                urlInput.value = '';
                selectorInput.value = '';
                frequencySelect.value = 'daily';
                
                // Switch back to URLs tab and refresh
                tabButtons[0].click();
                loadUserURLs();
              } catch (error) {
                alert(`Failed to update URL: ${error.message}`);
              }
            };
          }
        } catch (error) {
          console.error('Error editing URL:', error);
          alert(`Failed to edit URL: ${error.message}`);
        }
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
  
  // ---- Storage API Functions ----
  
  // Get user preferences from Chrome storage
  function getUserPreferences() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('userPreferences', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const defaultPreferences = {
          browserNotifications: true,
          notificationFrequency: 'immediate'
        };
        
        resolve(result.userPreferences || defaultPreferences);
      });
    });
  }
  
  // Update user preferences in Chrome storage
  function updateUserPreferences(preferences) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ userPreferences: preferences }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  // Get all URLs from Chrome storage
  function getUserURLs() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('monitoredURLs', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        resolve(result.monitoredURLs || []);
      });
    });
  }
  
  // Add a new URL to Chrome storage
  function addURL(url, selector, frequency) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('monitoredURLs', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const urls = result.monitoredURLs || [];
        
        // Generate a unique ID
        const id = 'url_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        
        const newURL = {
          id: id,
          url: url,
          selector: selector,
          frequency: frequency,
          enabled: true,
          createdAt: new Date().toISOString(),
          lastChecked: null,
          lastContentHash: null
        };
        
        urls.push(newURL);
        
        chrome.storage.local.set({ monitoredURLs: urls }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
  }
  
  // Update a URL in Chrome storage
  function updateURL(urlId, updates) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('monitoredURLs', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const urls = result.monitoredURLs || [];
        const urlIndex = urls.findIndex(url => url.id === urlId);
        
        if (urlIndex !== -1) {
          urls[urlIndex] = { ...urls[urlIndex], ...updates };
          
          chrome.storage.local.set({ monitoredURLs: urls }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } else {
          reject(new Error(`URL with ID ${urlId} not found`));
        }
      });
    });
  }
  
  // Delete a URL from Chrome storage
  function deleteURL(urlId) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get('monitoredURLs', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        const urls = result.monitoredURLs || [];
        const newUrls = urls.filter(url => url.id !== urlId);
        
        chrome.storage.local.set({ monitoredURLs: newUrls }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
  }
});