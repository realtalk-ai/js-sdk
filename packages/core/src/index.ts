export type {
  ConnectionStatus,
  ConversationStatus,
  ConversationMode,
  DTMFDigit,
  ToolCall,
  ToolResult,
  UserMessageLatencies,
  AssistantMessageLatencies,
  MessageMetadata,
  SubTask,
  SubTaskStatus,
  Message,
  Annotation,
  AnnotationItem,
  TimelineItem,
  SessionToken,
  TokenResponse,
  VadState,
  ConversationError,
  AgentState,
  UserState,
  AudioSource,
  Protocol,
  ServerConversationStatus,
  ClientEvent,
  ConversationEvent,
} from "./types.js";

export { EventType } from "./types.js";

export type { SdkContext, SdkInfo } from "./transport.js";

export {
  WebSocketTransport,
  RECONNECTABLE_CLOSE_CODES,
  PAUSED_CLOSE_CODES,
} from "./websocket-transport.js";

export {
  normalizeMessage,
  normalizeAnnotationMessage,
  splitBackendMessages,
  buildTimeline,
  sortChronological,
} from "./events.js";

export { hasPendingSubTasks } from "./messages.js";

export { pcmToBase64, base64ToPcm } from "./audio.js";

export { sessionTokenExpiresAt } from "./session-token.js";

export { DEFAULT_WS_URL } from "./constants.js";

export {
  RealtalkError,
  ConnectionError,
  ConnectionErrorReason,
  ApiError,
  ProtocolError,
  ValidationError,
} from "./errors.js";
export type { ConnectionErrorReasonValue } from "./errors.js";

export { setLogLevel, getLogLevel, logger } from "./logger.js";
export type { LogLevel, Logger } from "./logger.js";

export {
  DefaultReconnectPolicy,
  ConversationReconnectPolicy,
} from "./reconnect.js";
export type { ReconnectPolicy, ReconnectContext } from "./reconnect.js";

export {
  ConversationClient,
  DEFAULT_CONVERSATION_MODE,
} from "./conversation-client.js";
export type {
  ConversationClientCallbacks,
  ConversationClientOptions,
  ConversationSnapshot,
  StartConversationOptions,
} from "./conversation-client.js";

export { applyMessageEvent, EMPTY_MESSAGE_STATE } from "./message-state.js";
export type { MessageState, MessageStateChange } from "./message-state.js";
