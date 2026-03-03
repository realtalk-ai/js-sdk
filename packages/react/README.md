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
              mode: "voice",
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

| Prop       | Default          | Description                                                            |
| ---------- | ---------------- | ---------------------------------------------------------------------- |
| `tokenUrl` | —                | URL to fetch a session token (returns `{ token, conversation_id }`)    |
| `getToken` | —                | Async function returning a token string or `{ token, conversationId }` |
| `baseUrl`  | `DEFAULT_WS_URL` | WebSocket server URL                                                   |

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
| `status`           | `ConversationStatus`        | `"not_started"` \| `"active"` \| `"finished"`                           |
| `conversationId`   | `string \| null`            | Current conversation ID                                                 |
| `messages`         | `Message[]`                 | Conversation messages                                                   |
| `error`            | `ConversationError \| null` | Current error                                                           |
| `agentState`       | `AgentState`                | `"idle"` \| `"thinking"` \| `"speaking"`                                |
| `userState`        | `UserState`                 | `"idle"` \| `"speaking"`                                                |
| `volume`           | `number`                    | Audio playback volume (0–1)                                             |
| `isMicMuted`       | `boolean`                   | Microphone mute state                                                   |
| `isAudioMuted`     | `boolean`                   | Audio output mute state                                                 |

### Methods

| Method                       | Description                             |
| ---------------------------- | --------------------------------------- |
| `startConversation(options)` | Start a conversation session            |
| `endConversation()`          | Send hangup and end the current session |
| `sendMessage(text)`          | Send a text message                     |
| `sendDTMF(digit)`            | Send a DTMF tone                        |
| `sendEvent(payload)`         | Send a custom event                     |
| `toggleMic()`                | Toggle microphone mute                  |
| `toggleAudio()`              | Toggle audio output mute                |
| `setVolume(volume)`          | Set playback volume                     |

### Session options

```ts
startConversation({
  agentId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  mode: "voice", // "voice" | "text"
  audioDeviceId: "...", // specific microphone
});
```

### Callbacks

```ts
useConversation({
  onMessage: (message) => {},
  onError: (error) => {},
  onStatusChange: (status) => {},
  onConnectionStatusChange: (connectionStatus) => {},
  onEvent: (event) => {},
});
```

The `onEvent` callback receives server events like `message_created`, `message_updated`, `vad`, and others. Use `sendEvent` to send custom events to the server. See the [core package events reference](../core/README.md#events) for the full list of event types and their payloads.

## Lower-level hooks

If you need finer control, the individual hooks are also exported:

| Hook                | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `useConnection`     | WebSocket transport, session lifecycle, and reconnection |
| `useMessages`       | Message array and user/agent state tracking              |
| `useAudioControls`  | Microphone mute and volume control                       |
| `useRealTalkConfig` | Access provider configuration from context               |

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

Skip audio entirely by starting a text session:

```ts
const { messages, sendMessage, startConversation, status } = useConversation();

await startConversation({
  agentId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  mode: "text",
});

sendMessage("Hello!");
```

## API overview

| Export              | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `RealTalkProvider`  | Context provider for shared configuration                    |
| `useConversation`   | All-in-one hook for conversation state, audio, and messaging |
| `useConnection`     | WebSocket connection and session lifecycle                   |
| `useMessages`       | Message and user/agent state management                      |
| `useAudioControls`  | Microphone mute and volume control                           |
| `useRealTalkConfig` | Access provider configuration                                |
| `AudioPlayer`       | PCM audio playback with queue management                     |
| `AudioRecorder`     | Microphone capture with resampling to 16 kHz                 |

## Types

All TypeScript types are exported — `UseConversationOptions`, `UseConversationReturn`, `RealTalkConfig`, `AudioPlayerCallbacks`, and others. See [src/index.ts](src/index.ts) for the full list.

## Development

```bash
pnpm test         # run tests
```

## License

MIT
