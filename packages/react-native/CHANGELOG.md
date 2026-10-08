# @realtalk-ai/react-native

## 0.4.0

### Minor Changes

- bec4f70: `endConversation` now reports the status as `finished` and keeps `conversationId`, the same as when the server ends the conversation. It used to reset the status to `not_started`, which made a conversation the user had ended look like one that never started. The messages are kept either way, and the next `startConversation` clears them as before.

  Apps that show their start button only when the status is `not_started` should check for `finished` too. Calling `endConversation` when no conversation was started still leaves `not_started`.

## 0.3.0

### Minor Changes

- 9083a9e: Add conversation modes. A mode is two independent flags, `userAudio` and `agentAudio`, that say which audio the conversation carries. Text always goes both ways. The mode is sent when connecting and can be changed on the open connection with the new `set_conversation_mode` event (`setMode` in `useConversation`), which the server confirms with a `conversation_mode` event.

  **Breaking:** `mode` is now an object instead of `"voice"` or `"text"`. Pass `{ userAudio: true, agentAudio: true }` where you passed `"voice"`. A conversation with both flags off is a real text-only conversation and the new default, also when no mode is given. Use `{ userAudio: false, agentAudio: true }` to keep hearing the agent in a typed conversation, which is what `"text"` and no mode used to do. `{ userAudio: true, agentAudio: false }` lets the user speak and read the replies.

  `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.6.0 or later, which sends the mode when connecting.

  The embed widget starts as a text chat and switches mode with its speaker and microphone buttons instead of playing muted audio.

## 0.2.1

### Patch Changes

- a3239f1: Widen the core peer dependency range to `>=0.3.0 <1.0.0` so new core 0.x minors no longer force a wrapper release.
