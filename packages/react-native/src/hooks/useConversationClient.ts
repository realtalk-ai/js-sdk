import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ConversationClient,
  type ConversationClientOptions,
  type ConversationSnapshot,
} from "@realtalk-ai/core";

export function useConversationClient(
  options: ConversationClientOptions,
): ConversationClient {
  const [client] = useState(() => new ConversationClient(options));
  client.configure(options);

  useEffect(() => () => client.disconnect(), [client]);

  return client;
}

export function useSnapshotField<K extends keyof ConversationSnapshot>(
  client: ConversationClient,
  field: K,
): ConversationSnapshot[K] {
  const read = () => client.getSnapshot()[field];
  return useSyncExternalStore(client.subscribe, read, read);
}
