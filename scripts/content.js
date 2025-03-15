// Selector tool for picking elements on webpages
let selectorMode = false;
let selectedElement = null;
let highlightOverlay = null;
let infoPanel = null;

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'activateSelectorMode') {
    // Start selector tool
    startSelectorTool((selector) => {
      // When selection is complete, send response back
      sendResponse({ selector: selector });
    });
    return true; // Keep channel open for async response
  }
});

// Start the selector tool
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