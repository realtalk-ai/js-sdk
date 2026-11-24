---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
"@realtalk-ai/embed": minor
---

The embed widget now reconnects to an ongoing chat when the page loads, and again when the browser is back online or the tab becomes visible, so replies that arrive while the widget is minimized or the visitor is on another page are noticed right away. The launcher shows the number of new agent messages, also after a page load, and message sounds are unlocked by a click or key press anywhere on the page. A chat that can no longer be resumed is forgotten and the visitor is told it ended, while a temporary server error keeps the stored chat.

In the React and React Native SDKs, a dropped connection is now retried for up to 5 minutes, about every 5 seconds after the first quick attempts and with a random spread, instead of giving up after about a minute. Reconnecting reuses the session token while it is still valid, stops with a fatal error when a new token is refused or is for another conversation, and stops when the conversation is ended. `startConversation` accepts a `getToken` of its own for fetching fresh tokens when reconnecting, and `sessionTokenExpiresAt` in core reads a token's expiry.
