// Content script for element selection on webpages

let selectorMode = false;
let highlightedElement = null;
let overlayElement = null;
let infoPanel = null;

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'activateSelectorMode') {
    activateSelectorMode(sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Function to activate selector mode
function activateSelectorMode(callback) {
  if (selectorMode) return;
  
  selectorMode = true;
  
  // Create overlay for instructions
  createInfoPanel();
  
  // Add event listeners for mouse movement
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleElementClick);
  
  // Add keyboard event listener for escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      deactivateSelectorMode();
      callback({ cancelled: true });
    }
  });
  
  // Callback will be called when an element is selected
}

// Function to deactivate selector mode
function deactivateSelectorMode() {
  selectorMode = false;
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('click', handleElementClick);
  
  // Clean up UI elements
  if (overlayElement) {
    document.body.removeChild(overlayElement);
    overlayElement = null;
  }
  
  if (infoPanel) {
    document.body.removeChild(infoPanel);
    infoPanel = null;
  }
}

// Handle mouse movement
function handleMouseMove(event) {
  // Get element under cursor
  const element = document.elementFromPoint(event.clientX, event.clientY);
  
  // Ignore our overlay elements
  if (element === overlayElement || element === infoPanel || element?.closest('.selector-info-panel')) {
    return;
  }
  
  // If we already highlighted this element, skip
  if (element === highlightedElement) {
    return;
  }
  
  // If we had a different element highlighted before, remove highlight
  if (highlightedElement) {
    removeHighlight();
  }
  
  // Highlight the new element
  highlightedElement = element;
  highlightElement(element);
  
  // Update the info panel with the selector
  updateInfoPanel(element);
}

// Handle element click
function handleElementClick(event) {
  if (!selectorMode || !highlightedElement) return;
  
  // Prevent default behavior
  event.preventDefault();
  event.stopPropagation();
  
  // Get the optimal selector for the element
  const selector = getOptimalSelector(highlightedElement);
  
  // Deactivate selector mode
  deactivateSelectorMode();
  
  // Send the selector back to the extension
  chrome.runtime.sendMessage({ 
    action: 'selectorSelected', 
    selector: selector 
  });
  
  // Also use the callback if available
  if (window.selectorCallback) {
    window.selectorCallback({ selector: selector });
  }
}

// Highlight an element
function highlightElement(element) {
  if (!element) return;
  
  // Save original styles
  element.dataset.originalOutline = element.style.outline;
  element.dataset.originalOutlineOffset = element.style.outlineOffset;
  
  // Apply highlight styles
  element.style.outline = '2px solid #4285f4';
  element.style.outlineOffset = '2px';
  
  // Create overlay for larger elements to improve visibility
  const rect = element.getBoundingClientRect();
  if (rect.width > 10 && rect.height > 10) {
    overlayElement = document.createElement('div');
    overlayElement.style.position = 'fixed';
    overlayElement.style.left = `${rect.left}px`;
    overlayElement.style.top = `${rect.top}px`;
    overlayElement.style.width = `${rect.width}px`;
    overlayElement.style.height = `${rect.height}px`;
    overlayElement.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
    overlayElement.style.pointerEvents = 'none';
    overlayElement.style.zIndex = '9998';
    document.body.appendChild(overlayElement);
  }
}

// Remove highlight from an element
function removeHighlight() {
  if (!highlightedElement) return;
  
  // Restore original styles
  highlightedElement.style.outline = highlightedElement.dataset.originalOutline || '';
  highlightedElement.style.outlineOffset = highlightedElement.dataset.originalOutlineOffset || '';
  
  // Remove overlay
  if (overlayElement) {
    document.body.removeChild(overlayElement);
    overlayElement = null;
  }
  
  highlightedElement = null;
}

// Create info panel
function createInfoPanel() {
  infoPanel = document.createElement('div');
  infoPanel.className = 'selector-info-panel';
  infoPanel.style.position = 'fixed';
  infoPanel.style.bottom = '20px';
  infoPanel.style.left = '20px';
  infoPanel.style.backgroundColor = 'white';
  infoPanel.style.border = '1px solid #ddd';
  infoPanel.style.borderRadius = '4px';
  infoPanel.style.padding = '10px';
  infoPanel.style.zIndex = '9999';
  infoPanel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  infoPanel.style.maxWidth = '80%';
  infoPanel.style.fontFamily = 'Arial, sans-serif';
  infoPanel.style.fontSize = '14px';
  
  infoPanel.innerHTML = `
    <div style="margin-bottom: 10px;">
      <strong>Element Selector Tool</strong>
      <p style="margin: 5px 0;">Hover over elements and click to select</p>
      <p style="margin: 5px 0;">Press ESC to cancel</p>
    </div>
    <div>
      <strong>Current Selector:</strong>
      <pre id="current-selector" style="margin: 5px 0; padding: 5px; background: #f5f5f5; border-radius: 4px; overflow: auto;"></pre>
    </div>
  `;
  
  document.body.appendChild(infoPanel);
}

// Update the info panel with element information
function updateInfoPanel(element) {
  if (!infoPanel || !element) return;
  
  const selector = getOptimalSelector(element);
  const selectorDisplay = document.getElementById('current-selector');
  
  if (selectorDisplay) {
    selectorDisplay.textContent = selector;
  }
}

// Generate an optimal CSS selector for an element
function getOptimalSelector(element) {
  if (!element) return '';
  
  // Try to use ID if available and unique
  if (element.id) {
    return `#${element.id}`;
  }
  
  // Try to use a unique class combination
  if (element.classList.length > 0) {
    const classSelector = Array.from(element.classList).map(c => `.${c}`).join('');
    if (document.querySelectorAll(classSelector).length === 1) {
      return classSelector;
    }
  }
  
  // Use tag name with classes
  if (element.classList.length > 0) {
    const tagWithClass = `${element.tagName.toLowerCase()}${Array.from(element.classList).map(c => `.${c}`).join('')}`;
    if (document.querySelectorAll(tagWithClass).length === 1) {
      return tagWithClass;
    }
  }
  
  // Use a more specific path-based selector
  let current = element;
  let selector = current.tagName.toLowerCase();
  let count = 0;
  
  // Build a path-based selector (limited to 3 levels to keep it manageable)
  while (current.parentElement && count < 3) {
    const parent = current.parentElement;
    const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
    
    if (siblings.length > 1) {
      // Need to differentiate from siblings
      const index = siblings.indexOf(current) + 1;
      selector = `${current.tagName.toLowerCase()}:nth-of-type(${index})`;
    }
    
    // Move up the tree
    current = parent;
    if (current.tagName !== 'BODY' && current.tagName !== 'HTML') {
      selector = `${current.tagName.toLowerCase()} > ${selector}`;
    }
    
    count++;
  }
  
  return selector;
}