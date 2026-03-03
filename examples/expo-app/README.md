# RealTalk Expo Example

Expo app demonstrating the `@realtalk-ai/react-native` SDK with voice and text conversation modes.

<p>
  <img src="example_app_menu.png" alt="Menu screen" width="250" />
  &nbsp;&nbsp;
  <img src="example_app_conversation.png" alt="Conversation screen" width="250" />
</p>

## Prerequisites

- iOS: Xcode with a simulator or physical device
- Android: Android Studio with a simulator or physical device

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file (see `.env.example`):

```
EXPO_PUBLIC_AGENT_ID=your-agent-id
EXPO_PUBLIC_TOKEN_URL=http://localhost:8000/api/token
```

Both are required. `TOKEN_URL` should point to a server that generates short-lived session tokens via the Real Talk API. See [`examples/server`](../server) for a simple test server.

3. Run the app:

```bash
npm run ios
# or
npm run android
```

## Local SDK development

When making changes to the SDK in `packages/`:

```bash
# Build SDK + sync to node_modules + prebuild + run
npm run dev:ios
npm run dev:android

# Build SDK + sync only (no native rebuild)
npm run dev:build

# Sync only (if TypeScript is already built)
npm run sync-sdk
```

Skip prebuild when you only changed TypeScript — just run `npm run dev:build` and restart Metro with `npm start`.
