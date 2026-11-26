import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ConversationClient,
  type ConversationClientOptions,
  type ConversationState,
} from "@realtalk-ai/core";

export function useConversationClient(
  options: ConversationClientOptions,
): ConversationClient {
  const [client] = useState(() => new ConversationClient(options));
  client.configure(options);

  useEffect(() => () => client.disconnect(), [client]);

  return client;
}

export function useStateField<K extends keyof ConversationState>(
  client: ConversationClient,
  field: K,
): ConversationState[K] {
  const read = () => client.getState()[field];
  return useSyncExternalStore(client.subscribe, read, read);
}
