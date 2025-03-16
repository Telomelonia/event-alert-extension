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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openDateDetector') {
    openDateDetector(message.url, sendResponse);
    return true; // Indicates async response
  }
});

// Function to open a tab with the date detector
async function openDateDetector(url, callback) {
  try {
    // Open a new tab with the target website
    const tab = await chrome.tabs.create({ url: url, active: true });
    
    // Inject the content script for date detection
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/content.js']
    });
    
    // Send a message to the content script to activate date detection
    chrome.tabs.sendMessage(tab.id, { action: 'detectDates' }, (response) => {
      if (response && response.date) {
        callback({ date: response.date });
      }
    });
  } catch (error) {
    console.error('Error opening date detector:', error);
    callback({ error: error.message });
  }
}