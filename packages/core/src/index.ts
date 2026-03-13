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
  SessionToken,
  TokenResponse,
  VadState,
  ConversationError,
  AgentState,
  UserState,
  ClientEvent,
  ConversationEvent,
} from "./types.js";

export { EventType } from "./types.js";

export {
  WebSocketTransport,
  RECONNECTABLE_CLOSE_CODES,
} from "./websocket-transport.js";

export { normalizeMessage, sortChronological } from "./events.js";

export { pcmToBase64, base64ToPcm } from "./audio.js";

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

export { DefaultReconnectPolicy } from "./reconnect.js";
export type { ReconnectPolicy, ReconnectContext } from "./reconnect.js";
