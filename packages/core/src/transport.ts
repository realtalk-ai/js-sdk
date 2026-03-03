import type {
  ConnectionStatus,
  ClientEvent,
  ConversationEvent,
} from "./types.js";

export type SdkContext = "web_chat" | "mobile_app";

export interface SdkInfo {
  name: string;
  version: string;
  context: SdkContext;
}

export interface ConnectOptions {
  url: string;
  token: string;
  sdkInfo: SdkInfo;
  signal?: AbortSignal;
}

export interface AudioTransport {
  readonly status: ConnectionStatus;
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): void;
  gracefulDisconnect(timeoutMs?: number): Promise<void>;
  sendAudio(pcmData: Int16Array): void;
  sendEvent(payload: ClientEvent): void;
  onAudio(callback: (pcmData: Int16Array, traceId: string) => void): void;
  onEvent(callback: (event: ConversationEvent) => void): void;
  onStatusChange(callback: (status: ConnectionStatus) => void): void;
  removeAllListeners(): void;
}
