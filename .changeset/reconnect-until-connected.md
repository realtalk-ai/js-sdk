---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
"@realtalk-ai/embed": minor
---

A dropped connection is now retried for up to 5 minutes, about every 5 seconds after the first quick attempts and with a random spread, instead of giving up after about a minute. It reuses the session token it has while it is still valid instead of fetching a new one for every attempt, and `sessionTokenExpiresAt` in core reads a token's expiry. Reconnecting stops with a fatal error when the token request is refused or the new token is for another conversation. `startConversation` accepts a `getToken` of its own, which is used to fetch a fresh token when reconnecting. The embed widget tells the visitor their chat ended when it can no longer be resumed while reconnecting.
