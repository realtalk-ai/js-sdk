---
"@realtalk-ai/core": minor
"@realtalk-ai/react": patch
"@realtalk-ai/react-native": patch
---

`ConversationClient` in core runs a conversation without any UI framework: it fetches session tokens, connects, keeps the messages and annotations, and reconnects when the connection drops. The React and React Native SDKs now use it, so both behave the same way; their hooks and options are unchanged. `applyMessageEvent` is exported from core as well. `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.9.0 or later.
