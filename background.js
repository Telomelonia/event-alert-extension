// Initialize Firebase when the background script loads
try {
  importScripts(
    'scripts/firebase-app.js',
    'scripts/firebase-auth.js',
    'scripts/firebase-firestore.js',
    'scripts/config.js',
    'scripts/firebase-init.js'
  );
  console.log('Firebase scripts loaded successfully');
} catch (error) {
  console.error('Error loading Firebase scripts:', error);
}
  // Alarm names
  const DAILY_CHECK_ALARM = 'dailyCheck';
  const WEEKLY_CHECK_ALARM = 'weeklyCheck';
  
  // Set up alarms when extension is installed or updated
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('Event Alert Extension installed/updated');
    setupAlarms();
    
    // Open onboarding page on install
    if (details.reason === 'install') {
      chrome.tabs.create({
        url: chrome.runtime.getURL('onboarding.html')
      });
    }
  });
  
  // Listen for alarm events
  chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm triggered:', alarm.name);
    
    if (alarm.name === DAILY_CHECK_ALARM) {
      checkURLs('daily');
    } else if (alarm.name === WEEKLY_CHECK_ALARM) {
      checkURLs('weekly');
    }
  });
  
  // Setup scheduled alarms
  function setupAlarms() {
    // Clear any existing alarms
    chrome.alarms.clearAll();
    
    // Slightly randomize the alarm start times to distribute server load
    // This helps prevent all users from checking at exactly the same time
    
    // Random offset between 0-60 minutes for daily checks
    const dailyOffset = Math.floor(Math.random() * 60);
    
    // Random offset between 0-240 minutes (4 hours) for weekly checks
    const weeklyOffset = Math.floor(Math.random() * 240);
    
    // Create daily alarm - runs once per day with offset
    chrome.alarms.create(DAILY_CHECK_ALARM, {
      delayInMinutes: dailyOffset,
      periodInMinutes: 24 * 60 // 24 hours in minutes
    });
    
    // Create weekly alarm - runs once per week with offset
    chrome.alarms.create(WEEKLY_CHECK_ALARM, {
      delayInMinutes: weeklyOffset,
      periodInMinutes: 7 * 24 * 60 // 7 days in minutes
    });
    
    console.log(`Alarms set up successfully (daily offset: ${dailyOffset} min, weekly offset: ${weeklyOffset} min)`);
    
    // Schedule a periodic check of alarm health
    setInterval(checkAlarmHealth, 12 * 60 * 60 * 1000); // Check every 12 hours
  }
  
  // Function to check URLs based on frequency
  async function checkURLs(frequency) {
    console.log(`Checking ${frequency} URLs`);
    
    try {
      // Get current user
      const user = firebaseModule.auth.getCurrentUser();
      if (!user) {
        console.log('No user logged in, skipping checks');
        return;
      }
      
      // Get the Firestore database
      const db = firebase.firestore();
      
      // Query for URLs with the specified frequency that are enabled
      const urlsSnapshot = await db.collection('monitoredURLs')
        .where('userId', '==', user.uid)
        .where('frequency', '==', frequency)
        .where('enabled', '==', true)
        .get();
      
      if (urlsSnapshot.empty) {
        console.log(`No ${frequency} URLs to check`);
        return;
      }
      
      console.log(`Found ${urlsSnapshot.size} ${frequency} URLs to check`);
      
      // Process URLs in batches to be more efficient
      const changedURLs = [];
      const batchSize = 5; // Check 5 URLs at a time to avoid excessive resource usage
      const urlDocs = urlsSnapshot.docs;
      
      // Process in batches
      for (let i = 0; i < urlDocs.length; i += batchSize) {
        const batch = urlDocs.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (doc) => {
            const urlData = doc.data();
            const urlId = doc.id;
            
            try {
              const hasChanged = await checkURLForChanges(urlData, urlId);
              if (hasChanged) {
                return {
                  url: urlData.url,
                  id: urlId
                };
              }
              return null;
            } catch (error) {
              console.error(`Error checking URL ${urlData.url}:`, error);
              // Update last checked timestamp even if error occurred
              await db.collection('monitoredURLs').doc(urlId).update({
                lastChecked: firebase.firestore.FieldValue.serverTimestamp(),
                lastError: error.message
              });
              return null;
            }
          })
        );
        
        // Collect changes from this batch
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            changedURLs.push(result.value);
          }
        });
        
        // Add a small delay between batches to avoid overwhelming the browser
        if (i + batchSize < urlDocs.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // If any URLs changed, handle notifications
      if (changedURLs.length > 0) {
        await sendNotifications(changedURLs, user.uid);
      }
      
    } catch (error) {
      console.error('Error in checkURLs:', error);
    }
  }
  
  // Function to check a single URL for changes
  async function checkURLForChanges(urlData, urlId) {
    console.log(`Checking URL: ${urlData.url}`);
    
    try {
      // Fetch the page content
      const response = await fetch(urlData.url);
      const html = await response.text();
      
      // Extract content based on selector or use full HTML
      let content = html;
      if (urlData.selector) {
        // Simple DOM parsing to extract selector content
        // Note: A more robust implementation would use DOMParser
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const selectedElements = tempDiv.querySelectorAll(urlData.selector);
        if (selectedElements.length > 0) {
          content = Array.from(selectedElements).map(el => el.outerHTML).join('');
        }
      }
      
      // Hash the content for comparison
      const contentHash = await hashString(content);
      
      // Get the Firestore database
      const db = firebase.firestore();
      
      // Check if content has changed
      let hasChanged = false;
      if (urlData.lastContentHash && urlData.lastContentHash !== contentHash) {
        console.log(`Content changed for ${urlData.url}`);
        hasChanged = true;
      } else if (!urlData.lastContentHash) {
        console.log(`First check for ${urlData.url}`);
        // First time checking, not considered a change
      } else {
        console.log(`No changes for ${urlData.url}`);
      }
      
      // Update the document with the new content hash and timestamp
      await db.collection('monitoredURLs').doc(urlId).update({
        lastChecked: firebase.firestore.FieldValue.serverTimestamp(),
        lastContentHash: contentHash,
        hasChanged: hasChanged
      });
      
      return hasChanged;
    } catch (error) {
      console.error(`Error checking ${urlData.url}:`, error);
      throw error;
    }
  }
  
  // Function to send notifications for changed URLs
  async function sendNotifications(changedURLs, userId) {
    console.log(`Sending notifications for ${changedURLs.length} changed URLs`);
    
    try {
      // Get the Firestore database
      const db = firebase.firestore();
      
      // Get user preferences
      const prefsDoc = await db.collection('userPreferences').doc(userId).get();
      if (!prefsDoc.exists) {
        console.log('No user preferences found, skipping notifications');
        return;
      }
      
      const prefs = prefsDoc.data();
      if (!prefs.emailNotifications) {
        console.log('Email notifications disabled in preferences');
        return;
      }
      
      // Get notification frequency preference
      const notificationFrequency = prefs.notificationFrequency || 'immediate';
      
      if (notificationFrequency === 'immediate') {
        // Send immediate notification - in a production app,
        // you would call a Cloud Function or server API here
        console.log('Would send immediate notification to:', prefs.notificationEmail);
        
        // Create a notification record in Firestore
        await db.collection('notifications').add({
          userId: userId,
          changedURLs: changedURLs,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'pending',
          notificationType: 'email',
          recipientEmail: prefs.notificationEmail
        });
      } else {
        // For digests, just create records that will be processed by a Cloud Function
        console.log(`Will include in ${notificationFrequency} digest for:`, prefs.notificationEmail);
        
        // Add to digest queue
        await db.collection('digestQueue').add({
          userId: userId,
          changedURLs: changedURLs,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          digestType: notificationFrequency,
          recipientEmail: prefs.notificationEmail
        });
      }
      
      // Also show a browser notification
      showBrowserNotification(changedURLs);
      
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }
  
  // Function to show browser notification
  function showBrowserNotification(changedURLs) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Website Changes Detected',
      message: `Changes detected on ${changedURLs.length} website${changedURLs.length > 1 ? 's' : ''}. Click to view details.`,
      priority: 2
    });
  }
  
  // Hash function for content comparison
  async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Optional: Listen for notification clicks
  chrome.notifications.onClicked.addListener((notificationId) => {
    // Open the extension popup when notification is clicked
    chrome.action.openPopup();
  });
  
  // Function to verify alarms are working correctly and recover if needed
  async function checkAlarmHealth() {
    try {
      const alarms = await chrome.alarms.getAll();
      
      // Check if both expected alarms exist
      const hasDaily = alarms.some(alarm => alarm.name === DAILY_CHECK_ALARM);
      const hasWeekly = alarms.some(alarm => alarm.name === WEEKLY_CHECK_ALARM);
      
      if (!hasDaily || !hasWeekly) {
        console.warn('Alarm health check: Missing alarms, recreating...');
        setupAlarms();
      } else {
        console.log('Alarm health check: All alarms present');
      }
    } catch (error) {
      console.error('Error checking alarm health:', error);
    }
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openSelectorTool') {
      openSelectorTool(message.url, sendResponse);
      return true; // Indicates async response
    }
  });
  
  // Function to open a tab with the selector tool
  async function openSelectorTool(url, callback) {
    try {
      // Open a new tab with the target website
      const tab = await chrome.tabs.create({ url: url, active: true });
      
      // Inject the content script for selector picking
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['scripts/content.js']
      });
      
      // Send a message to the content script to activate selector mode
      chrome.tabs.sendMessage(tab.id, { action: 'activateSelectorMode' }, (response) => {
        if (response && response.selector) {
          callback({ selector: response.selector });
        }
      });
    } catch (error) {
      console.error('Error opening selector tool:', error);
      callback({ error: error.message });
    }
  }