---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
---

Connect on protocol 2.

- `@realtalk-ai/core`: `connect` takes a `protocol` option. With `protocol: 2` the transport speaks the current wire protocol and translates event names, so the events you send and receive keep their names. Without it the transport stays on protocol 1.
- `@realtalk-ai/core`: new `conversation_status` event (`EventType.ConversationStatus`) with `status` `ongoing`, `idle` or `ended`. `conversation_finished` is deprecated and is only sent on protocol 1.
- `@realtalk-ai/react` and `@realtalk-ai/react-native` connect on protocol 2, end the conversation when its status is `ended`, and no longer send `hangup`. They need `@realtalk-ai/core` 0.8.0 or later.
