import { Stack } from "expo-router";
import { RealTalkProvider } from "@realtalk-ai/react-native";

const TOKEN_URL = process.env.EXPO_PUBLIC_TOKEN_URL ?? "http://localhost:8000/api/token";
const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "ws://localhost:8000/api/v1";

export default function RootLayout() {
  return (
    <RealTalkProvider tokenUrl={TOKEN_URL} baseUrl={BASE_URL}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </RealTalkProvider>
  );
}
