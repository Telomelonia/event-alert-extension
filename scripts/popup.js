document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const mainContent = document.getElementById('mainContent');
  const urlsList = document.getElementById('urlsList');
  
  // Tab navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Form elements
  const urlInput = document.getElementById('urlInput');
  const eventNameInput = document.getElementById('eventNameInput');
  const manualDateInput = document.getElementById('manualDateInput');
  const detectDatesBtn = document.getElementById('detectDatesBtn');
  const selectedDateDisplay = document.getElementById('selectedDateDisplay');
  const addUrlBtn = document.getElementById('addUrlBtn');
  
  const detectionMethodRadios = document.querySelectorAll('input[name="detectionMethod"]');
  const manualDateContainer = document.getElementById('manualDateContainer');
  const autoDetectContainer = document.getElementById('autoDetectContainer');
  
  const notifyOneWeek = document.getElementById('notifyOneWeek');
  const notifyThreeDays = document.getElementById('notifyThreeDays');
  const notifyOneDay = document.getElementById('notifyOneDay');
  
  const emailNotifications = document.getElementById('emailNotifications');
  const notificationEmail = document.getElementById('notificationEmail');
  const notificationFrequency = document.getElementById('notificationFrequency');
  const browserNotifications = document.getElementById('browserNotifications');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  
  // Store detected/selected date information
  let selectedDateInfo = null;
  
  // Show main content immediately (since we're not using auth)
  mainContent.style.display = 'block';
  
  // Load user data on startup
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
  
  // Toggle between manual date input and automatic date detection
  detectionMethodRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const method = document.querySelector('input[name="detectionMethod"]:checked').value;
      
      if (method === 'manual') {
        manualDateContainer.style.display = 'block';
        autoDetectContainer.style.display = 'none';
        
        // Reset automatic detection data
        selectedDateInfo = null;
        selectedDateDisplay.textContent = 'No date selected yet';
      } else {
        manualDateContainer.style.display = 'none';
        autoDetectContainer.style.display = 'block';
      }
    });
  });
  
  // Date detection button handler
  detectDatesBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
      alert('Please enter a URL first');
      return;
    }
    
    // Send message to background script to open date detector
    chrome.runtime.sendMessage({
      action: 'openDateDetector',
      url: url
    }, (response) => {
      if (response && response.date) {
        selectedDateInfo = response.date;
        
        // Update UI to show selected date
        if (selectedDateInfo.date) {
          selectedDateDisplay.textContent = `Selected date: ${selectedDateInfo.date}`;
          
          if (selectedDateInfo.daysUntil !== undefined) {
            selectedDateDisplay.textContent += ` (${selectedDateInfo.daysUntil} days from now)`;
          }
        }
      }
    });
  });
  
  // Add event button handler
  addUrlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const eventName = eventNameInput.value.trim();
    const method = document.querySelector('input[name="detectionMethod"]:checked').value;
    
    if (!url) {
      alert('Please enter a URL');
      return;
    }
    
    let eventDate, daysUntil, dateSelector;
    
    if (method === 'manual') {
      const manualDate = manualDateInput.value;
      if (!manualDate) {
        alert('Please select an event date');
        return;
      }
      
      eventDate = manualDate;
      const dateObj = new Date(manualDate);
      const today = new Date();
      daysUntil = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
      dateSelector = null;
    } else {
      if (!selectedDateInfo) {
        alert('Please detect and select a date from the page first');
        return;
      }
      
      eventDate = selectedDateInfo.parsedDate || selectedDateInfo.date;
      daysUntil = selectedDateInfo.daysUntil;
      dateSelector = selectedDateInfo.xpath;
    }
    
    // Get notification preferences
    const notificationTriggers = {
      oneWeekBefore: notifyOneWeek.checked,
      threeDaysBefore: notifyThreeDays.checked,
      oneDayBefore: notifyOneDay.checked
    };
    
    try {
      // Add event to monitoring
      await storageHelper.addEvent(
        url,
        eventName || 'Unnamed Event',
        eventDate,
        dateSelector,
        notificationTriggers
      );
      
      // Reset form
      urlInput.value = '';
      eventNameInput.value = '';
      manualDateInput.value = '';
      selectedDateInfo = null;
      selectedDateDisplay.textContent = 'No date selected yet';
      
      // Switch to events tab and refresh list
      tabButtons[0].click();
      loadUserEvents();
    } catch (error) {
      alert(`Failed to add event: ${error.message}`);
    }
  });
  
  // Settings Management
  saveSettingsBtn.addEventListener('click', async () => {
    const preferences = {
      emailNotifications: emailNotifications.checked,
      notificationEmail: notificationEmail.value.trim(),
      notificationFrequency: notificationFrequency.value,
      browserNotifications: browserNotifications.checked
    };
    
    try {
      await storageHelper.updatePreferences(preferences);
      alert('Settings saved successfully');
    } catch (error) {
      alert(`Failed to save settings: ${error.message}`);
    }
  });
  
  // Load user data (events and preferences)
  async function loadUserData() {
    try {
      // Load user preferences
      const preferences = await storageHelper.getPreferences();
      emailNotifications.checked = preferences.emailNotifications;
      notificationEmail.value = preferences.notificationEmail || '';
      notificationFrequency.value = preferences.notificationFrequency || 'automatic';
      browserNotifications.checked = preferences.browserNotifications !== false; // Default to true if not set
      
      // Load user events
      loadUserEvents();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }
  
  // Load and display user events
  async function loadUserEvents() {
    try {
      const events = await storageHelper.getEvents();
      
      if (events.length === 0) {
        urlsList.innerHTML = '<p class="empty-state">No events added yet. Add one in the "Add Event" tab.</p>';
        return;
      }
      
      // Sort events by date (closest first)
      const sortedEvents = [...events].sort((a, b) => {
        const dateA = new Date(a.eventDate);
        const dateB = new Date(b.eventDate);
        return dateA - dateB;
      });
      
      urlsList.innerHTML = '';
      
      sortedEvents.forEach(event => {
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item';
        
        // Calculate days remaining
        let daysRemaining = 'Unknown date';
        let statusClass = '';
        
        if (event.eventDate) {
          const eventDate = new Date(event.eventDate);
          const today = new Date();
          const timeRemaining = eventDate - today;
          const daysRemain = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
          
          if (daysRemain < 0) {
            daysRemaining = 'Event has passed';
            statusClass = 'status-passed';
          } else if (daysRemain === 0) {
            daysRemaining = 'Today!';
            statusClass = 'status-today';
          } else if (daysRemain === 1) {
            daysRemaining = 'Tomorrow!';
            statusClass = 'status-soon';
          } else if (daysRemain <= 3) {
            daysRemaining = `${daysRemain} days left`;
            statusClass = 'status-soon';
          } else if (daysRemain <= 7) {
            daysRemaining = `${daysRemain} days left`;
            statusClass = 'status-upcoming';
          } else {
            daysRemaining = `${daysRemain} days left`;
            statusClass = 'status-future';
          }
        }
        
        urlItem.innerHTML = `
          <div class="url-header">
            <h3>${event.eventName || truncateURL(event.url)}</h3>
            <span class="event-status ${statusClass}">${daysRemaining}</span>
            <label class="switch">
              <input type="checkbox" class="url-toggle" data-id="${event.id}" ${event.enabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
          <div class="url-details">
            <p><strong>URL:</strong> <a href="${event.url}" target="_blank">${truncateURL(event.url)}</a></p>
            <p><strong>Event Date:</strong> ${event.eventDate ? formatDate(event.eventDate) : 'Unknown'}</p>
            <p><strong>Notifications:</strong> 
              ${event.notificationTriggers.oneWeekBefore ? '1 week before, ' : ''}
              ${event.notificationTriggers.threeDaysBefore ? '3 days before, ' : ''}
              ${event.notificationTriggers.oneDayBefore ? '1 day before' : ''}
            </p>
            <p><strong>Last checked:</strong> ${event.lastChecked ? new Date(event.lastChecked).toLocaleString() : 'Never'}</p>
          </div>
          <div class="url-actions">
            <button class="edit-url-btn" data-id="${event.id}">Edit</button>
            <button class="delete-url-btn" data-id="${event.id}">Delete</button>
          </div>
        `;
        
        urlsList.appendChild(urlItem);
      });
      
      // Add event listeners to the newly created buttons
      addEventItemEventListeners();
    } catch (error) {
      console.error('Error loading events:', error);
      urlsList.innerHTML = '<p class="error-state">Error loading events. Please try again.</p>';
    }
  }
  
  // Add event listeners to event items
  function addEventItemEventListeners() {
    // Event toggle switches
    document.querySelectorAll('.url-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const eventId = e.target.getAttribute('data-id');
        const enabled = e.target.checked;
        
        try {
          await storageHelper.updateEvent(eventId, { enabled });
        } catch (error) {
          console.error('Error updating event status:', error);
          // Revert the toggle if update fails
          e.target.checked = !enabled;
        }
      });
    });
    
    // Delete event buttons
    document.querySelectorAll('.delete-url-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const eventId = e.target.getAttribute('data-id');
        
        if (confirm('Are you sure you want to delete this event?')) {
          try {
            await storageHelper.deleteEvent(eventId);
            loadUserEvents(); // Refresh the list
          } catch (error) {
            console.error('Error deleting event:', error);
            alert(`Failed to delete event: ${error.message}`);
          }
        }
      });
    });
    
    // Edit event buttons
    document.querySelectorAll('.edit-url-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const eventId = e.target.getAttribute('data-id');
        
        try {
          // Get all events
          const events = await storageHelper.getEvents();
          const event = events.find(e => e.id === eventId);
          
          if (!event) {
            alert('Event not found');
            return;
          }
          
          // Switch to edit tab
          tabButtons[1].click();
          
          // Fill form with event data
          urlInput.value = event.url;
          eventNameInput.value = event.eventName || '';
          
          // Set detection method
          if (event.dateSelector) {
            document.querySelector('input[name="detectionMethod"][value="auto"]').checked = true;
            manualDateContainer.style.display = 'none';
            autoDetectContainer.style.display = 'block';
            selectedDateDisplay.textContent = `Selected date: ${formatDate(event.eventDate)}`;
          } else {
            document.querySelector('input[name="detectionMethod"][value="manual"]').checked = true;
            manualDateContainer.style.display = 'block';
            autoDetectContainer.style.display = 'none';
            
            // Format date for input (YYYY-MM-DD)
            const dateObj = new Date(event.eventDate);
            const formattedDate = dateObj.toISOString().split('T')[0];
            manualDateInput.value = formattedDate;
          }
          
          // Set notification triggers
          notifyOneWeek.checked = event.notificationTriggers.oneWeekBefore;
          notifyThreeDays.checked = event.notificationTriggers.threeDaysBefore;
          notifyOneDay.checked = event.notificationTriggers.oneDayBefore;
          
          // Change button text
          addUrlBtn.textContent = 'Update Event';
          
          // Store original ID for updating
          addUrlBtn.setAttribute('data-edit-id', eventId);
          
          // Change click handler temporarily
          const originalClickHandler = addUrlBtn.onclick;
          addUrlBtn.onclick = async () => {
            // Get form values
            const url = urlInput.value.trim();
            const eventName = eventNameInput.value.trim();
            const method = document.querySelector('input[name="detectionMethod"]:checked').value;
            
            if (!url) {
              alert('Please enter a URL');
              return;
            }
            
            let eventDate, dateSelector;
            
            if (method === 'manual') {
              const manualDate = manualDateInput.value;
              if (!manualDate) {
                alert('Please select an event date');
                return;
              }
              
              eventDate = manualDate;
              dateSelector = null;
            } else {
              if (!selectedDateInfo && !event.dateSelector) {
                alert('Please detect and select a date from the page first');
                return;
              }
              
              // Use existing date if no new one selected
              eventDate = selectedDateInfo ? 
                          (selectedDateInfo.parsedDate || selectedDateInfo.date) : 
                          event.eventDate;
              dateSelector = selectedDateInfo ? 
                            selectedDateInfo.xpath : 
                            event.dateSelector;
            }
            
            // Calculate days until
            const dateObj = new Date(eventDate);
            const today = new Date();
            const daysUntil = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
            
            // Get notification preferences
            const notificationTriggers = {
              oneWeekBefore: notifyOneWeek.checked,
              threeDaysBefore: notifyThreeDays.checked,
              oneDayBefore: notifyOneDay.checked
            };
            
            try {
              // Update event
              await storageHelper.updateEvent(eventId, {
                url,
                eventName: eventName || 'Unnamed Event',
                eventDate,
                daysUntil,
                dateSelector,
                notificationTriggers
              });
              
              // Reset form
              urlInput.value = '';
              eventNameInput.value = '';
              manualDateInput.value = '';
              selectedDateInfo = null;
              selectedDateDisplay.textContent = 'No date selected yet';
              
              // Reset button
              addUrlBtn.textContent = 'Add Event';
              addUrlBtn.removeAttribute('data-edit-id');
              addUrlBtn.onclick = originalClickHandler;
              
              // Switch to events tab and refresh list
              tabButtons[0].click();
              loadUserEvents();
            } catch (error) {
              alert(`Failed to update event: ${error.message}`);
            }
          };
        } catch (error) {
          console.error('Error editing event:', error);
          alert(`Failed to edit event: ${error.message}`);
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
  
  // Helper function to format dates nicely
  function formatDate(date) {
    // Check if it's a string or a Date object
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Format as "Monday, January 1, 2023"
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
});