import type {
  AgentState,
  ConnectionStatus,
  UserState,
} from "@realtalk-ai/core";

export interface WidgetStatus {
  tone: string;
  label: string;
  hint?: string;
}

export function deriveWidgetStatus(state: {
  starting: boolean;
  connectionStatus: ConnectionStatus;
  ended: boolean;
  paused: boolean;
  active: boolean;
  agentState: AgentState;
  userState: UserState;
  isAudioMuted: boolean;
  isMicEnabled: boolean;
}): WidgetStatus {
  const {
    starting,
    connectionStatus,
    ended,
    paused,
    active,
    agentState,
    userState,
    isAudioMuted,
    isMicEnabled,
  } = state;

  if (starting || connectionStatus === "connecting") {
    return { tone: "connecting", label: "Connecting" };
  }
  if (connectionStatus === "reconnecting") {
    return {
      tone: "connecting",
      label: "Reconnecting",
      hint: "Connection lost, retrying",
    };
  }
  if (ended) {
    return { tone: "ended", label: "Conversation ended" };
  }
  if (paused) {
    return {
      tone: "paused",
      label: "Still here",
      hint: "Send a message to continue",
    };
  }
  if (!active) {
    return { tone: "online", label: "Online" };
  }
  if (agentState === "speaking") {
    return { tone: "live", label: isAudioMuted ? "Typing" : "Speaking" };
  }
  if (agentState === "thinking") {
    return { tone: "live", label: "Thinking" };
  }
  if (isMicEnabled && userState === "speaking") {
    return { tone: "live", label: "Listening" };
  }
  return { tone: "online", label: "Online" };
}
