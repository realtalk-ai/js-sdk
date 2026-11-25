---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
"@realtalk-ai/embed": minor
---

The embed widget now reconnects to an ongoing chat when the page loads, and again when the browser is back online or the tab becomes visible, so replies that arrive while the widget is minimized or the visitor is on another page are noticed right away. The launcher shows the number of new agent messages, also after a page load, and message sounds are unlocked by a click or key press anywhere on the page. If the widget's settings cannot be loaded because the server is unavailable, it keeps trying and appears as soon as they load. While the connection is lost, a bar above the input says the widget is reconnecting and the input is disabled, and a message that could not be sent stays in the input. A chat that can no longer be resumed is forgotten and the visitor is told it ended, while a temporary server error is retried quietly the same way as a dropped connection, for up to 5 minutes, with the widget showing that it is connecting, and keeps the stored chat if it still fails.

In `ConversationClient`, and so in the React and React Native SDKs, a dropped connection is now retried for up to 5 minutes, every few seconds after the first quick attempts and with a random spread, instead of giving up after about a minute. Reconnecting reuses the session token while it is still valid, stops with a fatal error when a new token is refused or is for another conversation, and stops when the conversation is ended. `sendMessage` returns whether the message was sent, which it is not while the connection is down. `startConversation` accepts a `getToken` of its own for fetching fresh tokens when reconnecting, and `sessionTokenExpiresAt` in core reads a token's expiry. The new retry behavior is `ConversationReconnectPolicy`, exported from core.
