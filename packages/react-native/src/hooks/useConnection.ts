import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import type {
  ClientEvent,
  ConnectionStatus,
  ConversationStatus,
  ConversationError,
  DTMFDigit,
  Message,
  ConversationClientOptions,
  ConversationSnapshot,
  ConversationEvent,
} from "@realtalk-ai/core";
import { ConversationClient, WebSocketTransport } from "@realtalk-ai/core";
import type {
  UseConversationOptions,
  UseConversationSessionOptions,
} from "../useConversation.js";
import type { TokenResponse } from "../provider.js";
import { SDK_NAME, SDK_VERSION, SDK_CONTEXT } from "../version.js";

export { DEFAULT_CONVERSATION_MODE } from "@realtalk-ai/core";

function useSnapshotField<K extends keyof ConversationSnapshot>(
  client: ConversationClient,
  field: K,
): ConversationSnapshot[K] {
  const read = () => client.getSnapshot()[field];
  return useSyncExternalStore(client.subscribe, read, read);
}

export interface UseConnectionReturn {
  connectionStatus: ConnectionStatus;
  status: ConversationStatus;
  conversationId: string | null;
  error: ConversationError | null;
  startConversation: (
    options: UseConversationSessionOptions,
  ) => Promise<string>;
  endConversation: () => Promise<void>;
  sendMessage: (text: string) => void;
  sendDTMF: (digit: DTMFDigit) => void;
  sendEvent: (payload: ClientEvent) => void;
  sendAudio: (pcm: Int16Array) => void;
}

export function useConnection(opts: {
  baseUrl: string;
  tokenUrl: string | null;
  getToken: (() => Promise<TokenResponse>) | null;
  optionsRef: MutableRefObject<UseConversationOptions>;
  onEvent: (event: ConversationEvent) => void;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  onAudio: (pcm: Int16Array, traceId: string) => void;
  onClear: () => void;
  onCleanup: () => void;
}): UseConnectionReturn {
  const {
    baseUrl,
    tokenUrl,
    getToken,
    optionsRef,
    onEvent,
    setMessages,
    onAudio,
    onClear,
    onCleanup,
  } = opts;

  const clientOptions: ConversationClientOptions = {
    baseUrl,
    tokenUrl,
    getToken,
    sdkInfo: { name: SDK_NAME, version: SDK_VERSION, context: SDK_CONTEXT },
    createTransport: () => new WebSocketTransport(),
    callbacks: {
      onEvent: (event) => optionsRef.current.onEvent?.(event),
      onMessageEvent: onEvent,
      onError: (error) => optionsRef.current.onError?.(error),
      onStatusChange: (status) => optionsRef.current.onStatusChange?.(status),
      onConnectionStatusChange: (status) =>
        optionsRef.current.onConnectionStatusChange?.(status),
      onAudio: (pcm, traceId) => onAudio(pcm, traceId),
      onClear,
      onConversationStart: () => setMessages([]),
      onCleanup,
    },
  };
  const [client] = useState(() => new ConversationClient(clientOptions));
  client.configure(clientOptions);

  const connectionStatus = useSnapshotField(client, "connectionStatus");
  const status = useSnapshotField(client, "status");
  const conversationId = useSnapshotField(client, "conversationId");
  const error = useSnapshotField(client, "error");

  useEffect(() => () => client.disconnect(), [client]);

  const startConversation = useCallback(
    (sessionOptions: UseConversationSessionOptions) =>
      client.start(sessionOptions),
    [client],
  );
  const endConversation = useCallback(() => client.end(), [client]);
  const sendMessage = useCallback(
    (text: string) => client.sendMessage(text),
    [client],
  );
  const sendDTMF = useCallback(
    (digit: DTMFDigit) => client.sendDTMF(digit),
    [client],
  );
  const sendEvent = useCallback(
    (payload: ClientEvent) => client.sendEvent(payload),
    [client],
  );
  const sendAudio = useCallback(
    (pcm: Int16Array) => client.sendAudio(pcm),
    [client],
  );

  return {
    connectionStatus,
    status,
    conversationId,
    error,
    startConversation,
    endConversation,
    sendMessage,
    sendDTMF,
    sendEvent,
    sendAudio,
  };
}
