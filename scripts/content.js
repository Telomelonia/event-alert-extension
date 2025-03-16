// Enhanced content script for date detection and element selection
let selectorMode = false;
let dateDetectionMode = false;
let selectedElement = null;
let highlightOverlay = null;
let infoPanel = null;
let detectedDates = [];

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'activateSelectorMode') {
    // Start selector tool
    startSelectorTool((selector) => {
      // When selection is complete, send response back
      sendResponse({ selector: selector });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.action === 'detectDates') {
    console.log('Starting date detection...');
    // Start date detection
    detectDatesOnPage((selectedDate) => {
      console.log('Date selected:', selectedDate);
      // When date is selected, send response back to background script
      sendResponse({ date: selectedDate });
      // Also send a message to the background script
      chrome.runtime.sendMessage({
        action: 'dateSelected',
        dateInfo: selectedDate
      });
    });
    return true; // Keep channel open for async response
  }
});

// Function to detect dates on the page
function detectDatesOnPage(callback) {
  dateDetectionMode = true;
  detectedDates = [];
  
  // Store callback for later use when a date is selected
  window.dateCallback = callback;
  
  // Create info panel for date detection
  createDateInfoPanel();
  
  // Find all text nodes in the document
  const textNodes = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walk.nextNode()) {
    if (node.nodeValue.trim() !== '') {
      textNodes.push(node);
    }
  }
  
  // Date patterns (supports various formats)
  const datePatterns = [
    // MM/DD/YYYY or DD/MM/YYYY
    /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](20\d{2})\b/g,
    // YYYY/MM/DD
    /\b(20\d{2})[\/\-](0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])\b/g,
    // Month DD, YYYY
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(0?[1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?,?\s+(20\d{2})\b/gi,
    // DD Month YYYY
    /\b(0?[1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(20\d{2})\b/gi,
    // Abbreviated Month DD (e.g., Jan 12, Feb 15, MAR 01)
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(0?[1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?\b/gi,
    // DD Abbreviated Month (e.g., 12 Jan, 15 Feb)
    /\b(0?[1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/gi,
    // Today, Tomorrow, Next Week, etc.
    /\b(today|tomorrow|next\s+week|next\s+month|next\s+weekend|this\s+weekend)\b/gi
  ];
  
  // Process each text node
  textNodes.forEach(textNode => {
    const parentElement = textNode.parentElement;
    const text = textNode.nodeValue;
    
    // Check each date pattern
    datePatterns.forEach(pattern => {
      let matches;
      while ((matches = pattern.exec(text)) !== null) {
        const matchText = matches[0];
        
        // Create a temporary element to highlight the date
        const range = document.createRange();
        const startIndex = text.indexOf(matchText, pattern.lastIndex - matchText.length);
        
        if (startIndex >= 0) {
          try {
            range.setStart(textNode, startIndex);
            range.setEnd(textNode, startIndex + matchText.length);
            
            // Store the date information
            detectedDates.push({
              date: matchText,
              element: parentElement,
              range: range,
              xpath: getXPathForElement(parentElement)
            });
            
            // Highlight the date text
            highlightDate(range, matchText);
          } catch (e) {
            console.log('Could not highlight date: ', e);
          }
        }
      }
    });
  });
  
  console.log(`Detected ${detectedDates.length} dates on page`);
  
  // Update info panel with detected dates
  updateDateInfoPanel();
  
  // Set up click event for date selection
  document.addEventListener('click', handleDateClick);
  
  // Set up escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      stopDateDetection();
      if (callback) callback(null);
    }
  });
}

// Create info panel with instructions and detected dates
function createDateInfoPanel() {
  infoPanel = document.createElement('div');
  infoPanel.className = 'selector-tool-ui';
  
  Object.assign(infoPanel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '350px',
    padding: '15px',
    backgroundColor: 'white',
    color: '#333',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    zIndex: '999999',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    maxHeight: '400px',
    overflowY: 'auto'
  });
  
  infoPanel.innerHTML = `
    <div style="margin-bottom: 10px">
      <h3 style="margin: 0 0 10px 0">Date Detection Tool</h3>
      <p style="margin: 0 0 5px 0">Click on a highlighted date to select it for monitoring.</p>
      <p style="margin: 0">Press ESC to cancel.</p>
    </div>
    <div>
      <h4 style="margin: 10px 0 5px 0">Detected Dates:</h4>
      <div id="detected-dates-list" style="max-height: 200px; overflow-y: auto;"></div>
    </div>
  `;
  
  document.body.appendChild(infoPanel);
}

// Update the info panel with detected dates
function updateDateInfoPanel() {
  if (!infoPanel) return;
  
  const datesList = infoPanel.querySelector('#detected-dates-list');
  
  if (detectedDates.length === 0) {
    datesList.innerHTML = '<p style="color: #777; font-style: italic;">No dates found on this page.</p>';
    return;
  }
  
  let html = '';
  detectedDates.forEach((dateInfo, index) => {
    html += `
      <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 5px; cursor: pointer;" 
           data-index="${index}" class="date-item">
        ${dateInfo.date}
      </div>
    `;
  });
  
  datesList.innerHTML = html;
  
  // Add click event listeners to date items
  const dateItems = datesList.querySelectorAll('.date-item');
  dateItems.forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.getAttribute('data-index'));
      selectDate(detectedDates[index]);
    });
  });
}

// Highlight a date on the page
function highlightDate(range, dateText) {
  const highlightElement = document.createElement('span');
  highlightElement.className = 'date-highlight';
  
  Object.assign(highlightElement.style, {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    border: '1px solid #FFC107',
    borderRadius: '2px',
    padding: '2px',
    cursor: 'pointer'
  });
  
  try {
    range.surroundContents(highlightElement);
  } catch (e) {
    console.log('Could not highlight date: ', e);
  }
}

// Handle date click for selection
function handleDateClick(e) {
  if (!dateDetectionMode) return;
  
  // Check if clicked element is a date highlight
  let targetElement = e.target;
  if (targetElement.className === 'date-highlight' || 
      targetElement.closest('.date-highlight')) {
    
    // Find the date info for this highlighted element
    let dateInfo = null;
    for (let i = 0; i < detectedDates.length; i++) {
      if (detectedDates[i].element.contains(targetElement) || targetElement.contains(detectedDates[i].element)) {
        dateInfo = detectedDates[i];
        break;
      }
    }
    
    if (dateInfo) {
      e.preventDefault();
      e.stopPropagation();
      selectDate(dateInfo);
    }
  }
}

// Select a date for monitoring
function selectDate(dateInfo) {
  // Stop date detection
  stopDateDetection();
  
  // Prepare date info to return
  const selectedDate = {
    date: dateInfo.date,
    xpath: dateInfo.xpath
  };
  
  // Parse the date to determine how far in the future it is
  const parsedDate = parseDate(dateInfo.date);
  if (parsedDate) {
    selectedDate.parsedDate = parsedDate.toISOString();
    
    // Calculate days until the event
    const today = new Date();
    const daysUntil = Math.ceil((parsedDate - today) / (1000 * 60 * 60 * 24));
    selectedDate.daysUntil = daysUntil;
  }
  
  console.log('Selected date:', selectedDate);
  
  // Return selected date via callback
  if (window.dateCallback) {
    window.dateCallback(selectedDate);
  }
}

// Stop date detection and clean up
function stopDateDetection() {
  if (!dateDetectionMode) return;
  
  dateDetectionMode = false;
  
  // Remove event listeners
  document.removeEventListener('click', handleDateClick);
  
  // Clean up UI
  if (infoPanel) {
    document.body.removeChild(infoPanel);
    infoPanel = null;
  }
  
  // Remove date highlights
  const highlights = document.querySelectorAll('.date-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
  });
  
  console.log('Date detection deactivated');
}

// Helper function to get XPath for an element
function getXPathForElement(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }
  
  if (element === document.body) {
    return '/html/body';
  }
  
  let ix = 0;
  const siblings = element.parentNode.childNodes;
  
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    
    if (sibling === element) {
      const path = getXPathForElement(element.parentNode);
      const tagName = element.tagName.toLowerCase();
      return `${path}/${tagName}[${ix + 1}]`;
    }
    
    if (sibling.nodeType === 1 && sibling.tagName.toLowerCase() === element.tagName.toLowerCase()) {
      ix++;
    }
  }
}

// Parse various date formats
function parseDate(dateStr) {
  dateStr = dateStr.toLowerCase().trim();
  
  // Handle relative dates
  if (dateStr.includes('today')) {
    return new Date();
  }
  
  if (dateStr.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  if (dateStr.includes('next week')) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }
  
  if (dateStr.includes('next month')) {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }
  
  if (dateStr.includes('this weekend') || dateStr.includes('next weekend')) {
    const weekend = new Date();
    // Get next Saturday
    weekend.setDate(weekend.getDate() + (6 - weekend.getDay()));
    return weekend;
  }
  
  // Try to parse with built-in Date parser
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Try abbreviated month formats (e.g. MAR 12, FEB 15)
  const abbrevMonths = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  
  // Try "MMM DD" format (e.g., "MAR 12", "FEB 15")
  const regexAbbrev1 = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
  const matchAbbrev1 = dateStr.match(regexAbbrev1);
  if (matchAbbrev1) {
    const monthName = matchAbbrev1[1].toLowerCase();
    const month = abbrevMonths[monthName];
    const day = parseInt(matchAbbrev1[2]);
    
    if (month !== undefined && day >= 1 && day <= 31) {
      // Use current year for abbreviated dates without year
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, month, day);
    }
  }
  
  // Try "DD MMM" format (e.g., "12 MAR", "15 FEB")
  const regexAbbrev2 = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;
  const matchAbbrev2 = dateStr.match(regexAbbrev2);
  if (matchAbbrev2) {
    const day = parseInt(matchAbbrev2[1]);
    const monthName = matchAbbrev2[2].toLowerCase();
    const month = abbrevMonths[monthName];
    
    if (month !== undefined && day >= 1 && day <= 31) {
      // Use current year for abbreviated dates without year
      const currentYear = new Date().getFullYear();
      return new Date(currentYear, month, day);
    }
  }
  
  // Try MM/DD/YYYY or DD/MM/YYYY format
  const regex1 = /(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/;
  const match1 = dateStr.match(regex1);
  if (match1) {
    // Since we don't know if it's MM/DD or DD/MM format, we'll favor MM/DD (US format)
    // You might want to make this configurable based on user's locale
    const month = parseInt(match1[1]) - 1; // Months are 0-indexed in JS
    const day = parseInt(match1[2]);
    const year = parseInt(match1[3]);
    
    // Validate month and day
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
    
    // Try the other way around (DD/MM)
    const month2 = parseInt(match1[2]) - 1;
    const day2 = parseInt(match1[1]);
    
    if (month2 >= 0 && month2 <= 11 && day2 >= 1 && day2 <= 31) {
      return new Date(year, month2, day2);
    }
  }
  
  // Try YYYY/MM/DD format
  const regex2 = /(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
  const match2 = dateStr.match(regex2);
  if (match2) {
    const year = parseInt(match2[1]);
    const month = parseInt(match2[2]) - 1;
    const day = parseInt(match2[3]);
    
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  
  // Try Month DD, YYYY format
  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  
  const regex3 = /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d{2})/i;
  const match3 = dateStr.match(regex3);
  if (match3) {
    const monthName = match3[1].toLowerCase();
    const month = months[monthName];
    const day = parseInt(match3[2]);
    const year = parseInt(match3[3]);
    
    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  
  // Try DD Month YYYY format
  const regex4 = /(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),?\s+(20\d{2})/i;
  const match4 = dateStr.match(regex4);
  if (match4) {
    const day = parseInt(match4[1]);
    const monthName = match4[2].toLowerCase();
    const month = months[monthName];
    const year = parseInt(match4[3]);
    
    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  
  // Could not parse the date
  return null;
}

// Rest of the selector tool code remains the same
function startSelectorTool(callback) {
  if (selectorMode) return;
  
  selectorMode = true;
  
  // Create helper UI elements
  createInfoPanel();
  
  // Store callback for later use
  window.selectorCallback = callback;
  
  // Add mouse tracking events
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleElementClick);
  
  // Add escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      stopSelectorTool();
      if (callback) callback(null);
    }
  });
  
  console.log('Selector tool activated');
}

// Stop the selector tool
function stopSelectorTool() {
  if (!selectorMode) return;
  
  selectorMode = false;
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleElementClick);
  
  // Clean up UI
  if (highlightOverlay) {
    document.body.removeChild(highlightOverlay);
    highlightOverlay = null;
  }
  
  if (infoPanel) {
    document.body.removeChild(infoPanel);
    infoPanel = null;
  }
  
  // If we had highlighted an element, restore its original style
  if (selectedElement) {
    selectedElement.style.outline = selectedElement.dataset.originalOutline || '';
    selectedElement = null;
  }
  
  console.log('Selector tool deactivated');
}

// Handle mouse movement for highlighting elements
function handleMouseMove(e) {
  if (!selectorMode) return;
  
  // Get element under cursor
  const element = document.elementFromPoint(e.clientX, e.clientY);
  
  // Ignore selector tool UI elements
  if (element === infoPanel || element === highlightOverlay || 
      (element && element.closest('.selector-tool-ui'))) {
    return;
  }
  
  // If it's the same element we already selected, do nothing
  if (element === selectedElement) return;
  
  // Remove highlight from previous element
  if (selectedElement) {
    selectedElement.style.outline = selectedElement.dataset.originalOutline || '';
  }
  
  // Highlight new element
  selectedElement = element;
  
  if (selectedElement) {
    // Save original style
    selectedElement.dataset.originalOutline = selectedElement.style.outline;
    
    // Apply highlight
    selectedElement.style.outline = '2px solid #4285F4';
    
    // Update info panel with element details
    updateInfoPanel(selectedElement);
    
    // Create or update overlay for visual feedback
    updateHighlightOverlay(selectedElement);
  }
}

// Handle element click for selection
function handleElementClick(e) {
  if (!selectorMode || !selectedElement) return;
  
  // Prevent default click behavior
  e.preventDefault();
  e.stopPropagation();
  
  // Generate optimal CSS selector
  const selector = generateSelector(selectedElement);
  
  // Stop selector tool
  stopSelectorTool();
  
  // Return selector via callback
  if (window.selectorCallback) {
    window.selectorCallback(selector);
  }
}

// Create info panel with instructions and current selector
function createInfoPanel() {
  infoPanel = document.createElement('div');
  infoPanel.className = 'selector-tool-ui';
  
  Object.assign(infoPanel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '300px',
    padding: '15px',
    backgroundColor: 'white',
    color: '#333',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    zIndex: '999999',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px'
  });
  
  infoPanel.innerHTML = `
    <div style="margin-bottom: 10px">
      <h3 style="margin: 0 0 10px 0">Element Selector Tool</h3>
      <p style="margin: 0 0 5px 0">Hover over an element and click to select it.</p>
      <p style="margin: 0">Press ESC to cancel.</p>
    </div>
    <div>
      <h4 style="margin: 10px 0 5px 0">Current Selector:</h4>
      <code id="current-selector" style="display: block; padding: 8px; background: #f5f5f5; border-radius: 4px; overflow-x: auto; white-space: nowrap;"></code>
    </div>
  `;
  
  document.body.appendChild(infoPanel);
}

// Update the info panel with details about the selected element
function updateInfoPanel(element) {
  if (!infoPanel || !element) return;
  
  const selector = generateSelector(element);
  const selectorDisplay = infoPanel.querySelector('#current-selector');
  
  if (selectorDisplay) {
    selectorDisplay.textContent = selector;
  }
}

// Create or update highlight overlay for visual feedback
function updateHighlightOverlay(element) {
  if (!element) return;
  
  const rect = element.getBoundingClientRect();
  
  if (!highlightOverlay) {
    highlightOverlay = document.createElement('div');
    highlightOverlay.className = 'selector-tool-ui';
    document.body.appendChild(highlightOverlay);
  }
  
  Object.assign(highlightOverlay.style, {
    position: 'fixed',
    top: rect.top + 'px',
    left: rect.left + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    border: '2px solid #4285F4',
    borderRadius: '2px',
    pointerEvents: 'none',
    zIndex: '999998'
  });
}

// Generate an optimal CSS selector for the element
function generateSelector(element) {
  if (!element) return '';
  
  // If element has an ID, use that (most specific)
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Check if a combination of classes uniquely identifies the element
  if (element.classList && element.classList.length > 0) {
    const classSelector = '.' + Array.from(element.classList).join('.');
    if (document.querySelectorAll(classSelector).length === 1) {
      return classSelector;
    }
  }
  
  // Try tag name + class combination
  if (element.classList && element.classList.length > 0) {
    const tagClassSelector = element.tagName.toLowerCase() + '.' + 
                           Array.from(element.classList).join('.');
    if (document.querySelectorAll(tagClassSelector).length === 1) {
      return tagClassSelector;
    }
  }
  
  // Use a more specific path with nth-child if needed
  const path = [];
  let currentElement = element;
  
  // Build path up to max 3 levels deep to avoid overly complex selectors
  for (let i = 0; i < 3; i++) {
    if (!currentElement || currentElement === document.body) break;
    
    let selector = currentElement.tagName.toLowerCase();
    
    // Add a class if it helps narrow down selection
    if (currentElement.classList && currentElement.classList.length > 0) {
      const mainClass = currentElement.classList[0];
      selector += `.${mainClass}`;
    }
    
    // Add nth-child if needed for uniqueness
    const parent = currentElement.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        el => el.tagName === currentElement.tagName
      );
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(currentElement) + 1;
        selector += `:nth-child(${index})`;
      }
    }
    
    path.unshift(selector);
    currentElement = currentElement.parentElement;
  }
  
  return path.join(' > ');
}