export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export type ConversationStatus = "not_started" | "active" | "finished";

export type ConversationMode = "voice" | "text";

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export type DTMFDigit =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "*"
  | "#"
  | "A"
  | "B"
  | "C"
  | "D";

export interface ToolResult {
  toolCallId: string;
  type: string;
  role: string;
  name: string;
  content: string;
}

export interface UserMessageLatencies {
  transcriptionMs?: number;
}

export interface AssistantMessageLatencies {
  firstSentenceLlmMs?: number;
  firstSentenceTtsMs?: number;
  userSilenceToSpeechMs?: number;
}

export interface MessageMetadata {
  type?: string;
  interrupted?: boolean;
  intent?: string;
  ragDocumentsUsed?: string[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  latencies?: UserMessageLatencies | AssistantMessageLatencies;
}

export interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  createdAt: string;
  metadata?: MessageMetadata;
  hasBeenAnswered?: boolean;
  shouldBeAnswered?: boolean;
}

export interface BackendMessage {
  id: string;
  sender: "Agent" | "User";
  text: string;
  timestamp: string;
  metadata?: {
    type?: string;
    interrupted?: boolean;
    intent?: string;
    rag_documents_used?: string[];
    tool_calls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
    tool_results?: Array<{
      tool_call_id: string;
      type: string;
      role: string;
      name: string;
      content: string;
    }>;
    latencies?: Record<string, number>;
  };
  has_been_answered?: boolean;
  should_be_answered?: boolean;
}

export interface SessionToken {
  token: string;
  agent_id?: string;
  conversation_id?: string;
  expires_at?: string;
}

export type TokenResponse = string | { token: string; conversationId?: string };

export type VadState = "speech" | "silence";

export type AgentState = "idle" | "thinking" | "speaking";

export type UserState = "idle" | "speaking";

export interface ConversationError {
  error: Error;
  fatal: boolean;
  timestamp: number;
}

export const EventType = {
  ExistingMessages: "existing_messages",
  MessageCreated: "message_created",
  MessageUpdated: "message_updated",
  Vad: "vad",
  Clear: "clear",
  ConversationFinished: "conversation_finished",
  Close: "close",
  Error: "error",
} as const;

export type EventTypeValue = typeof EventType[keyof typeof EventType];

export type ClientEvent =
  | { type: "message"; data: string }
  | { type: "hangup"; data?: Record<string, unknown> }
  | { type: "end_conversation"; data?: Record<string, unknown> }
  | { type: "start"; agent_id: string; metadata?: Record<string, unknown> }
  | { event: "dtmf"; data: DTMFDigit }
  | { type: string; [key: string]: unknown };

export type ConversationEvent =
  | { type: "existing_messages"; data: Message[] }
  | { type: "message_created"; data: Message }
  | { type: "message_updated"; data: Message }
  | { type: "vad"; data: { state: VadState } }
  | { type: "clear" }
  | { type: "conversation_finished" }
  | { type: "close"; code: number; reason: string }
  | { type: "error"; message?: string };
