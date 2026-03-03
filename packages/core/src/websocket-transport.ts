import type { AudioTransport, ConnectOptions } from "./transport.js";
import type {
  ClientEvent,
  ConnectionStatus,
  ConversationEvent,
} from "./types.js";
import { EventType } from "./types.js";
import type { ReconnectPolicy } from "./reconnect.js";
import {
  EventEmitter,
  convertEventForSDK,
  convertEventForTransport,
} from "./events.js";
import {
  ConnectionError,
  ConnectionErrorReason,
  ProtocolError,
} from "./errors.js";
import { pcmToBase64, base64ToPcm } from "./audio.js";
import { logger } from "./logger.js";

export interface WebSocketTransportOptions {
  reconnectPolicy?: ReconnectPolicy;
  connectionTimeout?: number;
}

type ConversationEventMap = {
  audio: [pcmData: Int16Array, traceId: string];
  event: [event: ConversationEvent];
  statusChange: [status: ConnectionStatus];
};

const VALID_EVENT_TYPES = new Set<string>(Object.values(EventType));

export const RECONNECTABLE_CLOSE_CODES = new Set([
  1001, // Going away
  1006, // Abnormal closure
  1008, // Policy violation (server draining)
  1012, // Service restart
  1013, // Try again later
  1014, // Bad gateway
  4001, // Invalid session token (reconnect with refreshed token)
]);

export class WebSocketTransport implements AudioTransport {
  private ws: WebSocket | null = null;
  private emitter = new EventEmitter<ConversationEventMap>();
  private _status: ConnectionStatus = "disconnected";
  private connectOptions: ConnectOptions | null = null;
  private reconnectPolicy: ReconnectPolicy | null;
  private connectionTimeout: number;
  private intentionalDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: WebSocketTransportOptions = {}) {
    this.reconnectPolicy = options.reconnectPolicy ?? null;
    this.connectionTimeout = options.connectionTimeout ?? 15_000;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    const prev = this._status;
    this._status = status;
    logger.debug("status_changed", { from: prev, to: status });
    this.emitter.emit("statusChange", status);
  }

  async connect(options: ConnectOptions): Promise<void> {
    if (this._status === "connected" || this._status === "connecting") {
      throw new ConnectionError(
        ConnectionErrorReason.WebSocketFailed,
        "Already connected or connecting"
      );
    }

    this.connectOptions = options;
    this.intentionalDisconnect = false;
    this.setStatus("connecting");

    try {
      await this.rawConnect(options);
      this.setStatus("connected");
    } catch (error) {
      this.setStatus("disconnected");
      throw error;
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupWebSocket();
    this.setStatus("disconnected");
  }

  async gracefulDisconnect(timeoutMs: number = 1000): Promise<void> {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.cleanupWebSocket();
      this.setStatus("disconnected");
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.cleanupWebSocket();
        resolve();
      }, timeoutMs);

      this.ws!.onmessage = null;
      this.ws!.onclose = () => {
        clearTimeout(timeout);
        this.ws = null;
        resolve();
      };
      this.ws!.close();
    });

    this.setStatus("disconnected");
  }

  sendAudio(pcmData: Int16Array): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn("send_audio_dropped", { status: this._status });
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "media",
        media: { payload: pcmToBase64(pcmData) },
      })
    );
  }

  sendEvent(payload: ClientEvent): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn("send_event_dropped", {
        eventType:
          "type" in payload
            ? payload.type
            : "event" in payload
            ? payload.event
            : "unknown",
        status: this._status,
      });
      return;
    }

    this.ws.send(JSON.stringify(convertEventForTransport(payload)));
  }

  onAudio(callback: (pcmData: Int16Array, traceId: string) => void): void {
    this.emitter.on("audio", callback);
  }

  onEvent(callback: (event: ConversationEvent) => void): void {
    this.emitter.on("event", callback);
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.emitter.on("statusChange", callback);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  private rawConnect(options: ConnectOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      let wsUrl = `${options.url}?token=${encodeURIComponent(options.token)}`;
      wsUrl += `&context=${encodeURIComponent(options.sdkInfo.context)}`;
      wsUrl += `&sdk_name=${encodeURIComponent(options.sdkInfo.name)}`;
      wsUrl += `&sdk_version=${encodeURIComponent(options.sdkInfo.version)}`;
      let settled = false;

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.cleanupWebSocket();
        reject(
          new ConnectionError(
            ConnectionErrorReason.Timeout,
            `Connection timed out after ${this.connectionTimeout}ms`
          )
        );
      }, this.connectionTimeout);

      if (options.signal) {
        if (options.signal.aborted) {
          clearTimeout(timeoutId);
          reject(
            new ConnectionError(
              ConnectionErrorReason.WebSocketFailed,
              "Connection aborted"
            )
          );
          return;
        }
        options.signal.addEventListener(
          "abort",
          () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            this.cleanupWebSocket();
            reject(
              new ConnectionError(
                ConnectionErrorReason.WebSocketFailed,
                "Connection aborted"
              )
            );
          },
          { once: true }
        );
      }

      logger.debug("websocket_connecting", { url: options.url });
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.setupMessageHandlers();
        logger.info("websocket_connected", { url: options.url });
        resolve();
      };

      this.ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.cleanupWebSocket();
        reject(new ConnectionError(ConnectionErrorReason.WebSocketFailed));
      };
    });
  }

  private setupMessageHandlers(): void {
    if (!this.ws) return;

    this.ws.onclose = (event) => {
      logger.debug("websocket_closed", {
        code: event.code,
        reason: event.reason,
      });
      this.ws = null;

      this.emitter.emit("event", {
        type: "close",
        code: event.code,
        reason: event.reason,
      });

      if (!this.intentionalDisconnect) {
        this.attemptReconnect(event.code);
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private async attemptReconnect(closeCode: number): Promise<void> {
    if (
      !this.connectOptions ||
      !this.reconnectPolicy ||
      !RECONNECTABLE_CLOSE_CODES.has(closeCode)
    ) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");
    const startTime = Date.now();
    let retryCount = 0;

    while (!this.intentionalDisconnect) {
      const delay = this.reconnectPolicy.nextRetryDelayMs({
        retryCount,
        elapsedMs: Date.now() - startTime,
      });

      if (delay === null) {
        logger.warn("reconnect_exhausted", { retryCount });
        this.setStatus("disconnected");
        return;
      }

      logger.debug("reconnect_scheduled", { retryCount, delayMs: delay });

      await new Promise<void>((resolve) => {
        this.reconnectTimer = setTimeout(resolve, delay);
      });

      if (this.intentionalDisconnect) {
        this.setStatus("disconnected");
        return;
      }

      try {
        await this.rawConnect(this.connectOptions);
        this.setStatus("connected");
        logger.info("reconnect_succeeded", { retryCount });
        return;
      } catch {
        retryCount++;
      }
    }

    this.setStatus("disconnected");
  }

  private cleanupWebSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (message.type === "media" && message.media?.payload) {
        const pcmData = base64ToPcm(message.media.payload);
        const traceId = message.trace_id ?? "default";
        this.emitter.emit("audio", pcmData, traceId);
        return;
      }

      if (message.type && !VALID_EVENT_TYPES.has(message.type)) {
        logger.warn("unknown_event_type", { type: message.type });
      }

      this.emitter.emit("event", convertEventForSDK(message));
    } catch {
      const rawData = typeof data === "string" ? data : undefined;
      logger.error("message_parse_failed", { rawData });
      this.emitter.emit("event", {
        type: "error",
        message: new ProtocolError("Failed to parse message", rawData).message,
      });
    }
  }
}
