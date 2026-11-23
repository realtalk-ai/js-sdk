---
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
"@realtalk-ai/embed": minor
---

A dropped connection is now retried until it is back, every 30 seconds after the first quick attempts, instead of giving up after about a minute. Reconnecting stops with a fatal error when the token request is refused or the new token is for another conversation. `startConversation` accepts a `getToken` of its own, which is used to fetch a fresh token when reconnecting. The embed widget tells the visitor their chat ended when it can no longer be resumed while reconnecting.
