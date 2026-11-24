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

  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot,
  );

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
    connectionStatus: snapshot.connectionStatus,
    status: snapshot.status,
    conversationId: snapshot.conversationId,
    error: snapshot.error,
    startConversation,
    endConversation,
    sendMessage,
    sendDTMF,
    sendEvent,
    sendAudio,
  };
}
