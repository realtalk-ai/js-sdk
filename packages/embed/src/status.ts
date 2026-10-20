import type {
  AgentState,
  AnnotationItem,
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
  micOn: boolean;
  audioOn: boolean;
  annotations: AnnotationItem[];
}): WidgetStatus {
  const {
    starting,
    connectionStatus,
    ended,
    paused,
    active,
    agentState,
    userState,
    micOn,
    audioOn,
    annotations,
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
    return { tone: "live", label: audioOn ? "Speaking" : "Typing" };
  }
  if (isWaitingForHumanAgent(annotations)) {
    return { tone: "waiting", label: "Waiting for human agent" };
  }
  if (agentState === "thinking") {
    return { tone: "live", label: "Thinking" };
  }
  if (micOn && userState === "speaking") {
    return { tone: "live", label: "Listening" };
  }
  return { tone: "live", label: "Online" };
}

function isWaitingForHumanAgent(annotations: AnnotationItem[]): boolean {
  const latestHandoffAnnotation = [...annotations]
    .reverse()
    .find(
      ({ annotation }) =>
        annotation.kind === "handoff_requested" ||
        annotation.kind === "human_agent_joined",
    );
  return latestHandoffAnnotation?.annotation.kind === "handoff_requested";
}
