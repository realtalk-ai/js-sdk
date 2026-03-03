# @realtalk-ai/react-native

[![npm](https://img.shields.io/npm/v/@realtalk-ai/react-native)](https://www.npmjs.com/package/@realtalk-ai/react-native)

React Native hooks for Real Talk voice and text conversations. Built on [`@realtalk-ai/core`](../core/README.md).

## Quick start

```bash
npm install @realtalk-ai/react-native @realtalk-ai/core
```

```tsx
import { RealTalkProvider, useConversation } from "@realtalk-ai/react-native";

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
  } = useConversation();

  return (
    <View>
      {messages.map((msg) => (
        <Text key={msg.id}>{msg.text}</Text>
      ))}

      {status === "not_started" || status === "finished" ? (
        <Button
          title="Start"
          onPress={() => startConversation({ agentId: "your-agent-id" })}
        />
      ) : (
        <Button title="End" onPress={endConversation} />
      )}
    </View>
  );
};
```

See the [example Expo app](../../examples/expo-app) for a complete working project.

---

## Setup

### Expo

Add the config plugin to your `app.json`:

```json
{
  "plugins": ["@realtalk-ai/react-native/app.plugin.cjs"]
}
```

### Bare React Native

The native module auto-links. On iOS, run `pod install` after installing:

```bash
cd ios && pod install
```

### Platform permissions

**iOS** — add to `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access for voice conversations.</string>
```

**Android** — add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

The SDK requests this permission at runtime before starting recording.

## Token endpoint

The SDK needs a server-side endpoint that you host that creates a session via the Real Talk API and returns a short-lived session token.

```python
@app.get("/api/token")
async def get_token():
    response = await httpx.AsyncClient().post(
        "https://api.realtalk.ml/api/v1/sessions/",
        headers={"X-Realtalk-Api-Key": REALTALK_API_KEY},
        json={"agent_id": REALTALK_AGENT_ID},
    )
    data = response.json()
    return {"token": data["token"], "conversation_id": data["conversation_id"]}
```

See the [example server](../../examples/server) for a complete implementation.

## Provider

Wrap your app with `RealTalkProvider` and pass your token endpoint:

```tsx
<RealTalkProvider tokenUrl="https://your-server.com/api/token">
  {children}
</RealTalkProvider>
```

You can also pass a `getToken` callback or a custom `baseUrl` — see the [provider source](src/provider.tsx) for all options.

## useConversation

The main hook — combines connection, messages, and audio controls.

### State

| Field              | Type                        | Description                                                             |
| ------------------ | --------------------------- | ----------------------------------------------------------------------- |
| `connectionStatus` | `ConnectionStatus`          | `"disconnected"` \| `"connecting"` \| `"connected"` \| `"reconnecting"` |
| `status`           | `ConversationStatus`        | `"not_started"` \| `"active"` \| `"finished"`                           |
| `conversationId`   | `string \| null`            | Current conversation ID                                                 |
| `messages`         | `Message[]`                 | Conversation messages                                                   |
| `error`            | `ConversationError \| null` | Current errors                                                          |
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
  agentId: "your-agent-id",
  mode: "voice", // "voice" | "text"
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

| Hook                | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `useConnection`     | WebSocket transport, session lifecycle, and reconnection |
| `useMessages`       | Message array and user/agent state tracking              |
| `useAudioControls`  | Microphone mute and volume control                       |
| `useRealTalkConfig` | Access provider configuration from context               |

## Audio

Audio capture and playback use the `RealTalkAudio` native module. The `AudioRecorder` and `AudioPlayer` classes are exported if you need direct access, but `useConversation` manages them automatically.

## Development

```bash
pnpm test         # run tests
```

## License

MIT
