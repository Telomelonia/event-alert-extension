# Event Alert Extension Testing Checklist

Use this checklist to verify that all aspects of the extension are working correctly before distribution.

## Setup and Installation

- [x] Extension loads correctly in Chrome browser
- [x] Manifest.json has all required permissions
- [x] Onboarding page opens on first installation
- [x] Extension popup displays correctly with appropriate width

## Event Management

- [x] User can add a new event to monitor
- [ ] Date detection tool works correctly on web pages
- [x] Manual date input works correctly
- [x] Event list displays correctly with all monitored events
- [x] Color-coded status indicators show correctly based on days remaining
- [x] Toggle switches for enabling/disabling events work
- [x] User can delete events from monitoring
- [x] User can edit existing events
- [ ] Last checked time updates correctly after checks

## Date Detection

- [ ] Date detection correctly identifies various date formats:
  - [ ] MM/DD/YYYY or DD/MM/YYYY
  - [ ] YYYY/MM/DD
  - [ ] Month DD, YYYY (e.g., January 1, 2023)
  - [ ] DD Month YYYY (e.g., 1 January 2023)
  - [ ] Relative dates (Today, Tomorrow, Next Week)
- [ ] Date highlighting works on web pages
- [ ] Date selection registers correctly when clicked
- [ ] Parsed dates correctly calculate days until event

## Background Monitoring

- [ ] Daily alarm is created and fires correctly
- [ ] Event date proximity is calculated accurately
- [ ] Notification triggers work at appropriate time intervals (1 week, 3 days, 1 day)
- [ ] Error handling for network issues works correctly
- [ ] Alarm health check recovers from potential issues

## Notifications

- [ ] Browser notifications appear when events are approaching
- [ ] Notification content is clear and informative
- [ ] Notification preferences are respected

## Settings

- [ ] User can save notification preferences
- [ ] Browser notification toggle works
- [ ] Settings are saved correctly between sessions

## Storage

- [ ] Events are stored correctly in Chrome storage
- [ ] Events persist when browser is restarted
- [ ] Events sync across devices (if Chrome sync is enabled)
- [ ] User preferences are stored correctly

## Performance and Resource Usage

- [ ] Memory usage remains reasonable
- [ ] CPU usage spikes only during scheduled checks
- [ ] No resource leaks occur over time

## UI and Experience

- [ ] All UI elements render correctly
- [ ] Tab navigation works smoothly
- [ ] Form validation works correctly
- [ ] Loading states are shown appropriately
- [ ] Error messages are clear and helpful
- [ ] UI is appropriately spacious and not congested

## Cross-browser Testing

- [ ] Works in Chrome
- [ ] Works in other Chromium-based browsers (Edge, Brave, etc.)

## Edge Cases

- [ ] Handles very large pages correctly
- [ ] Handles pages with dynamic content appropriately
- [ ] Recovers gracefully from network interruptions
- [ ] Correctly handles pages with no detectable dates
- [ ] Handles events that have already passed

## Notes

Keep track of any issues discovered and their resolutions:

- https://github.com/Telomelonia/event-alert-extension/issues/1
- https://github.com/Telomelonia/event-alert-extension/issues/2

## Final Approval

- [ ] All tests passed
- [ ] Ready for distribution

Tested By: **\*\*\*\***\_\_**\*\*\*\*** Date: \***\*\_\_\*\***
