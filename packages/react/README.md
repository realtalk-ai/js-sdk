# @realtalk-ai/react

[![CI](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@realtalk-ai/react)](https://www.npmjs.com/package/@realtalk-ai/react)

React hooks for Real Talk voice and text conversations. Built on top of [`@realtalk-ai/core`](../core/README.md).

## Install

```bash
npm install @realtalk-ai/react @realtalk-ai/core react
```

## Quick start

Wrap your app with the provider, then use the `useConversation` hook to start a voice session:

```tsx
import { RealTalkProvider, useConversation } from "@realtalk-ai/react";

const App = () => {
  return (
    <RealTalkProvider tokenUrl="https://your-server.com/api/token">
      <Chat />
    </RealTalkProvider>
  );
};

const Chat = () => {
  const {
    connectionStatus,
    status,
    messages,
    startConversation,
    endConversation,
  } = useConversation({
    onMessage: (message) => console.log("New message:", message.text),
    onError: (error) => console.error(error),
  });

  return (
    <div>
      <p>
        Status: {status} ({connectionStatus})
      </p>

      {messages.map((msg) => (
        <p key={msg.id}>
          {msg.role}: {msg.text}
        </p>
      ))}

      {status === "not_started" || status === "finished" ? (
        <button
          onClick={() =>
            startConversation({
              agentId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
              mode: { userAudio: true, agentAudio: true },
            })
          }
        >
          Start
        </button>
      ) : (
        <button onClick={endConversation}>End</button>
      )}
    </div>
  );
};
```

## Provider

`RealTalkProvider` sets up shared configuration for all hooks in its subtree:

```tsx
<RealTalkProvider
  tokenUrl="https://your-server.com/api/token"
  baseUrl="wss://custom-ws.example.com"
  getToken={async () => ({ token: "...", conversationId: "..." })}
>
  {children}
</RealTalkProvider>
```

| Prop              | Default                       | Description                                                                             |
| ----------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| `tokenUrl`        | —                             | URL to fetch a session token (returns `{ token, conversation_id }`)                     |
| `getToken`        | —                             | Async function returning a token string or `{ token, conversationId }`                  |
| `baseUrl`         | `DEFAULT_WS_URL`              | WebSocket server URL                                                                    |
| `reconnectPolicy` | `ConversationReconnectPolicy` | When to reconnect after a dropped connection, or `null` to end the conversation instead |

Provide either `tokenUrl` or `getToken` — the hook uses one to obtain session tokens.

## useConversation

The main hook — combines connection, messages, and audio controls into a single interface.

```ts
const conversation = useConversation(options);
```

### State

| Field              | Type                        | Description                                                             |
| ------------------ | --------------------------- | ----------------------------------------------------------------------- |
| `connectionStatus` | `ConnectionStatus`          | `"disconnected"` \| `"connecting"` \| `"connected"` \| `"reconnecting"` |
| `status`           | `ConversationStatus`        | `"not_started"` \| `"active"` \| `"paused"` \| `"finished"`             |
| `conversationId`   | `string \| null`            | Current conversation ID                                                 |
| `messages`         | `Message[]`                 | Conversation messages                                                   |
| `annotations`      | `AnnotationItem[]`          | Conversation annotations, such as a human agent joining                 |
| `timeline`         | `TimelineItem[]`            | Messages and annotations in one list, in time order                     |
| `error`            | `ConversationError \| null` | Current error                                                           |
| `mode`             | `ConversationMode`          | Current mode: whether the user and the agent use audio                  |
| `agentState`       | `AgentState`                | `"idle"` \| `"thinking"` \| `"speaking"`                                |
| `userState`        | `UserState`                 | `"idle"` \| `"speaking"`                                                |
| `volume`           | `number`                    | Audio playback volume (0–1)                                             |
| `isMicMuted`       | `boolean`                   | Microphone mute state                                                   |
| `isMicEnabled`     | `boolean`                   | Whether a microphone is currently attached                              |
| `isAudioMuted`     | `boolean`                   | Audio output mute state                                                 |

### Methods

| Method                       | Description                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `startConversation(options)` | Start a conversation session                                                                 |
| `endConversation()`          | End the conversation and the current session                                                 |
| `sendMessage(text)`          | Send a text message. Returns `false` and sends nothing while the connection is down          |
| `sendDTMF(digit)`            | Send a DTMF tone                                                                             |
| `sendEvent(payload)`         | Send an event to the server                                                                  |
| `toggleMic()`                | Toggle microphone mute                                                                       |
| `toggleAudio()`              | Toggle audio output mute                                                                     |
| `setVolume(volume)`          | Set playback volume                                                                          |
| `enableMic(deviceId?)`       | Ask for mic permission and start streaming, so a text conversation can turn into a voice one |
| `disableMic()`               | Stop streaming and release the microphone                                                    |
| `mode`                       | The conversation mode the server has confirmed                                               |
| `setMode(mode, deviceId?)`   | Change the conversation mode on the open connection; `userAudio` also enables the microphone |
| `clearMessages()`            | Clear the local messages and annotations                                                     |

### Session options

```ts
startConversation({
  agentId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  mode: { userAudio: true, agentAudio: true }, // both default to false
  audioDeviceId: "...", // specific microphone
});
```

| Option           | Description                                                                    |
| ---------------- | ------------------------------------------------------------------------------ |
| `agentId`        | The agent to talk to                                                           |
| `conversationId` | Resume this conversation instead of using the one from the token               |
| `token`          | A session token you already have, instead of fetching one through the provider |
| `mode`           | Which audio the conversation carries, text only by default                     |
| `audioDeviceId`  | The microphone to use                                                          |

### Conversation modes

The mode is two independent flags that say which audio the conversation carries. Text always goes both ways.

| `userAudio` | `agentAudio` | You send       | The agent replies with | Notes                                |
| ----------- | ------------ | -------------- | ---------------------- | ------------------------------------ |
| `false`     | `false`      | typed messages | text                   | The default                          |
| `false`     | `true`       | typed messages | text and speech        | Text appears in step with the speech |
| `true`      | `true`       | speech or text | text and speech        | A voice conversation                 |
| `true`      | `false`      | speech or text | text                   | Speak and read the replies           |

`userAudio` enables the microphone. `enableMic()` is a shortcut that turns both flags on.

Change mode mid-conversation with `setMode`. The connection and the conversation stay the same, and an ongoing reply becomes audible (or silent) from its next sentence. The server may refuse a change when it is out of capacity for audio; `mode` then keeps its value and `onError` receives a non-fatal error.

```ts
const { mode, setMode } = useConversation();

await setMode({ userAudio: false, agentAudio: true }); // start hearing the agent
await setMode({ userAudio: true, agentAudio: true }); // and talk to it
```

### Paused conversations

The server may pause an idle conversation by closing the connection; `status` then becomes `"paused"` while `conversationId` is kept. This is not an error and the SDK does not auto-reconnect. Call `startConversation` again (with a token for the same conversation id) to resume, and the server replays the conversation's messages on connect.

### Reconnecting

When the connection drops, for example while the server restarts or the network is away, `connectionStatus` becomes `"reconnecting"` and the SDK tries again within a few seconds and then every few seconds, with a random spread so that many clients do not reconnect at the same moment. After 5 minutes without a connection it gives up: `status` becomes `"not_started"` and `onError` receives a fatal error. While reconnecting it uses the session token it already has as long as that token is valid. It asks for a new one when the token is about to expire or when an attempt with it failed, and passes the conversation's id along: `getToken` receives `{ conversationId }` and `tokenUrl` gets a `conversation_id` query parameter. Return a token for that conversation if your backend can. A token endpoint that always starts a new conversation also works: the SDK then keeps using its current token while it is valid. To stop reconnecting because the conversation is gone, have `getToken` throw an `ApiError` (from `@realtalk-ai/core`) with a 4xx status other than 429; any other error is retried. A `getToken` passed to `startConversation` is used before the provider's, so you can pass it together with `token` when you already have a token for the first connection:

```ts
startConversation({
  agentId: "your-agent-id",
  conversationId,
  token,
  getToken: ({ conversationId }) => fetchTokenFor(conversationId),
});
```

The SDK stops reconnecting and reports a fatal error when the token request is refused, when the server rejects the token and there is no `getToken` or `tokenUrl` to get a new one, or when the current token has expired and the new one is for another conversation. Pass `reconnectPolicy={null}` to `RealTalkProvider` to end the conversation instead of reconnecting when the connection drops.

### Timeline

`timeline` holds the messages and annotations in one list, each item `{ type: "message", message }` or `{ type: "annotation", annotation }`. Messages keep the order they have in `messages`, and each annotation comes before the first message created after it. `buildTimeline(messages, annotations)` from `@realtalk-ai/core` builds the same list from your own messages and annotations, for example ones loaded over REST.

### Options and callbacks

```ts
useConversation({
  onMessage: (message) => {},
  onAnnotation: (item) => {},
  onError: (error) => {},
  onStatusChange: (status) => {},
  onConnectionStatusChange: (connectionStatus) => {},
  onEvent: (event) => {},
  onModeRefused: (requestedMode, currentMode) => {},
  startMuted: false,
});
```

With `startMuted: true`, playback starts at volume 0 but still runs silently in real time so the conversation keeps its natural pacing; unmuting with `toggleAudio` or `setVolume` makes the rest of the current reply audible.

The `onMessage` and `onAnnotation` callbacks fire only for live events, not for the history the server sends on connect. `onMessage` can fire several times for one message as it updates, and `onAnnotation` fires for each annotation the server sends, such as a human agent joining. Annotations of a kind this SDK version doesn't know are dropped, so they never reach `onAnnotation`. Key on `id` to act once per message or annotation.

The `onEvent` callback receives server events like `message_created`, `message_updated`, `vad`, and others. Use `sendEvent` to send other events to the server. See the [core package events reference](../core/README.md#events) for the full list of event types and their payloads.

## Lower-level hooks

For control beyond `useConversation`, use `ConversationClient` from `@realtalk-ai/core`: it runs the connection, session tokens, reconnecting and the message list without React, and `useConversation` is built on it.

These smaller hooks are also exported:

| Hook                | Description                                |
| ------------------- | ------------------------------------------ |
| `useAudioControls`  | Microphone mute and volume control         |
| `useRealTalkConfig` | Access provider configuration from context |

## Audio

The package includes two audio classes for browser-based capture and playback:

### AudioRecorder

Captures microphone audio using an AudioWorklet, resamples to 16 kHz, and emits PCM chunks.

```ts
const recorder = new AudioRecorder();

await recorder.start((chunk: Int16Array) => {
  // send chunk over WebSocket
});

recorder.setMuted(true);
recorder.stop();
```

### AudioPlayer

Queues and plays back 16 kHz PCM audio from the agent.

```ts
const player = new AudioPlayer({
  onPlaybackStart: () => {},
  onPlaybackEnd: () => {},
});

player.play(pcmChunk, traceId);
player.setVolume(0.5);
player.clear();
player.stop();
```

## Text-only mode

A session with both flags off is text only, which gives the fastest responses when no speech is needed:

```ts
const { messages, sendMessage, startConversation, status } = useConversation();

await startConversation({
  agentId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  mode: { userAudio: false, agentAudio: false },
});

sendMessage("Hello!");
```

## Markdown

Agent replies often contain markdown. `Markdown` renders a message's text as HTML, including replies that are still streaming in:

```tsx
import type { Message } from "@realtalk-ai/core";
import { Markdown } from "@realtalk-ai/react";

const Messages = ({ messages }: { messages: Message[] }) => (
  <div>
    {messages.map((msg) =>
      msg.role === "agent" ? (
        <Markdown key={msg.id}>{msg.text}</Markdown>
      ) : (
        <p key={msg.id}>{msg.text}</p>
      ),
    )}
  </div>
);
```

- Unfinished markdown, like bold text or a link still being written, is closed so partial replies render cleanly. A link shows only its text until its URL is complete.
- GitHub flavored markdown is supported, so tables, strikethrough and bare URLs work. Single line breaks are kept.
- Links open in a new tab. `tel:` and `sms:` links also work and open in the same tab. Raw HTML in the text is shown as text, not rendered.
- No styles are included. The output is plain HTML inside a `div` with the class `rt-markdown`, plus any `className` you pass.

## API overview

| Export              | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `RealTalkProvider`  | Context provider for shared configuration                    |
| `useConversation`   | All-in-one hook for conversation state, audio, and messaging |
| `useAudioControls`  | Microphone mute and volume control                           |
| `useRealTalkConfig` | Access provider configuration                                |
| `AudioPlayer`       | PCM audio playback with queue management                     |
| `AudioRecorder`     | Microphone capture with resampling to 16 kHz                 |
| `Markdown`          | Renders a message's markdown, including while it streams     |

## Types

All TypeScript types are exported — `UseConversationOptions`, `UseConversationReturn`, `RealTalkConfig`, `AudioPlayerCallbacks`, and others. See [src/index.ts](src/index.ts) for the full list.

## Development

```bash
pnpm test         # run tests
```

## License

MIT
