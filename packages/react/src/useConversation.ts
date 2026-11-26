import { useRef, useState, useCallback } from "react";
import type {
  AgentState,
  AnnotationItem,
  AudioSource,
  ClientEvent,
  ConnectionStatus,
  ConversationStatus,
  ConversationMode,
  ConversationError,
  DTMFDigit,
  Message,
  ConversationEvent,
  TimelineItem,
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

const AUDIO_BOTH_WAYS: ConversationMode = {
  userAudio: true,
  agentAudio: true,
};

export interface UseConversationSessionOptions {
  agentId: string;
  conversationId?: string;
  mode?: ConversationMode;
  audioDeviceId?: string;
  token?: string;
  getToken?: GetToken;
}

export interface UseConversationOptions {
  onMessage?: (message: Message) => void;
  onAnnotation?: (item: AnnotationItem) => void;
  onError?: (error: ConversationError) => void;
  onStatusChange?: (status: ConversationStatus) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onEvent?: (event: ConversationEvent) => void;
  onModeRefused?: (
    requestedMode: ConversationMode,
    currentMode: ConversationMode,
  ) => void;
  startMuted?: boolean;
}

export interface UseConversationReturn {
  connectionStatus: ConnectionStatus;
  status: ConversationStatus;
  conversationId: string | null;
  messages: Message[];
  annotations: AnnotationItem[];
  timeline: TimelineItem[];
  error: ConversationError | null;
  agentState: AgentState;
  userState: UserState;
  isMicMuted: boolean;
  isMicEnabled: boolean;
  isAudioMuted: boolean;
  volume: number;
  mode: ConversationMode;
  startConversation: (
    options: UseConversationSessionOptions,
  ) => Promise<string>;
  endConversation: () => Promise<void>;
  sendMessage: (text: string) => boolean;
  sendDTMF: (digit: DTMFDigit) => void;
  sendEvent: (payload: ClientEvent) => void;
  clearMessages: () => void;
  toggleMic: () => void;
  toggleAudio: () => void;
  setVolume: (volume: number) => void;
  enableMic: (deviceId?: string) => Promise<void>;
  disableMic: () => void;
  setMode: (mode: ConversationMode, audioDeviceId?: string) => Promise<void>;
}

export function useConversation(
  options: UseConversationOptions = {},
): UseConversationReturn {
  const { baseUrl, tokenUrl, getToken, reconnectPolicy, sdkInfo } =
    useRealTalkConfig();

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const playerRef = useRef<AudioPlayer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const [agentIsSpeaking, setAgentIsSpeaking] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const sendEventRef = useRef<(payload: ClientEvent) => void>(() => {});

  const handleAudio = useCallback(
    (pcm: Int16Array, traceId: string, source: AudioSource) => {
      playerRef.current?.play(pcm, traceId, source);
    },
    [],
  );

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

  const handleModeRefused = useCallback(
    (requestedMode: ConversationMode, currentMode: ConversationMode) => {
      const userAudioWasRefused =
        requestedMode.userAudio && !currentMode.userAudio;
      if (userAudioWasRefused) {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setIsMicEnabled(false);
      }
      optionsRef.current.onModeRefused?.(requestedMode, currentMode);
    },
    [],
  );

  const client = useConversationClient({
    baseUrl,
    tokenUrl,
    getToken,
    reconnectPolicy,
    sdkInfo: sdkInfo ?? {
      name: SDK_NAME,
      version: SDK_VERSION,
      context: SDK_CONTEXT,
    },
    createTransport: () => new WebSocketTransport(),
    callbacks: {
      onEvent: (event) => optionsRef.current.onEvent?.(event),
      onMessage: (message) => optionsRef.current.onMessage?.(message),
      onAnnotation: (item) => optionsRef.current.onAnnotation?.(item),
      onError: (error) => optionsRef.current.onError?.(error),
      onStatusChange: (status) => optionsRef.current.onStatusChange?.(status),
      onConnectionStatusChange: (status) =>
        optionsRef.current.onConnectionStatusChange?.(status),
      onModeRefused: handleModeRefused,
      onAudio: handleAudio,
      onClear: handleClear,
      onCleanup: handleAudioCleanup,
    },
  });

  const connectionStatus = useStateField(client, "connectionStatus");
  const status = useStateField(client, "status");
  const conversationId = useStateField(client, "conversationId");
  const error = useStateField(client, "error");
  const mode = useStateField(client, "mode");
  const messages = useStateField(client, "messages");
  const annotations = useStateField(client, "annotations");
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
  const requestMode = useCallback(
    (newMode: ConversationMode) => client.requestMode(newMode),
    [client],
  );
  const getMode = client.getMode;
  const clearMessages = useCallback(() => client.clearMessages(), [client]);

  const timeline = useStateField(client, "timeline");

  sendEventRef.current = sendEvent;

  const {
    isMicMuted,
    isAudioMuted,
    volume,
    toggleMic,
    toggleAudio,
    setVolume,
  } = useAudioControls(playerRef, recorderRef, options.startMuted);

  const startRecorder = useCallback(
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

  const enableMic = useCallback(
    async (deviceId?: string): Promise<void> => {
      await startRecorder(deviceId);
      if (!getMode().userAudio) {
        requestMode(AUDIO_BOTH_WAYS);
      }
    },
    [startRecorder, getMode, requestMode],
  );

  const disableMic = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsMicEnabled(false);
  }, []);

  const setMode = useCallback(
    async (newMode: ConversationMode, audioDeviceId?: string) => {
      if (newMode.userAudio) {
        await startRecorder(audioDeviceId);
      } else {
        disableMic();
      }
      requestMode(newMode);
    },
    [startRecorder, disableMic, requestMode],
  );

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

      if (sessionOptions.mode?.userAudio) {
        await startRecorder(sessionOptions.audioDeviceId);
      }

      return id;
    },
    [connectionStart, startRecorder, volume],
  );

  const agentState: AgentState = agentIsSpeaking
    ? "speaking"
    : clientAgentState;

  return {
    connectionStatus,
    status,
    conversationId,
    messages,
    annotations,
    timeline,
    error,
    agentState,
    userState,
    isMicMuted,
    isMicEnabled,
    isAudioMuted,
    volume,
    mode,
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
    setMode,
  };
}
