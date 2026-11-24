import type {
  AnnotationItem,
  AudioSource,
  ClientEvent,
  ConnectionStatus,
  ConversationError,
  ConversationEvent,
  ConversationMode,
  ConversationStatus,
  DTMFDigit,
  Message,
  SessionToken,
  TokenResponse,
} from "./types.js";
import { EventType } from "./types.js";
import type { AudioTransport, SdkInfo } from "./transport.js";
import {
  PAUSED_CLOSE_CODES,
  RECONNECTABLE_CLOSE_CODES,
  WebSocketTransport,
} from "./websocket-transport.js";
import {
  ApiError,
  ConnectionError,
  ProtocolError,
  ValidationError,
} from "./errors.js";
import { DefaultReconnectPolicy, type ReconnectPolicy } from "./reconnect.js";
import {
  applyMessageEvent,
  EMPTY_MESSAGE_STATE,
  type MessageState,
} from "./message-state.js";

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export const DEFAULT_CONVERSATION_MODE: ConversationMode = {
  userAudio: false,
  agentAudio: false,
};

const MESSAGE_EVENT_TYPES: ReadonlySet<string> = new Set([
  EventType.ExistingMessages,
  EventType.MessageCreated,
  EventType.MessageUpdated,
  EventType.AnnotationCreated,
  EventType.Vad,
]);

export interface StartConversationOptions {
  agentId: string;
  conversationId?: string;
  mode?: ConversationMode;
  token?: string;
}

export interface ConversationClientCallbacks {
  onEvent?: (event: ConversationEvent) => void;
  onMessageEvent?: (event: ConversationEvent) => void;
  onMessage?: (message: Message) => void;
  onAnnotation?: (item: AnnotationItem) => void;
  onError?: (error: ConversationError) => void;
  onStatusChange?: (status: ConversationStatus) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onModeRefused?: (
    requestedMode: ConversationMode,
    currentMode: ConversationMode,
  ) => void;
  onAudio?: (pcm: Int16Array, traceId: string, source: AudioSource) => void;
  onClear?: () => void;
  onConversationStart?: () => void;
  onCleanup?: () => void;
}

export interface ConversationClientOptions {
  baseUrl: string;
  sdkInfo: SdkInfo;
  tokenUrl?: string | null;
  getToken?: (() => Promise<TokenResponse>) | null;
  reconnectPolicy?: ReconnectPolicy;
  createTransport?: () => AudioTransport;
  callbacks?: ConversationClientCallbacks;
}

export interface ConversationSnapshot extends MessageState {
  connectionStatus: ConnectionStatus;
  status: ConversationStatus;
  conversationId: string | null;
  error: ConversationError | null;
  mode: ConversationMode;
}

interface FetchedToken {
  token: string;
  conversationId?: string;
}

function isSameMode(a: ConversationMode, b: ConversationMode): boolean {
  return a.userAudio === b.userAudio && a.agentAudio === b.agentAudio;
}

export class ConversationClient {
  private options: ConversationClientOptions;
  private snapshot: ConversationSnapshot = {
    ...EMPTY_MESSAGE_STATE,
    connectionStatus: "disconnected",
    status: "not_started",
    conversationId: null,
    error: null,
    mode: DEFAULT_CONVERSATION_MODE,
  };
  private readonly listeners = new Set<() => void>();
  private transport: AudioTransport | null = null;
  private sessionOptions: StartConversationOptions | null = null;
  private sessionToken: string | null = null;
  private requestedMode: ConversationMode | null = null;
  private reconnectAttempt = 0;
  private reconnectStartedAt: number | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  constructor(options: ConversationClientOptions) {
    this.options = options;
  }

  configure(options: Partial<ConversationClientOptions>): void {
    this.options = { ...this.options, ...options };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ConversationSnapshot => this.snapshot;

  getMode = (): ConversationMode => this.snapshot.mode;

  async start(sessionOptions: StartConversationOptions): Promise<string> {
    this.update({ error: null });

    if (this.snapshot.status === "active") {
      throw new ValidationError("Conversation already active");
    }
    if (!sessionOptions.agentId) {
      throw new ValidationError("agentId is required");
    }

    const resolvedOptions = { ...sessionOptions };
    this.intentionalDisconnect = false;
    this.sessionOptions = resolvedOptions;
    this.requestedMode = null;
    this.setMode(sessionOptions.mode ?? DEFAULT_CONVERSATION_MODE);
    this.clearMessages();
    this.callbacks.onConversationStart?.();

    const tokenConversationId = await this.resolveToken(sessionOptions);

    this.setConnectionStatus("connecting");
    this.setStatus("active");

    const id = sessionOptions.conversationId ?? tokenConversationId;
    if (!id) {
      throw new ValidationError(
        "No conversation ID available. Provide conversationId via startConversation options or use a token endpoint that returns conversation_id.",
      );
    }
    this.update({ conversationId: id });

    try {
      await this.connect(resolvedOptions);
    } catch (error) {
      this.cleanup();
      this.setConnectionStatus("disconnected");
      this.setStatus("not_started");
      throw error;
    }

    return id;
  }

  async end(): Promise<void> {
    const { status, conversationId } = this.snapshot;
    const wasRunning = status === "active" || status === "paused";
    const transport = this.transport;
    if (transport) {
      transport.sendEvent({ type: "end_conversation", data: {} });
      transport.removeAllListeners();
      await transport.gracefulDisconnect();
      this.transport = null;
    }
    this.intentionalDisconnect = true;
    this.update({ error: null });
    this.cleanup();
    this.setStatus(wasRunning ? "finished" : "not_started");
    this.setConnectionStatus("disconnected");
    if (wasRunning && conversationId) {
      this.update({ conversationId });
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.cleanup();
    this.update({ status: "not_started", connectionStatus: "disconnected" });
  }

  sendMessage(text: string): void {
    this.transport?.sendEvent({ type: "message", data: text });
  }

  sendDTMF(digit: DTMFDigit): void {
    this.transport?.sendEvent({ type: "dtmf", data: digit });
  }

  sendEvent(payload: ClientEvent): void {
    this.transport?.sendEvent(payload);
  }

  sendAudio(pcm: Int16Array): void {
    this.transport?.sendAudio(pcm);
  }

  requestMode(mode: ConversationMode): void {
    if (!this.transport) return;
    this.requestedMode = mode;
    this.transport.sendEvent({
      type: "set_conversation_mode",
      data: { user_audio: mode.userAudio, agent_audio: mode.agentAudio },
    });
  }

  clearMessages(): void {
    this.update({ messages: [], annotations: [] });
  }

  private get callbacks(): ConversationClientCallbacks {
    return this.options.callbacks ?? {};
  }

  private update(changes: Partial<ConversationSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.listeners) listener();
  }

  private setStatus(status: ConversationStatus): void {
    this.update({ status });
    this.callbacks.onStatusChange?.(status);
  }

  private setConnectionStatus(connectionStatus: ConnectionStatus): void {
    this.update({ connectionStatus });
    this.callbacks.onConnectionStatusChange?.(connectionStatus);
  }

  private setMode(mode: ConversationMode): void {
    if (isSameMode(this.snapshot.mode, mode)) return;
    this.update({ mode });
  }

  private reportError(error: Error, fatal: boolean): void {
    const conversationError: ConversationError = {
      error,
      fatal,
      timestamp: Date.now(),
    };
    this.update({ error: conversationError });
    this.callbacks.onError?.(conversationError);
  }

  private cleanup(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.callbacks.onCleanup?.();

    if (this.transport) {
      this.transport.removeAllListeners();
      this.transport.disconnect();
      this.transport = null;
    }

    this.update({ conversationId: null });
    this.sessionOptions = null;
    this.sessionToken = null;
    this.reconnectAttempt = 0;
    this.reconnectStartedAt = null;
  }

  private handleEvent(event: ConversationEvent): void {
    this.callbacks.onEvent?.(event);

    if (MESSAGE_EVENT_TYPES.has(event.type)) {
      this.handleMessageEvent(event);
      return;
    }

    switch (event.type) {
      case EventType.Clear:
        this.callbacks.onClear?.();
        break;
      case EventType.ConversationMode:
        this.handleConfirmedMode({
          userAudio: event.data.user_audio,
          agentAudio: event.data.agent_audio,
        });
        break;
      case EventType.ConversationStatus:
        if (event.data.status === "ended") this.finish();
        break;
      case EventType.Close:
        this.handleClose(event.code);
        break;
      case EventType.Error:
        this.reportError(
          new ProtocolError(event.message ?? "Unknown error"),
          false,
        );
        break;
    }
  }

  private handleMessageEvent(event: ConversationEvent): void {
    const change = applyMessageEvent(this.snapshot, event);
    this.update(change.state);
    this.callbacks.onMessageEvent?.(event);
    if (change.message) this.callbacks.onMessage?.(change.message);
    if (change.annotation) this.callbacks.onAnnotation?.(change.annotation);
  }

  private handleConfirmedMode(confirmedMode: ConversationMode): void {
    const requestedMode = this.requestedMode;
    this.requestedMode = null;
    this.setMode(confirmedMode);

    const wasRefused =
      requestedMode !== null && !isSameMode(requestedMode, this.snapshot.mode);
    if (!wasRefused) return;

    this.reportError(
      new ProtocolError(
        "The requested conversation mode is not available right now",
      ),
      false,
    );
    this.callbacks.onModeRefused?.(requestedMode, this.snapshot.mode);
  }

  private finish(): void {
    const finishedId = this.snapshot.conversationId;
    this.intentionalDisconnect = true;
    this.cleanup();
    this.setStatus("finished");
    this.setConnectionStatus("disconnected");
    if (finishedId) this.update({ conversationId: finishedId });
  }

  private handleClose(code: number): void {
    const isUnexpected = !this.intentionalDisconnect && this.sessionOptions;
    if (!isUnexpected) return;

    if (PAUSED_CLOSE_CODES.has(code)) {
      const pausedId = this.snapshot.conversationId;
      this.cleanup();
      this.setStatus("paused");
      this.setConnectionStatus("disconnected");
      if (pausedId) this.update({ conversationId: pausedId });
      return;
    }

    if (RECONNECTABLE_CLOSE_CODES.has(code)) {
      this.setConnectionStatus("reconnecting");
      this.scheduleReconnect();
      return;
    }

    this.reportError(
      new ConnectionError(
        "websocket_failed",
        `Connection closed with code ${code}`,
      ),
      true,
    );
    this.cleanup();
    this.setStatus("not_started");
    this.setConnectionStatus("disconnected");
  }

  private async connect(
    sessionOptions: StartConversationOptions,
  ): Promise<void> {
    this.setConnectionStatus("connecting");

    const id = this.snapshot.conversationId;
    if (!id) {
      throw new ValidationError("No conversation ID available for connection");
    }

    const createTransport =
      this.options.createTransport ?? (() => new WebSocketTransport());
    const transport = createTransport();
    this.transport = transport;
    transport.onAudio((pcm, traceId, source) =>
      this.callbacks.onAudio?.(pcm, traceId, source),
    );
    transport.onEvent((event) => this.handleEvent(event));

    await transport.connect({
      url: `${this.options.baseUrl}/ws/conversations/audio/${id}/`,
      token: this.sessionToken ?? "",
      sdkInfo: this.options.sdkInfo,
      mode: this.snapshot.mode,
      protocol: 2,
    });

    this.reconnectAttempt = 0;
    this.reconnectStartedAt = null;
    this.update({ error: null });
    this.setConnectionStatus("connected");

    transport.sendEvent({ type: "start", agent_id: sessionOptions.agentId });
  }

  private async fetchToken(): Promise<FetchedToken | null> {
    const tokenSource = this.options.getToken;
    if (tokenSource) {
      const tokenResult = await tokenSource();
      return typeof tokenResult === "string"
        ? { token: tokenResult }
        : tokenResult;
    }

    const { tokenUrl } = this.options;
    if (!tokenUrl) return null;
    const response = await fetch(tokenUrl);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        `Failed to fetch session token: ${response.status}`,
      );
    }
    const data = (await response.json()) as SessionToken;
    return {
      token: data.token,
      conversationId: data.conversation_id || undefined,
    };
  }

  private async resolveToken(
    sessionOptions: StartConversationOptions,
  ): Promise<string | undefined> {
    if (sessionOptions.token) {
      this.sessionToken = sessionOptions.token;
      return undefined;
    }

    const fetched = await this.fetchToken();
    if (!fetched) return undefined;
    this.sessionToken = fetched.token;
    return fetched.conversationId;
  }

  private stopReconnecting(error: Error): void {
    this.reportError(error, true);
    this.cleanup();
    this.setStatus("not_started");
    this.setConnectionStatus("disconnected");
  }

  private scheduleReconnect(): void {
    if (this.intentionalDisconnect) return;

    this.reconnectStartedAt ??= Date.now();
    const policy =
      this.options.reconnectPolicy ??
      new DefaultReconnectPolicy(RECONNECT_DELAYS_MS);
    const delay = policy.nextRetryDelayMs({
      retryCount: this.reconnectAttempt,
      elapsedMs: Date.now() - this.reconnectStartedAt,
    });
    if (delay === null) {
      this.stopReconnecting(
        new ConnectionError(
          "websocket_failed",
          "All reconnection attempts exhausted",
        ),
      );
      return;
    }

    this.reconnectTimeout = setTimeout(() => void this.reconnect(), delay);
  }

  private async reconnect(): Promise<void> {
    const sessionOptions = this.sessionOptions;
    if (this.intentionalDisconnect || !sessionOptions) return;

    this.reconnectAttempt++;

    try {
      const fetched = await this.fetchToken();
      if (fetched) this.sessionToken = fetched.token;
      await this.connect(sessionOptions);
    } catch {
      this.scheduleReconnect();
    }
  }
}
