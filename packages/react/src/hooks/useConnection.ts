import { useState, useCallback, useRef, useEffect } from "react";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import type {
  ClientEvent,
  ConnectionStatus,
  ConversationStatus,
  ConversationError,
  DTMFDigit,
  Message,
  SessionToken,
  ConversationEvent,
} from "@realtalk-ai/core";
import {
  EventType,
  WebSocketTransport,
  RECONNECTABLE_CLOSE_CODES,
  ConnectionError,
  ApiError,
  ProtocolError,
  ValidationError,
} from "@realtalk-ai/core";
import type {
  UseConversationOptions,
  UseConversationSessionOptions,
} from "../useConversation.js";
import type { TokenResponse } from "../provider.js";
import { SDK_NAME, SDK_VERSION, SDK_CONTEXT } from "../version.js";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];

export interface UseConnectionReturn {
  connectionStatus: ConnectionStatus;
  status: ConversationStatus;
  conversationId: string | null;
  error: ConversationError | null;
  startConversation: (
    options: UseConversationSessionOptions
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

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [status, setStatus] = useState<ConversationStatus>("not_started");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<ConversationError | null>(null);

  const transportRef = useRef<WebSocketTransport | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const sessionOptionsRef = useRef<UseConversationSessionOptions | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const intentionalDisconnectRef = useRef(false);

  const setConversationIdBoth = useCallback((id: string | null) => {
    conversationIdRef.current = id;
    setConversationId(id);
  }, []);

  const updateConnectionStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setConnectionStatus(newStatus);
      optionsRef.current.onConnectionStatusChange?.(newStatus);
    },
    [optionsRef]
  );

  const updateConversationStatus = useCallback(
    (newStatus: ConversationStatus) => {
      setStatus(newStatus);
      optionsRef.current.onStatusChange?.(newStatus);
    },
    [optionsRef]
  );

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    onCleanup();

    if (transportRef.current) {
      transportRef.current.removeAllListeners();
      transportRef.current.disconnect();
      transportRef.current = null;
    }

    setConversationIdBoth(null);
    sessionOptionsRef.current = null;
    sessionTokenRef.current = null;
    reconnectAttemptRef.current = 0;
  }, [setConversationIdBoth, onCleanup]);

  const handleConversationEvent = useCallback(
    (event: ConversationEvent) => {
      optionsRef.current.onEvent?.(event);

      switch (event.type) {
        case EventType.ExistingMessages:
        case EventType.MessageCreated:
        case EventType.MessageUpdated:
        case EventType.Vad:
          onEvent(event);
          break;
        case EventType.Clear: {
          onClear();
          break;
        }
        case EventType.ConversationFinished: {
          const finishedId = conversationIdRef.current;
          intentionalDisconnectRef.current = true;
          cleanup();
          updateConversationStatus("finished");
          updateConnectionStatus("disconnected");
          if (finishedId) {
            setConversationIdBoth(finishedId);
          }
          break;
        }
        case EventType.Close: {
          if (!intentionalDisconnectRef.current && sessionOptionsRef.current) {
            if (RECONNECTABLE_CLOSE_CODES.has(event.code)) {
              updateConnectionStatus("reconnecting");
              scheduleReconnect();
            } else {
              const conversationError: ConversationError = {
                error: new ConnectionError(
                  "websocket_failed",
                  `Connection closed with code ${event.code}`
                ),
                fatal: true,
                timestamp: Date.now(),
              };
              setError(conversationError);
              optionsRef.current.onError?.(conversationError);
              cleanup();
              updateConversationStatus("not_started");
              updateConnectionStatus("disconnected");
            }
          }
          break;
        }
        case EventType.Error: {
          const err = new ProtocolError(event.message ?? "Unknown error");
          const conversationError: ConversationError = {
            error: err,
            fatal: false,
            timestamp: Date.now(),
          };
          setError(conversationError);
          optionsRef.current.onError?.(conversationError);
          break;
        }
      }
    },
    [
      cleanup,
      updateConnectionStatus,
      updateConversationStatus,
      setConversationIdBoth,
      onEvent,
      onClear,
      optionsRef,
    ]
  );

  const connect = useCallback(
    async (sessionOptions: UseConversationSessionOptions) => {
      const { agentId } = sessionOptions;

      updateConnectionStatus("connecting");

      const id = conversationIdRef.current;
      if (!id) {
        throw new ValidationError(
          "No conversation ID available for connection"
        );
      }

      const wsUrl = `${baseUrl}/ws/conversations/audio/${id}/`;

      const transport = new WebSocketTransport();
      transportRef.current = transport;

      transport.onAudio((pcmData, traceId) => {
        onAudio(pcmData, traceId);
      });

      transport.onEvent((event) => {
        handleConversationEvent(event);
      });

      await transport.connect({
        url: wsUrl,
        token: sessionTokenRef.current ?? "",
        sdkInfo: {
          name: SDK_NAME,
          version: SDK_VERSION,
          context: SDK_CONTEXT,
        },
      });

      reconnectAttemptRef.current = 0;
      setError(null);
      updateConnectionStatus("connected");

      transport.sendEvent({ type: "start", agent_id: agentId });
    },
    [baseUrl, updateConnectionStatus, handleConversationEvent, onAudio]
  );

  const refreshToken = useCallback(async () => {
    if (getToken) {
      const tokenResult = await getToken();
      if (typeof tokenResult === "string") {
        sessionTokenRef.current = tokenResult;
      } else {
        sessionTokenRef.current = tokenResult.token;
      }
    } else if (tokenUrl) {
      const response = await fetch(tokenUrl);
      if (!response.ok) {
        throw new ApiError(
          response.status,
          `Failed to refresh session token: ${response.status}`
        );
      }
      const data = (await response.json()) as SessionToken;
      sessionTokenRef.current = data.token;
    }
  }, [getToken, tokenUrl]);

  const scheduleReconnect = useCallback(() => {
    if (intentionalDisconnectRef.current) {
      return;
    }

    if (reconnectAttemptRef.current >= RECONNECT_DELAYS.length) {
      const conversationError: ConversationError = {
        error: new ConnectionError(
          "websocket_failed",
          "All reconnection attempts exhausted"
        ),
        fatal: true,
        timestamp: Date.now(),
      };
      setError(conversationError);
      optionsRef.current.onError?.(conversationError);
      cleanup();
      updateConversationStatus("not_started");
      updateConnectionStatus("disconnected");
      return;
    }

    const delay = RECONNECT_DELAYS[reconnectAttemptRef.current];

    reconnectTimeoutRef.current = setTimeout(async () => {
      if (intentionalDisconnectRef.current || !sessionOptionsRef.current) {
        return;
      }

      reconnectAttemptRef.current++;

      try {
        await refreshToken();
        await connect(sessionOptionsRef.current);
      } catch {
        scheduleReconnect();
      }
    }, delay);
  }, [
    connect,
    refreshToken,
    cleanup,
    updateConnectionStatus,
    updateConversationStatus,
  ]);

  const resolveToken = useCallback(
    async (
      sessionOptions: UseConversationSessionOptions
    ): Promise<string | undefined> => {
      let tokenConversationId: string | undefined;

      if (sessionOptions.token) {
        sessionTokenRef.current = sessionOptions.token;
      } else if (getToken) {
        const tokenResult = await getToken();
        if (typeof tokenResult === "string") {
          sessionTokenRef.current = tokenResult;
        } else {
          sessionTokenRef.current = tokenResult.token;
          tokenConversationId = tokenResult.conversationId;
        }
      } else if (tokenUrl) {
        const response = await fetch(tokenUrl);
        if (!response.ok) {
          throw new ApiError(
            response.status,
            `Failed to fetch session token: ${response.status}`
          );
        }
        const data = (await response.json()) as SessionToken;
        sessionTokenRef.current = data.token;
        if (data.conversation_id) {
          tokenConversationId = data.conversation_id;
        }
      }

      return tokenConversationId;
    },
    [getToken, tokenUrl]
  );

  const startConversation = useCallback(
    async (sessionOptions: UseConversationSessionOptions): Promise<string> => {
      setError(null);

      if (status !== "not_started" && status !== "finished") {
        throw new ValidationError("Conversation already active");
      }

      if (!sessionOptions.agentId) {
        throw new ValidationError("agentId is required");
      }

      const resolvedOptions = { ...sessionOptions };
      intentionalDisconnectRef.current = false;
      sessionOptionsRef.current = resolvedOptions;
      setMessages([]);

      const tokenConversationId = await resolveToken(sessionOptions);

      updateConnectionStatus("connecting");
      updateConversationStatus("active");

      const id = sessionOptions.conversationId ?? tokenConversationId;

      if (!id) {
        throw new ValidationError(
          "No conversation ID available. Provide conversationId via startConversation options or use a token endpoint that returns conversation_id."
        );
      }

      setConversationIdBoth(id);

      try {
        await connect(resolvedOptions);
      } catch (error) {
        cleanup();
        updateConnectionStatus("disconnected");
        updateConversationStatus("not_started");
        throw error;
      }

      return id;
    },
    [
      status,
      connect,
      cleanup,
      updateConnectionStatus,
      updateConversationStatus,
      resolveToken,
      setConversationIdBoth,
      optionsRef,
      setMessages,
    ]
  );

  const endConversation = useCallback(async () => {
    const transport = transportRef.current;
    if (transport) {
      transport.sendEvent({ type: "end_conversation", data: {} });
      transport.sendEvent({ type: "hangup", data: {} });
      transport.removeAllListeners();
      await transport.gracefulDisconnect();
      transportRef.current = null;
    }
    intentionalDisconnectRef.current = true;
    setError(null);
    cleanup();
    updateConversationStatus("not_started");
    updateConnectionStatus("disconnected");
  }, [cleanup, updateConversationStatus, updateConnectionStatus]);

  const sendMessage = useCallback((text: string) => {
    if (transportRef.current) {
      transportRef.current.sendEvent({ type: "message", data: text });
    }
  }, []);

  const sendDTMF = useCallback((digit: DTMFDigit) => {
    if (transportRef.current) {
      transportRef.current.sendEvent({ event: "dtmf", data: digit });
    }
  }, []);

  const sendEvent = useCallback((payload: ClientEvent) => {
    if (transportRef.current) {
      transportRef.current.sendEvent(payload);
    }
  }, []);

  const sendAudio = useCallback((pcm: Int16Array) => {
    if (transportRef.current) {
      transportRef.current.sendAudio(pcm);
    }
  }, []);

  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      cleanup();
    };
  }, [cleanup]);

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
