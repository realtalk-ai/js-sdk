# @realtalk-ai/core

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
    case EventType.ConversationFinished:
      transport.disconnect();
      break;
  }
});

transport.onStatusChange((connectionStatus) => {
  console.log("Connection status:", connectionStatus);
});

await transport.connect({
  url: "wss://api.realtalk.ml/api/v1/ws/conversations/audio/a1b2c3d4-e5f6-7890-abcd-ef1234567890/",
  token: "",
  sdkInfo: { name: "my-app", version: "1.0.0", context: "web" },
});

transport.sendEvent({
  type: "start",
  agent_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
});
```

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

| Event                   | `EventType` constant             | Data                               | Description                            |
| ----------------------- | -------------------------------- | ---------------------------------- | -------------------------------------- |
| `existing_messages`     | `EventType.ExistingMessages`     | `Message[]`                        | All prior messages, sent on connection |
| `message_created`       | `EventType.MessageCreated`       | `Message`                          | New message from the agent or user     |
| `message_updated`       | `EventType.MessageUpdated`       | `Message`                          | An existing message was updated        |
| `vad`                   | `EventType.Vad`                  | `{ state: "speech" \| "silence" }` | Voice activity detection state changed |
| `clear`                 | `EventType.Clear`                | —                                  | Audio buffer should be cleared         |
| `conversation_finished` | `EventType.ConversationFinished` | —                                  | The conversation session has ended     |
| `close`                 | `EventType.Close`                | `{ code: number; reason: string }` | WebSocket connection closed            |
| `error`                 | `EventType.Error`                | `{ message?: string }`             | A protocol or backend error occurred   |

### Client events (`sendEvent`)

Events you can send to the server:

| Event     | Payload                              | Description                        |
| --------- | ------------------------------------ | ---------------------------------- |
| `message` | `{ type: "message"; data: string }`  | Send a text message                |
| `dtmf`    | `{ event: "dtmf"; data: DTMFDigit }` | Send a DTMF tone (0–9, \*, #, A–D) |

You can also send arbitrary custom events — any object with a `type` string field will be forwarded.

## API overview

| Export                        | Description                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `WebSocketTransport`          | WebSocket connection with status tracking, timeouts, and optional reconnection |
| `normalizeMessage`            | Convert a backend message (snake_case) to a typed `Message` (camelCase)        |
| `sortChronological`           | Sort messages by `createdAt` timestamp                                         |
| `pcmToBase64` / `base64ToPcm` | PCM audio encoding utilities                                                   |
| `DefaultReconnectPolicy`      | Configurable retry-delay policy                                                |
| `RealtalkError`               | Base error class for all SDK errors                                            |
| `ConnectionError`             | WebSocket connection or reconnection failures                                  |
| `ApiError`                    | HTTP errors from token endpoints                                               |
| `ProtocolError`               | Server-side protocol or backend errors                                         |
| `ValidationError`             | Invalid arguments or missing configuration                                     |
| `setLogLevel`                 | Control debug log output                                                       |
| `DEFAULT_WS_URL`              | Default WebSocket endpoint URL                                                 |

## Types

All TypeScript types are exported — `Message`, `ConversationEvent`, `ConnectionStatus`, `ConversationStatus`, and others. See [src/types.ts](src/types.ts) for the full list.

## Development

```bash
pnpm test         # run tests
```

## License

MIT
