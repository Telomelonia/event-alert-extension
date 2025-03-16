# Event Alert Extension

A Chrome extension that monitors websites for changes and sends browser notifications when changes are detected.

## Features

- **Monitor Multiple Websites**: Add any number of URLs to track for changes
- **Selective Monitoring**: Choose specific elements on a page to monitor with an easy-to-use selector tool
- **Flexible Scheduling**: Set monitoring frequency to hourly, daily, or weekly for each URL
- **Resource-Efficient**: Designed to be light on browser resources with optimized background checks
- **Browser Notifications**: Get instant notifications when changes are detected
- **User-Friendly Interface**: Easy-to-use dashboard to manage all your monitored URLs

## Project Structure

```
event-alert-extension/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker for monitoring
├── popup.html             # Main extension popup
├── onboarding.html        # User onboarding page
├── scripts/
│   ├── popup.js           # Popup UI functionality
│   └── content.js         # Content script for element selection
├── styles/
│   └── popup.css          # Styles for the popup UI
└── icons/
    ├── icon16.png         # Extension icon
    ├── icon48.png         # Extension icon
    └── icon128.png        # Extension icon
```

## Setup Instructions

### Prerequisites

- Google Chrome browser

### Development Setup

1. **Clone the repository**:

   ```
   git clone https://github.com/yourusername/event-alert-extension.git
   cd event-alert-extension
   ```

2. **Load the extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

## Usage

1. **Add your first URL to monitor**:

   - Click the extension icon to open the popup
   - Navigate to the "Add URL" tab
   - Enter the URL you want to monitor
   - Optionally select a specific element to track changes
   - Choose a check frequency (hourly, daily, or weekly)
   - Click "Add URL"

2. **Configure notification settings**:

   - Go to the "Settings" tab
   - Set your notification preferences
   - Choose between immediate notifications or digests

3. **View and manage monitored URLs**:
   - The "My URLs" tab shows all sites you're monitoring
   - Toggle monitoring on/off as needed
   - Edit or delete entries

## Performance Considerations

The extension is designed to be resource-efficient:

- Checks run on scheduled intervals (hourly, daily, or weekly), not continuously
- URLs are processed in batches to avoid overwhelming the browser
- Content is compared using efficient hashing algorithms
- Alarms are staggered to distribute resource usage

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

For support or questions, please file an issue on this repository.
