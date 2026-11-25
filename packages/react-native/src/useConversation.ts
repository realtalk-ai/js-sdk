import { useRef, useState, useCallback } from "react";
import type {
  AgentState,
  ClientEvent,
  ConnectionStatus,
  ConversationStatus,
  ConversationMode,
  ConversationError,
  DTMFDigit,
  Message,
  ConversationEvent,
  GetToken,
  UserState,
} from "@realtalk-ai/core";
import { WebSocketTransport } from "@realtalk-ai/core";
import { useRealTalkConfig } from "./provider.js";
import {
  useConversationClient,
  useStateField,
} from "./hooks/useConversationClient.js";
import { SDK_NAME, SDK_VERSION, SDK_CONTEXT } from "./version.js";
import { useAudioControls } from "./hooks/useAudioControls.js";
import { AudioPlayer } from "./audio/player.js";
import { AudioRecorder } from "./audio/recorder.js";
import * as AudioEngine from "./native/AudioEngineModule.js";

export interface UseConversationSessionOptions {
  agentId: string;
  conversationId?: string;
  mode?: ConversationMode;
  token?: string;
  getToken?: GetToken;
  volume?: number;
}

export interface UseConversationOptions {
  onMessage?: (message: Message) => void;
  onError?: (error: ConversationError) => void;
  onStatusChange?: (status: ConversationStatus) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onEvent?: (event: ConversationEvent) => void;
}

export interface UseConversationReturn {
  connectionStatus: ConnectionStatus;
  status: ConversationStatus;
  conversationId: string | null;
  messages: Message[];
  error: ConversationError | null;
  agentState: AgentState;
  userState: UserState;
  isMicMuted: boolean;
  isAudioMuted: boolean;
  volume: number;
  startConversation: (
    options: UseConversationSessionOptions,
  ) => Promise<string>;
  endConversation: () => Promise<void>;
  sendMessage: (text: string) => boolean;
  sendDTMF: (digit: DTMFDigit) => void;
  sendEvent: (payload: ClientEvent) => void;
  toggleMic: () => void;
  toggleAudio: () => void;
  setVolume: (volume: number) => void;
}

export function useConversation(
  options: UseConversationOptions = {},
): UseConversationReturn {
  const { baseUrl, tokenUrl, getToken } = useRealTalkConfig();

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const playerRef = useRef<AudioPlayer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const [agentIsSpeaking, setAgentIsSpeaking] = useState(false);
  const sendEventRef = useRef<(payload: ClientEvent) => void>(() => {});

  const handleAudio = useCallback((pcm: Int16Array, traceId: string) => {
    playerRef.current?.play(pcm, traceId);
  }, []);

  const handleClear = useCallback(() => {
    playerRef.current?.clear();
  }, []);

  const handleAudioCleanup = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current = null;
    }
  }, []);

  const client = useConversationClient({
    baseUrl,
    tokenUrl,
    getToken,
    sdkInfo: { name: SDK_NAME, version: SDK_VERSION, context: SDK_CONTEXT },
    createTransport: () => new WebSocketTransport(),
    callbacks: {
      onEvent: (event) => optionsRef.current.onEvent?.(event),
      onMessage: (message) => optionsRef.current.onMessage?.(message),
      onError: (error) => optionsRef.current.onError?.(error),
      onStatusChange: (status) => optionsRef.current.onStatusChange?.(status),
      onConnectionStatusChange: (status) =>
        optionsRef.current.onConnectionStatusChange?.(status),
      onAudio: (pcm, traceId) => handleAudio(pcm, traceId),
      onClear: handleClear,
      onCleanup: handleAudioCleanup,
    },
  });

  const connectionStatus = useStateField(client, "connectionStatus");
  const status = useStateField(client, "status");
  const conversationId = useStateField(client, "conversationId");
  const error = useStateField(client, "error");
  const messages = useStateField(client, "messages");
  const userState = useStateField(client, "userState");
  const clientAgentState = useStateField(client, "agentState");

  const connectionStart = useCallback(
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

  sendEventRef.current = sendEvent;

  const startConversation = useCallback(
    async (sessionOptions: UseConversationSessionOptions): Promise<string> => {
      await AudioEngine.initialize();

      const player = new AudioPlayer({
        onPlaybackStart: (traceId) => {
          setAgentIsSpeaking(true);
          sendEventRef.current({
            type: "audio_clip_started",
            trace_id: traceId,
          });
        },
        onPlaybackEnd: (traceId) => {
          setAgentIsSpeaking(false);
          sendEventRef.current({
            type: "audio_clip_ended",
            trace_id: traceId,
          });
        },
      });
      playerRef.current = player;

      if (sessionOptions.volume !== undefined) {
        player.setVolume(sessionOptions.volume);
      }

      const id = await connectionStart(sessionOptions);

      if (sessionOptions.mode?.userAudio) {
        const recorder = new AudioRecorder();
        recorderRef.current = recorder;
        await recorder.start((pcm) => sendAudio(pcm));
      }

      return id;
    },
    [connectionStart, sendAudio],
  );

  const {
    isMicMuted,
    isAudioMuted,
    volume,
    toggleMic,
    toggleAudio,
    setVolume,
  } = useAudioControls(playerRef, recorderRef);

  const agentState: AgentState = agentIsSpeaking
    ? "speaking"
    : clientAgentState;

  return {
    connectionStatus,
    status,
    conversationId,
    messages,
    error,
    agentState,
    userState,
    isMicMuted,
    isAudioMuted,
    volume,
    startConversation,
    endConversation,
    sendMessage,
    sendDTMF,
    sendEvent,
    toggleMic,
    toggleAudio,
    setVolume,
  };
}
