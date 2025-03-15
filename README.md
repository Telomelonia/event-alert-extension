# event-alert-extension

a Chrome extension called "EventAlert" that tracks specified URLs for event updates and sends email notifications. I've designed a serverless architecture to minimize costs.

# Event Alert Extension

A Chrome extension that monitors websites for changes and sends notifications when changes are detected.

## Features

- **Monitor Multiple Websites**: Add any number of URLs to track for changes
- **Selective Monitoring**: Choose specific elements on a page to monitor with an easy-to-use selector tool
- **Flexible Scheduling**: Set monitoring frequency to daily or weekly for each URL
- **Resource-Efficient**: Designed to be light on browser resources with optimized background checks
- **Notification Options**: Receive immediate, daily, or weekly digest notifications
- **Email Alerts**: Get email notifications when changes are detected
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
│   ├── content.js         # Content script for element selection
│   ├── firebase-app.js    # Firebase core (not in repo - download from Firebase)
│   ├── firebase-auth.js   # Firebase auth (not in repo - download from Firebase)
│   ├── firebase-firestore.js # Firebase Firestore (not in repo - download from Firebase)
│   └── firebase-init.js   # Firebase initialization
├── styles/
│   └── popup.css          # Styles for the popup UI
├── functions/             # Firebase Cloud Functions
│   ├── index.js           # Cloud function code for email notifications
│   └── package.json       # Node.js dependencies for functions
└── icons/
    ├── icon16.png         # Extension icon
    ├── icon48.png         # Extension icon
    └── icon128.png        # Extension icon
```

## Setup Instructions

### Prerequisites

- Google Chrome browser
- Node.js and npm (for Firebase functions)
- Firebase account

### Development Setup

1. **Clone the repository**:

   ```
   git clone https://github.com/yourusername/event-alert-extension.git
   cd event-alert-extension
   ```

2. **Set up Firebase**:

   - Create a new Firebase project at https://console.firebase.google.com/
   - Enable Authentication and Firestore
   - Download Firebase SDK files (firebase-app.js, firebase-auth.js, firebase-firestore.js) and place them in the `scripts` folder
   - Update `firebase-init.js` with your Firebase project credentials

3. **Set up Firebase Cloud Functions** (for email notifications):

   ```
   cd functions
   npm install
   firebase login
   firebase use --add
   ```

4. **Deploy Cloud Functions**:

   ```
   firebase deploy --only functions
   ```

5. **Load the extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

## Usage

1. **Create an account**:

   - Click the extension icon and register with email and password

2. **Add your first URL to monitor**:

   - Navigate to the "Add URL" tab
   - Enter the URL you want to monitor
   - Optionally select a specific element to track changes
   - Choose a check frequency (daily or weekly)
   - Click "Add URL"

3. **Configure notification settings**:

   - Go to the "Settings" tab
   - Set up your email notification preferences
   - Choose between immediate notifications or digests

4. **View and manage monitored URLs**:
   - The "My URLs" tab shows all sites you're monitoring
   - Toggle monitoring on/off as needed
   - Edit or delete entries

## Performance Considerations

The extension is designed to be resource-efficient:

- Checks run on scheduled intervals (daily or weekly), not continuously
- URLs are processed in batches to avoid overwhelming the browser
- Content is compared using efficient hashing algorithms
- Alarms are staggered to distribute server load

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Firebase Authentication and Firestore
- Uses Nodemailer for email notifications

---

For support or questions, please file an issue on this repository.
