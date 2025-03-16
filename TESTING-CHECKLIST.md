# Event Alert Extension Testing Checklist

Use this checklist to verify that all aspects of the extension are working correctly before distribution.

## Setup and Installation

- [ ] Extension loads correctly in Chrome browser
- [ ] Manifest.json has all required permissions
- [ ] Onboarding page opens on first installation

## URL Management

- [ ] User can add a new URL to monitor
- [ ] Element selector tool works correctly
- [ ] URL list displays correctly with all monitored URLs
- [ ] Toggle switches for enabling/disabling URLs work
- [ ] User can delete URLs from monitoring
- [ ] Last checked time updates correctly after checks
- [ ] User can edit existing URLs

## Background Monitoring

- [ ] Hourly alarm is created and fires correctly
- [ ] Daily alarm is created and fires correctly
- [ ] Weekly alarm is created and fires correctly
- [ ] URL content is fetched correctly
- [ ] Content comparison works for detecting changes
- [ ] Error handling for network issues works correctly
- [ ] Alarm health check recovers from potential issues

## Notifications

- [ ] Browser notifications appear when changes are detected
- [ ] Notification preferences are respected

## Settings

- [ ] User can save notification preferences
- [ ] Browser notification toggle works
- [ ] Notification frequency selection works
- [ ] Settings are saved correctly between sessions

## Performance and Resource Usage

- [ ] Batch processing of URLs works efficiently
- [ ] Memory usage remains reasonable
- [ ] CPU usage spikes only during scheduled checks
- [ ] No resource leaks occur over time

## UI and Experience

- [ ] All UI elements render correctly
- [ ] Tab navigation works smoothly
- [ ] Form validation works correctly
- [ ] Loading states are shown appropriately
- [ ] Error messages are clear and helpful

## Cross-browser Testing

- [ ] Works in Chrome
- [ ] Works in other Chromium-based browsers (Edge, Brave, etc.)

## Edge Cases

- [ ] Handles very large pages correctly
- [ ] Works with pages that require authentication (where possible)
- [ ] Handles pages with dynamic content appropriately
- [ ] Recovers gracefully from network interruptions
- [ ] Correctly handles cases when Chrome storage is full

## Storage

- [ ] URLs are correctly saved to Chrome storage
- [ ] User preferences are correctly saved to Chrome storage
- [ ] Data persists correctly between browser sessions
- [ ] Changes to URLs in storage are immediately reflected in UI

## Notes

Keep track of any issues discovered and their resolutions:

1.
2.
3.

## Final Approval

- [ ] All tests passed
- [ ] Ready for distribution

Tested By: ****\_\_\_\_**** Date: **\_\_**
