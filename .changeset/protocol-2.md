---
"@realtalk-ai/core": minor
"@realtalk-ai/react": minor
"@realtalk-ai/react-native": minor
---

Connect on protocol 2.

- `@realtalk-ai/core`: `connect` takes a `protocol` option; pass `protocol: 2`. Connecting without it, sending `hangup`, or sending an event with an `event` key logs a one-time warning. Send events under the dotted names in the README, such as `message.create` and `dtmf.press` (the old names still work); received events keep their names. A new `conversation_status` event (`EventType.ConversationStatus`) with `status` `ongoing`, `idle` or `ended` replaces the deprecated `conversation_finished`. The `start` event no longer declares `metadata`, and `agent_id` is optional, since the server never read either.
- `@realtalk-ai/react` and `@realtalk-ai/react-native` connect on protocol 2, end the conversation when its status is `ended`, and no longer send `hangup`. They need `@realtalk-ai/core` 0.8.0 or later.
