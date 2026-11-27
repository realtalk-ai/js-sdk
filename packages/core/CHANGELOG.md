# @realtalk-ai/core

## 0.9.0

### Minor Changes

- ec87e50: `ConversationClient` in core runs a conversation without any UI framework: it fetches session tokens, connects, keeps the messages and annotations, and reconnects when the connection drops. The React and React Native SDKs now use it, so both behave the same way; `useConversation` and its options are unchanged. `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.9.0 or later.

  `useConnection` and `useMessages` are no longer exported from `@realtalk-ai/react` and `@realtalk-ai/react-native`. Use `useConversation`, which returns the same state and functions, or `ConversationClient` from `@realtalk-ai/core` for lower-level control.

  In `ConversationClient`, and so in the React and React Native SDKs, a dropped connection is now retried for up to 5 minutes, every few seconds after the first quick attempts and with a random spread, instead of giving up after about a minute. Reconnecting reuses the session token while it is still valid, stops with a fatal error when a new token is refused, or when its token has expired and the new one is for another conversation, and stops when the conversation is ended. `sendMessage` returns whether the message was sent, which it is not while the connection is down. `startConversation` accepts a `getToken` of its own for fetching fresh tokens when reconnecting, and `getToken` receives `{ conversationId }` (and `tokenUrl` a `conversation_id` parameter) when a token is renewed. The new retry behavior is `ConversationReconnectPolicy`, exported from core.

  `ConversationClient` and `RealTalkProvider` accept `reconnectPolicy`, and `null` ends the conversation instead of reconnecting when the connection drops. Status callbacks fire only when the status changes, a rejected token without `getToken` or `tokenUrl` ends the conversation instead of retrying, and a new conversation no longer starts as thinking.

  The embed widget now reconnects to an ongoing chat when the page loads, and again when the browser is back online or the tab becomes visible, so replies that arrive while the widget is minimized or the visitor is on another page are noticed right away. The launcher shows the number of new agent messages, also after a page load, and message sounds are unlocked by a click or key press anywhere on the page. If the widget's settings cannot be loaded because the server is unavailable, it keeps trying and appears as soon as they load. While the connection is lost, or the visitor is offline, a notice above the input says so and the input is disabled, and a message that could not be sent stays in the input. A chat that can no longer be resumed is forgotten and the visitor is told it ended, while a temporary server error is retried quietly the same way as a dropped connection, for up to 5 minutes, with the widget showing that it is connecting, and keeps the stored chat if it still fails.

## 0.8.0

### Minor Changes

- 320c237: Connect on protocol 2.
  - `@realtalk-ai/core`: `connect` takes a `protocol` option; pass `protocol: 2`. Connecting without it, sending `hangup`, or sending an event with an `event` key logs a one-time warning. Send DTMF with the hooks' `sendDTMF` or as `{ type: "dtmf", data }`. The events you send and receive keep their names. A new `conversation_status` event (`EventType.ConversationStatus`) with `status` `ongoing`, `idle` or `ended` replaces the deprecated `conversation_finished`. The `start` event no longer declares `metadata`, and `agent_id` is optional, since the server never read either.
  - `@realtalk-ai/react` and `@realtalk-ai/react-native` connect on protocol 2, end the conversation when its status is `ended`, and no longer send `hangup`. Their `onEvent` no longer receives `conversation_finished`; use `onStatusChange` or `conversation_status` instead. They need `@realtalk-ai/core` 0.8.0 or later.

## 0.7.0

### Minor Changes

- 6dd720f: Add the `annotation_created` event and `annotations` on `existing_messages`, return `annotations` and a `timeline` of messages and annotations from `useConversation`, and show "Waiting for human agent", a requested note and a joined note in the embed widget. `@realtalk-ai/react` now needs `@realtalk-ai/core` 0.7.0 or later.

## 0.6.1

### Patch Changes

- 948bb90: Report the installed package version when connecting. The embed widget now identifies itself as `embed` with its own version.

## 0.6.0

### Minor Changes

- 9083a9e: Add conversation modes. A mode is two independent flags, `userAudio` and `agentAudio`, that say which audio the conversation carries. Text always goes both ways. The mode is sent when connecting and can be changed on the open connection with the new `set_conversation_mode` event (`setMode` in `useConversation`), which the server confirms with a `conversation_mode` event.

  **Breaking:** `mode` is now an object instead of `"voice"` or `"text"`. Pass `{ userAudio: true, agentAudio: true }` where you passed `"voice"`. A conversation with both flags off is a real text-only conversation and the new default, also when no mode is given. Use `{ userAudio: false, agentAudio: true }` to keep hearing the agent in a typed conversation, which is what `"text"` and no mode used to do. `{ userAudio: true, agentAudio: false }` lets the user speak and read the replies.

  `@realtalk-ai/react` and `@realtalk-ai/react-native` now need `@realtalk-ai/core` 0.6.0 or later, which sends the mode when connecting.

  The embed widget starts as a text chat and switches mode with its speaker and microphone buttons instead of playing muted audio.

## 0.5.0

### Minor Changes

- 596cc09: Play caller and agent audio as two independently scheduled streams. Media frames can carry `media.source` ("user" or "agent", missing defaults to "agent"), the transport passes it through the audio callback, and the AudioPlayer keeps one playback timeline per source so simultaneous streams mix in the browser instead of queuing behind each other. The caller stream schedules frames gaplessly on arrival after an initial jitter buffer, rebuffering after underruns, and fires no playback callbacks. Playback callbacks and `clear()` apply to the agent stream only, so participant behavior is unchanged. Needed for observer listen-in on live phone calls, where caller audio streams continuously alongside agent speech.

## 0.4.0

### Minor Changes

- 3a1e467: Move `hasPendingSubTasks` from the embed package into core so any SDK consumer can tell whether the agent is still working on sub-tasks.
