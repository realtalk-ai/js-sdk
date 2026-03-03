export class RealtalkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealtalkError";
  }
}

export const ConnectionErrorReason = {
  Timeout: "timeout",
  WebSocketFailed: "websocket_failed",
} as const;

export type ConnectionErrorReasonValue =
  typeof ConnectionErrorReason[keyof typeof ConnectionErrorReason];

export class ConnectionError extends RealtalkError {
  readonly reason: ConnectionErrorReasonValue;

  constructor(reason: ConnectionErrorReasonValue, message?: string) {
    super(message ?? `Connection failed: ${reason}`);
    this.name = "ConnectionError";
    this.reason = reason;
  }
}

export class ApiError extends RealtalkError {
  readonly statusCode: number;
  readonly body?: unknown;

  constructor(statusCode: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class ProtocolError extends RealtalkError {
  readonly rawData?: string;

  constructor(message: string, rawData?: string) {
    super(message);
    this.name = "ProtocolError";
    this.rawData = rawData;
  }
}

export class ValidationError extends RealtalkError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
