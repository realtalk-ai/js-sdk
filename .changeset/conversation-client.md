---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
---

`ConversationClient` in core runs a conversation without any UI framework: it fetches session tokens, connects, keeps the messages and annotations, and reconnects when the connection drops. The React and React Native SDKs now use it, so both behave the same way; `useConversation` and its options are unchanged. `applyMessageEvent` is exported from core as well. `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.9.0 or later.

`useConnection` and `useMessages` are no longer exported from `@realtalk-ai/react` and `@realtalk-ai/react-native`. Use `useConversation`, which returns the same state and functions, or `ConversationClient` from `@realtalk-ai/core` for lower-level control.
