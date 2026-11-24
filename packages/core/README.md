# @realtalk-ai/core

[![CI](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/realtalk-ai/js-sdk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@realtalk-ai/core)](https://www.npmjs.com/package/@realtalk-ai/core)

Transport, types, and utilities for Real Talk SDKs. This package provides the low-level building blocks — the React SDK and other framework bindings are built on top of it.

## Install

```bash
npm install @realtalk-ai/core
```

## Quick start

Connect to a conversation over WebSocket and handle events:

```ts
import { WebSocketTransport, EventType } from "@realtalk-ai/core";

const transport = new WebSocketTransport();

transport.onEvent((event) => {
  switch (event.type) {
    case EventType.MessageCreated:
      console.log("New message:", event.data.text);
      break;
    case EventType.ConversationStatus:
      if (event.data.status === "ended") transport.disconnect();
      break;
  }
});

transport.onStatusChange((connectionStatus) => {
  console.log("Connection status:", connectionStatus);
});

await transport.connect({
  url: "wss://api.realtalk.ml/api/v1/ws/conversations/audio/a1b2c3d4-e5f6-7890-abcd-ef1234567890/",
  token: "",
  sdkInfo: { name: "my-app", version: "1.0.0", context: "web_chat" },
  protocol: 2,
});

transport.sendEvent({ type: "start" });
```

Always pass `protocol: 2` to `connect`. Connecting without it is deprecated and logs a warning.

## Conversation client

`ConversationClient` runs a whole conversation without any UI framework: it fetches the session token, connects, keeps the messages, and reconnects when the connection drops. The React and React Native SDKs are built on it.

```ts
import { ConversationClient } from "@realtalk-ai/core";

const client = new ConversationClient({
  baseUrl: "wss://api.realtalk.ml/api/v1",
  sdkInfo: { name: "my-app", version: "1.0.0", context: "web_chat" },
  getToken: async () => {
    const response = await fetch("/api/realtalk-token");
    const data = await response.json();
    return { token: data.token, conversationId: data.conversation_id };
  },
  callbacks: {
    onMessage: (message) => console.log(message.role, message.text),
  },
});

client.subscribe(() => {
  const { status, connectionStatus, messages } = client.getSnapshot();
  render(status, connectionStatus, messages);
});

await client.start({ agentId: "your-agent-id" });
client.sendMessage("Hello");
await client.end();
```

`getSnapshot()` returns the current state (`status`, `connectionStatus`, `conversationId`, `error`, `mode`, `messages`, `annotations`, `userState`, `thinkingMessageId`) and returns a new object whenever something changes. When the connection drops, the client fetches a new session token and reconnects, waiting longer after each failed attempt and giving up after six. Pass a `reconnectPolicy` to change that.

## Reconnection

Opt into automatic reconnection by passing a policy:

```ts
import { WebSocketTransport, DefaultReconnectPolicy } from "@realtalk-ai/core";

const transport = new WebSocketTransport({
  reconnectPolicy: new DefaultReconnectPolicy(), // retries at 300ms, 1s, 3s, 5s, 10s
  connectionTimeout: 10_000,
});
```

You can write your own policy by implementing the `ReconnectPolicy` interface.

## Error handling

All errors extend `RealtalkError`:

| Error class       | Properties            | Description                                   |
| ----------------- | --------------------- | --------------------------------------------- |
| `ConnectionError` | `reason`              | WebSocket connection or reconnection failures |
| `ApiError`        | `statusCode`, `body?` | HTTP errors from token endpoints              |
| `ProtocolError`   | `rawData?`            | Server-side protocol or backend errors        |
| `ValidationError` | —                     | Invalid arguments or missing configuration    |

```ts
import { ConnectionError, ValidationError } from "@realtalk-ai/core";

try {
  await transport.connect({ url, token, sdkInfo });
} catch (err) {
  if (err instanceof ConnectionError) {
    console.log(err.reason); // "timeout" | "websocket_failed"
  }
}
```

## Debugging

Logging is silent by default. Turn it on when you need it:

```ts
import { setLogLevel } from "@realtalk-ai/core";

setLogLevel("debug"); // "trace" | "debug" | "info" | "warn" | "error" | "silent"
```

## Events

The SDK communicates over WebSocket using typed events. Use `onEvent` to receive server events and `sendEvent` to send client events.

### Server events (`onEvent`)

Events received from the server during a conversation:

| Event                   | `EventType` constant             | Data                                            | Description                                                               |
| ----------------------- | -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `existing_messages`     | `EventType.ExistingMessages`     | `Message[]` and `annotations: AnnotationItem[]` | All prior messages and annotations, sent on connection                    |
| `message_created`       | `EventType.MessageCreated`       | `Message`                                       | New message from the agent or user                                        |
| `message_updated`       | `EventType.MessageUpdated`       | `Message`                                       | An existing message was updated                                           |
| `annotation_created`    | `EventType.AnnotationCreated`    | `AnnotationItem`                                | A new annotation was added to the conversation                            |
| `vad`                   | `EventType.Vad`                  | `{ state: "speech" \| "silence" }`              | Voice activity detection state changed                                    |
| `clear`                 | `EventType.Clear`                | —                                               | Audio buffer should be cleared                                            |
| `conversation_status`   | `EventType.ConversationStatus`   | `{ status: "ongoing" \| "idle" \| "ended" }`    | The conversation's status, sent on connection and whenever it changes     |
| `conversation_finished` | `EventType.ConversationFinished` | —                                               | Deprecated, not sent with `protocol: 2`. Use `conversation_status`        |
| `conversation_mode`     | `EventType.ConversationMode`     | `{ user_audio: boolean; agent_audio: boolean }` | The mode the conversation is in, sent in reply to `set_conversation_mode` |
| `close`                 | `EventType.Close`                | `{ code: number; reason: string }`              | WebSocket connection closed                                               |
| `error`                 | `EventType.Error`                | `{ message?: string }`                          | A message from the server could not be parsed                             |

An `AnnotationItem` is `{ id, createdAt, annotation }`, where `annotation` is `{ kind: "handoff_requested" }` or `{ kind: "human_agent_joined"; humanAgentName: string | null }`. The server sends annotations as messages marked with `role: "annotation"`, and their `metadata.kind` names the kind. `existing_messages` moves them out of `data` into `annotations`, sorted by `createdAt`. Kinds this SDK version does not know are left out of both, and an `annotation_created` of such a kind is not emitted.

Two exported sets classify `close` codes: `RECONNECTABLE_CLOSE_CODES` (transient failures worth retrying with a fresh token) and `PAUSED_CLOSE_CODES` (the server paused an idle conversation, which can be resumed with the same conversation id, so don't auto-reconnect and don't treat it as an error). Codes in neither set are fatal.

### Client events (`sendEvent`)

Events you can send to the server:

| Event                   | Payload                                                                                  | Description                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `start`                 | `{ type: "start" }`                                                                      | Start the conversation. The agent comes from the session token   |
| `message`               | `{ type: "message"; data: string }`                                                      | Send a text message                                              |
| `dtmf`                  | `{ type: "dtmf"; data: DTMFDigit }`                                                      | Send a DTMF tone (0–9, \*, #, A–D)                               |
| `set_conversation_mode` | `{ type: "set_conversation_mode"; data: { user_audio: boolean; agent_audio: boolean } }` | Change which audio the conversation carries without reconnecting |
| `end_conversation`      | `{ type: "end_conversation" }`                                                           | End the conversation                                             |

`hangup` and DTMF sent as `{ event: "dtmf" }` are deprecated and log a warning. The server only accepts the events it knows.

## API overview

| Export                        | Description                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `WebSocketTransport`          | WebSocket connection with status tracking, timeouts, and optional reconnection |
| `normalizeMessage`            | Convert a backend message (snake_case) to a typed `Message` (camelCase)        |
| `normalizeAnnotationMessage`  | Convert an annotation message to `AnnotationItem` (`null` for unknown kinds)   |
| `splitBackendMessages`        | Split backend messages into sorted `messages` and `annotations`                |
| `buildTimeline`               | Merge messages and annotations into one `TimelineItem[]`, in time order        |
| `sortChronological`           | Sort messages or annotations by `createdAt`                                    |
| `pcmToBase64` / `base64ToPcm` | PCM audio encoding utilities                                                   |
| `ConversationClient`          | Runs a conversation: tokens, connection, messages, and reconnecting            |
| `DefaultReconnectPolicy`      | Configurable retry-delay policy                                                |
| `RealtalkError`               | Base error class for all SDK errors                                            |
| `ConnectionError`             | WebSocket connection or reconnection failures                                  |
| `ApiError`                    | HTTP errors from token endpoints                                               |
| `ProtocolError`               | Server-side protocol or backend errors                                         |
| `ValidationError`             | Invalid arguments or missing configuration                                     |
| `setLogLevel`                 | Control debug log output                                                       |
| `DEFAULT_WS_URL`              | Default WebSocket endpoint URL                                                 |
| `RECONNECTABLE_CLOSE_CODES`   | Close codes that warrant an automatic reconnect                                |
| `PAUSED_CLOSE_CODES`          | Close codes meaning the server paused an idle, resumable conversation          |

## Types

All TypeScript types are exported — `Message`, `ConversationEvent`, `ConnectionStatus`, `ConversationStatus`, and others. See [src/types.ts](src/types.ts) for the full list.

## Development

```bash
pnpm test         # run tests
```

## License

MIT
