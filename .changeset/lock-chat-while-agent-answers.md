---
"@realtalk-ai/react-native": minor
"@realtalk-ai/embed": minor
"@realtalk-ai/react": minor
"@realtalk-ai/core": minor
---

Add the `web_messages_accepted` event, and `canSendMessage` from `useConversation`, which is false from a `sendMessage` until shortly after the visitor's message shows up or the server sends that event (at most 15 seconds), and while the server does not accept messages; the embed widget locks its send button with it outside a handoff, and `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.8.0 or later.
