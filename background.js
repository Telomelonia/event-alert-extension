// Load the storage helper
importScripts('scripts/storage-helper.js');

// Alarm names
const DAILY_CHECK_ALARM = 'dailyCheck';

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
    checkEvents();
  }
});

// Setup daily alarm
function setupAlarms() {
  // Clear any existing alarms
  chrome.alarms.clearAll();
  
  // Create daily alarm - runs once per day
  chrome.alarms.create(DAILY_CHECK_ALARM, {
    delayInMinutes: 1, // Start first check after 1 minute
    periodInMinutes: 24 * 60 // 24 hours in minutes
  });
  
  console.log('Alarm set up successfully');
  
  // Schedule a periodic check of alarm health
  setInterval(checkAlarmHealth, 12 * 60 * 60 * 1000); // Check every 12 hours
}

// Function to check events and send notifications
async function checkEvents() {
  console.log('Checking events');
  
  try {
    // Get all events
    const events = await storageHelper.getEvents();
    const preferences = await storageHelper.getPreferences();
    
    // Get today's date
    const today = new Date();
    
    // Process each event
    for (const event of events) {
      // Skip disabled events
      if (!event.enabled) continue;
      
      // Skip events that have already passed
      const eventDate = new Date(event.eventDate);
      if (eventDate < today) continue;
      
      // Calculate days until event
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
      
      // Check if we need to send notifications based on days until event
      let shouldNotify = false;
      let notificationMessage = '';
      
      if (daysUntil === 7 && event.notificationTriggers.oneWeekBefore) {
        shouldNotify = true;
        notificationMessage = `Event "${event.eventName}" is happening in 1 week!`;
      } else if (daysUntil === 3 && event.notificationTriggers.threeDaysBefore) {
        shouldNotify = true;
        notificationMessage = `Event "${event.eventName}" is happening in 3 days!`;
      } else if (daysUntil === 1 && event.notificationTriggers.oneDayBefore) {
        shouldNotify = true;
        notificationMessage = `Event "${event.eventName}" is happening tomorrow!`;
      }
      
      // Send notification if needed
      if (shouldNotify) {
        // Browser notification
        if (preferences.browserNotifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Event Reminder',
            message: notificationMessage,
            priority: 2
          });
        }
        
        // Mark as checked
        await storageHelper.updateEvent(event.id, { 
          lastChecked: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error checking events:', error);
  }
}

// Function to verify alarms are working correctly and recover if needed
async function checkAlarmHealth() {
  try {
    const alarms = await chrome.alarms.getAll();
    
    // Check if daily alarm exists
    const hasDaily = alarms.some(alarm => alarm.name === DAILY_CHECK_ALARM);
    
    if (!hasDaily) {
      console.warn('Alarm health check: Missing alarm, recreating...');
      setupAlarms();
    } else {
      console.log('Alarm health check: Alarm present');
    }
  } catch (error) {
    console.error('Error checking alarm health:', error);
  }
}

// Store active date detection tabs to manage their lifecycle
const dateDetectionTabs = new Map();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.action === 'openDateDetector') {
    openDateDetector(message.url)
      .then(dateInfo => {
        console.log('Returning date info to popup:', dateInfo);
        sendResponse(dateInfo);
      })
      .catch(error => {
        console.error('Error in date detection:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates async response
  }
  
  // Handle tab closed event
  if (message.action === 'tabClosed' && message.tabId) {
    if (dateDetectionTabs.has(message.tabId)) {
      dateDetectionTabs.delete(message.tabId);
    }
  }
  
  // Handle date selected event from content script
  if (message.action === 'dateSelected' && message.dateInfo) {
    const tabId = sender.tab.id;
    if (dateDetectionTabs.has(tabId)) {
      const callback = dateDetectionTabs.get(tabId);
      callback(message.dateInfo);
      dateDetectionTabs.delete(tabId);
      chrome.tabs.remove(tabId);
    }
  }
});

// Function to open a tab with the date detector
async function openDateDetector(url) {
  return new Promise((resolve, reject) => {
    try {
      // Open a new tab with the target website
      chrome.tabs.create({ url: url, active: true }, async (tab) => {
        console.log('New tab created for date detection:', tab.id);
        
        // Store a promise resolver for this tab
        dateDetectionTabs.set(tab.id, resolve);
        
        // Handle tab closing without selection
        chrome.tabs.onRemoved.addListener(function tabRemovedListener(tabId) {
          if (tabId === tab.id && dateDetectionTabs.has(tabId)) {
            console.log('Date detection tab closed without selection');
            dateDetectionTabs.delete(tabId);
            resolve(null);
            chrome.tabs.onRemoved.removeListener(tabRemovedListener);
          }
        });
        
        // Wait for the page to load
        chrome.tabs.onUpdated.addListener(function tabUpdatedListener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            console.log('Date detection page loaded, injecting content script');
            
            // Remove the listener to avoid duplicate injections
            chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
            
            // Inject the content script for date detection
            setTimeout(() => {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['scripts/content.js']
              })
              .then(() => {
                console.log('Content script injected, activating date detection');
                // Send a message to the content script to activate date detection
                chrome.tabs.sendMessage(tab.id, { action: 'detectDates' }, (response) => {
                  console.log('Got initial response from content script:', response);
                  // The actual date selection will come through the message listener
                  // This is just confirming the content script received our message
                });
              })
              .catch(error => {
                console.error('Failed to inject content script:', error);
                dateDetectionTabs.delete(tab.id);
                reject(error);
              });
            }, 500); // Give the page a moment to fully render
          }
        });
      });
    } catch (error) {
      console.error('Error opening date detector:', error);
      reject(error);
    }
  });
}