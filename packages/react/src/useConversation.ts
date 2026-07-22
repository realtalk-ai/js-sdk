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
  UserState,
} from "@realtalk-ai/core";
import { useRealTalkConfig } from "./provider.js";
import { useMessages } from "./hooks/useMessages.js";
import { useConnection } from "./hooks/useConnection.js";
import { useAudioControls } from "./hooks/useAudioControls.js";
import { AudioPlayer } from "./audio/player.js";
import { AudioRecorder } from "./audio/recorder.js";

export interface UseConversationSessionOptions {
  agentId: string;
  conversationId?: string;
  mode?: ConversationMode;
  audioDeviceId?: string;
  token?: string;
}

export interface UseConversationOptions {
  onMessage?: (message: Message) => void;
  onError?: (error: ConversationError) => void;
  onStatusChange?: (status: ConversationStatus) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onEvent?: (event: ConversationEvent) => void;
  startMuted?: boolean;
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
  isMicEnabled: boolean;
  isAudioMuted: boolean;
  volume: number;
  startConversation: (
    options: UseConversationSessionOptions,
  ) => Promise<string>;
  endConversation: () => Promise<void>;
  sendMessage: (text: string) => void;
  sendDTMF: (digit: DTMFDigit) => void;
  sendEvent: (payload: ClientEvent) => void;
  clearMessages: () => void;
  toggleMic: () => void;
  toggleAudio: () => void;
  setVolume: (volume: number) => void;
  enableMic: (deviceId?: string) => Promise<void>;
  disableMic: () => void;
}

export function useConversation(
  options: UseConversationOptions = {},
): UseConversationReturn {
  const { baseUrl, tokenUrl, getToken, context } = useRealTalkConfig();

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const playerRef = useRef<AudioPlayer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const [agentIsSpeaking, setAgentIsSpeaking] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
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
    setIsMicEnabled(false);
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current = null;
    }
  }, []);

  const {
    messages,
    userState,
    thinkingMessageId,
    setMessages,
    handleMessageEvent,
  } = useMessages(optionsRef);

  const {
    connectionStatus,
    status,
    conversationId,
    error,
    startConversation: connectionStart,
    endConversation,
    sendMessage,
    sendDTMF,
    sendEvent,
    sendAudio,
  } = useConnection({
    baseUrl,
    tokenUrl,
    getToken,
    context,
    optionsRef,
    onEvent: handleMessageEvent,
    setMessages,
    onAudio: handleAudio,
    onClear: handleClear,
    onCleanup: handleAudioCleanup,
  });

  sendEventRef.current = sendEvent;

  const {
    isMicMuted,
    isAudioMuted,
    volume,
    toggleMic,
    toggleAudio,
    setVolume,
  } = useAudioControls(playerRef, recorderRef, options.startMuted);

  const enableMic = useCallback(
    async (deviceId?: string): Promise<void> => {
      if (recorderRef.current) return;
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;
      try {
        await recorder.start(
          (pcm) => sendAudio(pcm),
          deviceId ? { deviceId } : undefined,
        );
      } catch (error) {
        recorderRef.current = null;
        throw error;
      }
      setIsMicEnabled(true);
    },
    [sendAudio],
  );

  const disableMic = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsMicEnabled(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const startConversation = useCallback(
    async (sessionOptions: UseConversationSessionOptions): Promise<string> => {
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

      player.setVolume(volume);

      const id = await connectionStart(sessionOptions);

      if (sessionOptions.mode === "voice") {
        await enableMic(sessionOptions.audioDeviceId);
      }

      return id;
    },
    [connectionStart, enableMic, volume],
  );

  const agentState: AgentState = agentIsSpeaking
    ? "speaking"
    : thinkingMessageId !== null && status !== "finished"
      ? "thinking"
      : "idle";

  return {
    connectionStatus,
    status,
    conversationId,
    messages,
    error,
    agentState,
    userState,
    isMicMuted,
    isMicEnabled,
    isAudioMuted,
    volume,
    startConversation,
    endConversation,
    sendMessage,
    sendDTMF,
    sendEvent,
    clearMessages,
    toggleMic,
    toggleAudio,
    setVolume,
    enableMic,
    disableMic,
  };
}
