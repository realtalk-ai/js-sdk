---
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
---

`endConversation` now reports the status as `finished` and keeps `conversationId`, the same as when the server ends the conversation. It used to reset the status to `not_started`, which made a conversation the user had ended look like one that never started. The messages are kept either way, and the next `startConversation` clears them as before.

Apps that show their start button only when the status is `not_started` should check for `finished` too. Calling `endConversation` when no conversation was started still leaves `not_started`.
