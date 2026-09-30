# @realtalk-ai/react

## 0.5.0

### Minor Changes

- 9083a9e: Add conversation modes. A mode is two independent flags, `userAudio` and `agentAudio`, that say which audio the conversation carries. Text always goes both ways. The mode is sent when connecting and can be changed on the open connection with the new `set_conversation_mode` event (`setMode` in `useConversation`), which the server confirms with a `conversation_mode` event.

  **Breaking:** `mode` is now an object instead of `"voice"` or `"text"`. Pass `{ userAudio: true, agentAudio: true }` where you passed `"voice"`. A conversation with both flags off is a real text-only conversation and the new default, also when no mode is given. Use `{ userAudio: false, agentAudio: true }` to keep hearing the agent in a typed conversation, which is what `"text"` and no mode used to do. `{ userAudio: true, agentAudio: false }` lets the user speak and read the replies.

  `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.6.0 or later, which sends the mode when connecting.

  The embed widget starts as a text chat and switches mode with its speaker and microphone buttons instead of playing muted audio.

## 0.4.0

### Minor Changes

- 596cc09: Play caller and agent audio as two independently scheduled streams. Media frames can carry `media.source` ("user" or "agent", missing defaults to "agent"), the transport passes it through the audio callback, and the AudioPlayer keeps one playback timeline per source so simultaneous streams mix in the browser instead of queuing behind each other. The caller stream schedules frames gaplessly on arrival after an initial jitter buffer, rebuffering after underruns, and fires no playback callbacks. Playback callbacks and `clear()` apply to the agent stream only, so participant behavior is unchanged. Needed for observer listen-in on live phone calls, where caller audio streams continuously alongside agent speech.

## 0.3.1

### Patch Changes

- a3239f1: Widen the core peer dependency range to `>=0.3.0 <1.0.0` so new core 0.x minors no longer force a wrapper release.
