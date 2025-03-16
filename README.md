# Event Alert Extension

A Chrome extension that monitors websites for events with upcoming dates and sends timely notifications as the events approach.

## Features

- **Event Date Detection**: Automatically detect dates on web pages or add them manually
- **Smart Notifications**: Get alerts 1 week, 3 days, and 1 day before events
- **Visual Timeline**: Color-coded indicators show how close each event is
- **Flexible Monitoring**: Choose which notification timeframes to enable for each event
- **Event Management**: Easily add, edit, and delete monitored events
- **Resource-Efficient**: Designed to be light on browser resources with optimized background checks
- **Privacy-Focused**: All data is stored locally on your device - no servers or accounts required

## Project Structure

```
event-alert-extension/
├── manifest.json          # Extension configuration
├── background.js          # Background service worker for monitoring
├── popup.html             # Main extension popup
├── onboarding.html        # User onboarding page
├── scripts/
│   ├── popup.js           # Popup UI functionality
│   ├── content.js         # Content script for date detection
│   └── storage-helper.js  # Local storage utilities
├── styles/
│   └── popup.css          # Styles for the popup UI
└── icons/
    ├── icon16.png         # Extension icon
    ├── icon48.png         # Extension icon
    └── icon128.png        # Extension icon
```

## How It Works

### Date Detection

The extension uses an advanced date detection algorithm to find and highlight dates on web pages. It can identify various date formats:

- Standard formats (MM/DD/YYYY, DD/MM/YYYY, YYYY/MM/DD)
- Written formats (January 1, 2023 or 1 January 2023)
- Relative dates (Today, Tomorrow, Next Week)

When you visit a page with event information, the extension scans the page, highlights all detected dates, and lets you select the one that corresponds to your event.

### Event Monitoring

Once an event is added, the extension:

1. Calculates how many days remain until the event
2. Checks daily to identify approaching events
3. Triggers notifications based on your preferences (1 week, 3 days, 1 day before)
4. Updates the visual indicators in the extension popup

### User Interface

The extension features a clean, spacious interface with:

- Color-coded status indicators showing event proximity
- Easy-to-use tabs for managing events and settings
- Visual date detection tool
- Simple configuration options

## Setup Instructions

### Prerequisites

- Google Chrome browser or any Chromium-based browser (Edge, Brave, etc.)

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

1. **Add your first event to monitor**:

   - Click the extension icon to open the popup
   - Go to the "Add Event" tab
   - Enter the URL containing the event information
   - Use "Detect Dates" to automatically find dates on the page, or enter a date manually
   - Add an optional event name
   - Select notification preferences
   - Click "Add Event"

2. **Configure notification settings**:

   - Go to the "Settings" tab
   - Set your notification preferences
   - Save your settings

3. **View and manage your events**:
   - The "My Events" tab shows all events you're monitoring
   - Color indicators show how close each event is
   - Toggle monitoring on/off as needed
   - Edit or delete entries

## Performance Considerations

The extension is designed to be resource-efficient:

- Checks run on a daily schedule, not continuously
- Date detection is only activated when requested
- Content is parsed efficiently to minimize memory usage
- Local storage keeps data footprint small

## Browser Compatibility

The extension is compatible with:

- Google Chrome
- Microsoft Edge
- Brave Browser
- Other Chromium-based browsers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Uses Chrome's storage API for data persistence
- Uses the Chrome alarms API for scheduled checks

---

For support or questions, please file an issue on this repository.
